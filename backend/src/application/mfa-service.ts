import { randomBytes } from 'node:crypto';

import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type { MfaMethod } from '../domain/mfa.js';
import type { Clock, MfaStore } from '../domain/ports.js';
import { randomToken, sha256 } from './crypto.js';
import {
  generateTotpSecret,
  otpauthUrl,
  verifyTotp,
} from './totp.js';
import type { AuditService } from './audit-service.js';
import type { AuthService, SignInResult } from './auth-service.js';
import type { OrgService } from './org-service.js';

const RECOVERY_COUNT = 10;

export class MfaService {
  constructor(
    private readonly store: MfaStore,
    private readonly clock: Clock,
    private readonly issuer: string,
    private readonly auth: AuthService,
    private readonly orgs: OrgService,
    private readonly audit?: AuditService
  ) {}

  async status(user: User) {
    const [totp, passkeys, recovery] = await Promise.all([
      this.store.getTotp(user.id),
      this.store.listWebAuthn(user.id),
      this.store.listRecoveryCodes(user.id),
    ]);
    return {
      totp: Boolean(totp?.verifiedAt),
      passkeyCount: passkeys.length,
      recoveryRemaining: recovery.filter(item => !item.usedAt).length,
    };
  }

  async methodsFor(user: User): Promise<MfaMethod[]> {
    const status = await this.status(user);
    const methods: MfaMethod[] = [];
    if (status.totp) {
      methods.push('totp');
    }
    if (status.passkeyCount > 0) {
      methods.push('passkey');
    }
    if (status.recoveryRemaining > 0) {
      methods.push('recovery');
    }
    return methods;
  }

  async enrolled(user: User): Promise<boolean> {
    const methods = await this.methodsFor(user);
    return methods.includes('totp') || methods.includes('passkey');
  }

  async beginTotp(user: User) {
    const secret = generateTotpSecret();
    await this.store.upsertTotp({
      userId: user.id,
      secret,
      verifiedAt: null,
      createdAt: this.clock.now(),
    });
    return {
      secret,
      otpauthUrl: otpauthUrl({
        email: user.email,
        secret,
        issuer: this.issuer,
      }),
    };
  }

  async confirmTotp(user: User, code: string) {
    const totp = await this.store.getTotp(user.id);
    if (!totp) {
      throw errors.mfaInvalid();
    }
    if (!verifyTotp(totp.secret, code, this.clock.now().getTime())) {
      await this.audit?.record({
        actorId: user.id,
        action: 'auth.mfa_fail',
        metadata: { method: 'totp_enroll' },
      });
      throw errors.mfaInvalid();
    }
    await this.store.upsertTotp({
      ...totp,
      verifiedAt: this.clock.now(),
    });
    const codes = await this.ensureRecoveryCodes(user);
    await this.audit?.record({
      actorId: user.id,
      action: 'auth.mfa_enroll',
      metadata: { method: 'totp' },
    });
    return { recoveryCodes: codes };
  }

  async registerPasskey(user: User, input: { credentialId: string; publicKey: string; deviceName?: string }) {
    if (!input.credentialId || !input.publicKey) {
      throw errors.badRequest('credentialId and publicKey are required.');
    }
    const existing = await this.store.getWebAuthnByCredentialId(input.credentialId);
    if (existing) {
      throw errors.badRequest('Passkey is already registered.');
    }
    await this.store.addWebAuthn({
      id: crypto.randomUUID(),
      userId: user.id,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: 0,
      deviceName: input.deviceName ?? null,
      createdAt: this.clock.now(),
    });
    await this.audit?.record({
      actorId: user.id,
      action: 'auth.mfa_enroll',
      metadata: { method: 'passkey' },
    });
    return this.status(user);
  }

  async passkeyChallenge(user: User) {
    const challenge = randomToken(32);
    const token = randomToken(24);
    await this.store.createMfaChallenge({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: sha256(token),
      purpose: 'webauthn',
      payload: { challenge },
      expiresAt: new Date(this.clock.now().getTime() + 5 * 60 * 1000),
      createdAt: this.clock.now(),
    });
    const credentials = await this.store.listWebAuthn(user.id);
    return {
      challenge,
      allowCredentials: credentials.map(item => item.credentialId),
      timeout: 60_000,
    };
  }

  async verifyPasskey(
    user: User,
    input: { credentialId: string; authenticatorData: string; signature: string; challenge: string }
  ) {
    const credential = await this.store.getWebAuthnByCredentialId(input.credentialId);
    if (!credential || credential.userId !== user.id) {
      throw errors.mfaInvalid();
    }
    if (!input.authenticatorData || !input.signature || !input.challenge) {
      throw errors.mfaInvalid();
    }
    await this.store.updateWebAuthnCounter(credential.id, credential.counter + 1);
    return true;
  }

  async createLoginChallenge(user: User): Promise<{ mfaToken: string; methods: MfaMethod[] }> {
    const methods = await this.methodsFor(user);
    const mfaToken = randomToken(32);
    await this.store.createMfaChallenge({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: sha256(mfaToken),
      purpose: 'login',
      payload: {},
      expiresAt: new Date(this.clock.now().getTime() + 5 * 60 * 1000),
      createdAt: this.clock.now(),
    });
    return { mfaToken, methods };
  }

  async completeLogin(input: {
    mfaToken: string;
    code?: string;
    recoveryCode?: string;
    clientKind: 'web' | 'native';
  }): Promise<SignInResult> {
    const challenge = await this.store.findMfaChallengeByHash(sha256(input.mfaToken));
    if (
      !challenge ||
      challenge.purpose !== 'login' ||
      challenge.expiresAt.getTime() <= this.clock.now().getTime()
    ) {
      throw errors.mfaInvalid();
    }
    const user = await this.auth.getUserById(challenge.userId);
    if (!user || user.disabled) {
      throw errors.userDisabled();
    }
    let ok = false;
    if (input.recoveryCode) {
      ok = await this.store.consumeRecoveryCode(
        user.id,
        sha256(input.recoveryCode.trim().toLowerCase()),
        this.clock.now()
      );
    } else if (input.code) {
      const totp = await this.store.getTotp(user.id);
      ok = Boolean(
        totp?.verifiedAt &&
          verifyTotp(totp.secret, input.code, this.clock.now().getTime())
      );
    }
    if (!ok) {
      await this.audit?.record({
        actorId: user.id,
        action: 'auth.mfa_fail',
        metadata: { method: input.recoveryCode ? 'recovery' : 'totp' },
      });
      throw errors.mfaInvalid();
    }
    await this.store.deleteMfaChallenge(challenge.id);
    return this.auth.issueSessionFor(user, input.clientKind);
  }

  async requiredForPassword(user: User): Promise<boolean> {
    const org = await this.orgs.default();
    const policy = this.orgs.mfaPolicy(org);
    const enrolled = await this.enrolled(user);
    if (policy === 'all' || policy === 'if_not_sso') {
      return enrolled;
    }
    return enrolled;
  }

  private async ensureRecoveryCodes(user: User): Promise<string[]> {
    const existing = await this.store.listRecoveryCodes(user.id);
    if (existing.some(item => !item.usedAt)) {
      return [];
    }
    const codes: string[] = [];
    const rows = [];
    for (let i = 0; i < RECOVERY_COUNT; i += 1) {
      const code = randomBytes(5).toString('hex');
      codes.push(code);
      rows.push({
        userId: user.id,
        codeHash: sha256(code),
        usedAt: null,
      });
    }
    await this.store.replaceRecoveryCodes(user.id, rows);
    return codes;
  }
}
