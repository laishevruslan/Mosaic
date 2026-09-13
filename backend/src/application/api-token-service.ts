import type { AuditService } from './audit-service.js';
import { randomToken, sha256 } from './crypto.js';
import {
  API_TOKEN_SCOPES,
  type ApiToken,
  type ApiTokenScope,
} from '../domain/api-token.js';
import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type { ApiTokenStore, Clock } from '../domain/ports.js';

function fingerprintOf(hash: string): string {
  return hash.slice(0, 8);
}

export class ApiTokenService {
  constructor(
    private readonly store: ApiTokenStore,
    private readonly clock: Clock,
    private readonly audit?: AuditService
  ) {}

  async create(
    user: User,
    input: { name: string; scopes?: string[] }
  ): Promise<{ token: ApiToken; secret: string }> {
    const scopes = (input.scopes ?? ['read:docs']).filter((scope): scope is ApiTokenScope =>
      (API_TOKEN_SCOPES as readonly string[]).includes(scope)
    );
    if (scopes.length === 0) {
      throw errors.badRequest('At least one valid API token scope is required.');
    }
    const secret = `mosaic_pat_${randomToken(24)}`;
    const tokenHash = sha256(secret);
    const token = await this.store.createApiToken({
      id: crypto.randomUUID(),
      userId: user.id,
      name: input.name,
      tokenHash,
      fingerprint: fingerprintOf(tokenHash),
      scopes,
      createdAt: this.clock.now(),
      lastUsedAt: null,
      revokedAt: null,
    });
    await this.audit?.record({
      actorId: user.id,
      action: 'api.token_create',
      targetType: 'api_token',
      targetId: token.id,
      metadata: { scopes },
    });
    return { token, secret };
  }

  async list(user: User): Promise<ApiToken[]> {
    return this.store.listApiTokens(user.id);
  }

  async revoke(user: User, id: string): Promise<boolean> {
    const token = await this.store.getApiToken(id);
    if (!token || token.userId !== user.id) {
      throw errors.apiTokenNotFound();
    }
    await this.store.updateApiToken(id, { revokedAt: this.clock.now() });
    return true;
  }

  async authenticate(secret: string | undefined): Promise<ApiToken | null> {
    if (!secret) {
      return null;
    }
    const token = await this.store.findApiTokenByHash(sha256(secret));
    if (!token || token.revokedAt) {
      return null;
    }
    await this.store.updateApiToken(token.id, { lastUsedAt: this.clock.now() });
    return token;
  }

  hasScope(token: ApiToken, scope: ApiTokenScope): boolean {
    return token.scopes.includes(scope);
  }
}
