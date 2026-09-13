import { errors } from '../domain/errors.js';
import { emailDomain } from '../domain/security.js';
import { isOrgRole, type OrgRole } from '../domain/org.js';
import type { Clock } from '../domain/ports.js';
import type { OidcClient, SsoProfile } from '../domain/sso.js';
import type { AuthService, SignInResult } from './auth-service.js';
import type { OrgService } from './org-service.js';
import {
  buildAuthnRequest,
  decodeSamlResponse,
  encodeSamlRequest,
  parseSamlAssertion,
} from './saml.js';

interface PendingState {
  nonce: string;
  redirectUri: string;
  clientNonce: string | null;
  createdAt: number;
}

export interface SamlSettings {
  ssoUrl?: string;
  entityId?: string;
  certificate?: string;
}

export class SsoService {
  private readonly pending = new Map<string, PendingState>();

  constructor(
    private readonly auth: AuthService,
    private readonly oidc: OidcClient,
    private readonly saml: SamlSettings,
    private readonly publicUrl: string,
    private readonly clock: Clock,
    private readonly orgs?: OrgService
  ) {}

  oauthProviders(): string[] {
    return this.oidc.enabled ? [this.oidc.providerLabel] : [];
  }

  samlEnabled(): boolean {
    return Boolean(this.saml.ssoUrl);
  }

  async preflight(input: {
    provider: string;
    client?: string;
    redirectUri?: string;
    clientNonce?: string;
  }): Promise<{ url: string }> {
    if (!this.oidc.enabled) {
      throw errors.unknownOauth();
    }
    if (
      input.provider !== this.oidc.providerLabel &&
      input.provider !== 'OIDC'
    ) {
      throw errors.unknownOauth();
    }
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const redirectUri = input.redirectUri?.trim() || `${this.publicUrl}/`;
    this.pending.set(state, {
      nonce,
      redirectUri,
      clientNonce: input.clientNonce ?? null,
      createdAt: this.clock.now().getTime(),
    });
    const url = await this.oidc.authorizationUrl({
      state,
      nonce,
      redirectUri: `${this.publicUrl}/oauth/callback`,
    });
    return { url };
  }

  async callback(input: {
    code: string;
    state: string;
    clientNonce?: string;
    clientKind: 'web' | 'native';
  }): Promise<SignInResult & { redirectUri: string }> {
    const pending = this.takeState(input.state);
    if (
      pending.clientNonce &&
      input.clientNonce &&
      pending.clientNonce !== input.clientNonce
    ) {
      throw errors.invalidOauthState();
    }
    const profile = await this.oidc
      .exchangeCode({
        code: input.code,
        redirectUri: `${this.publicUrl}/oauth/callback`,
        nonce: pending.nonce,
      })
      .catch((error: unknown) => {
        if (error && typeof error === 'object' && 'status' in error) {
          throw error;
        }
        throw errors.invalidOauthState();
      });
    const result = await this.completeProfile(profile, input.clientKind);
    return { ...result, redirectUri: pending.redirectUri };
  }

  samlMetadata(): string {
    const entityId = this.saml.entityId ?? `${this.publicUrl}/saml`;
    const acs = `${this.publicUrl}/api/auth/saml/acs`;
    return (
      `<?xml version="1.0"?>` +
      `<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">` +
      `<SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">` +
      `<AssertionConsumerService index="0" Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}"/>` +
      `</SPSSODescriptor></EntityDescriptor>`
    );
  }

  samlRedirectUrl(): string {
    if (!this.saml.ssoUrl) {
      throw errors.unknownOauth();
    }
    const id = `_${crypto.randomUUID()}`;
    const xml = buildAuthnRequest({
      id,
      acsUrl: `${this.publicUrl}/api/auth/saml/acs`,
      entityId: this.saml.entityId ?? `${this.publicUrl}/saml`,
      destination: this.saml.ssoUrl,
      issueInstant: this.clock.now().toISOString(),
    });
    const url = new URL(this.saml.ssoUrl);
    url.searchParams.set('SAMLRequest', encodeSamlRequest(xml));
    url.searchParams.set('RelayState', id);
    return url.toString();
  }

  async completeSaml(
    response: string,
    clientKind: 'web' | 'native'
  ): Promise<SignInResult> {
    if (!this.saml.ssoUrl) {
      throw errors.unknownOauth();
    }
    const xml = decodeSamlResponse(response);
    const profile = parseSamlAssertion(xml, this.saml.certificate);
    return this.completeProfile(profile, clientKind);
  }

  async completeProfile(
    profile: SsoProfile,
    clientKind: 'web' | 'native'
  ): Promise<SignInResult> {
    if (!profile.email.includes('@')) {
      throw errors.invalidEmail();
    }
    const org = await this.orgs?.default();
    const domain = emailDomain(profile.email);
    const verified = org
      ? await this.orgs?.findVerifiedDomain(domain)
      : null;
    const createIfMissing = org?.jitEnabled !== false;
    const result = await this.auth.completeSso(profile, clientKind, {
      createIfMissing,
    });
    if (org) {
      const idp = await this.orgs?.getIdp(org.id);
      const mapped = this.mapGroups(profile.groups, idp?.groupRoleMap ?? {});
      await this.orgs?.addMember(org.id, result.user.id, mapped);
    }
    void verified;
    return result;
  }

  private mapGroups(
    groups: string[],
    roleMap: Record<string, string>
  ): OrgRole {
    let role: OrgRole = 'member';
    for (const group of groups) {
      const mapped = roleMap[group] ?? roleMap[group.toLowerCase()];
      if (mapped && isOrgRole(mapped)) {
        if (mapped === 'owner') {
          return 'owner';
        }
        if (mapped === 'admin') {
          role = 'admin';
        }
      } else if (/admin/i.test(group)) {
        role = 'admin';
      }
    }
    return role;
  }

  private takeState(state: string): PendingState {
    const pending = this.pending.get(state);
    this.pending.delete(state);
    if (!pending) {
      throw errors.invalidOauthState();
    }
    if (this.clock.now().getTime() - pending.createdAt > 10 * 60 * 1000) {
      throw errors.invalidOauthState();
    }
    return pending;
  }
}
