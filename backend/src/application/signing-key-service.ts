import type { Clock, InstanceSettingsStore } from '../domain/ports.js';
import type { AuditService } from './audit-service.js';
import type { User } from '../domain/identity.js';
import { errors } from '../domain/errors.js';

export interface AuthSigningKey {
  id: string;
  status: 'active' | 'retired';
  source: string;
  createdAt: Date;
  retiredAt: Date | null;
  verifyUntil: Date | null;
  canDelete: boolean;
}

const SETTING_KEY = 'auth_signing_keys';

export class SigningKeyService {
  constructor(
    private readonly settings: InstanceSettingsStore,
    private readonly clock: Clock,
    private readonly audit?: AuditService
  ) {}

  async list(): Promise<AuthSigningKey[]> {
    const keys = await this.load();
    if (keys.length === 0) {
      return this.rotate('bootstrap');
    }
    return keys.map(key => this.view(key));
  }

  async rotate(expectedActiveKeyId: string, actor?: User): Promise<AuthSigningKey[]> {
    const now = this.clock.now();
    const keys = await this.load();
    const active = keys.filter(key => key.status === 'active');
    if (
      expectedActiveKeyId !== 'bootstrap' &&
      active.length > 0 &&
      !active.some(key => key.id === expectedActiveKeyId)
    ) {
      throw errors.badRequest('Active signing key id does not match.');
    }
    const retired = keys.map(key =>
      key.status === 'active'
        ? {
            ...key,
            status: 'retired' as const,
            retiredAt: now,
            verifyUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          }
        : key
    );
    retired.push({
      id: crypto.randomUUID(),
      status: 'active',
      source: 'generated',
      createdAt: now,
      retiredAt: null,
      verifyUntil: null,
    });
    await this.settings.putSetting(SETTING_KEY, retired);
    await this.audit?.record({
      actorId: actor?.id ?? null,
      action: 'admin.signing_key.rotate',
      targetType: 'signing_key',
    });
    return retired.map(key => this.view(key));
  }

  async delete(id: string): Promise<AuthSigningKey[]> {
    const now = this.clock.now();
    const keys = await this.load();
    const target = keys.find(key => key.id === id);
    if (!target) {
      throw errors.badRequest('Signing key not found.');
    }
    if (target.status === 'active') {
      throw errors.actionForbidden('Cannot delete the active signing key.');
    }
    if (target.verifyUntil && target.verifyUntil.getTime() > now.getTime()) {
      throw errors.actionForbidden('Signing key is still in verify window.');
    }
    const next = keys.filter(key => key.id !== id);
    await this.settings.putSetting(SETTING_KEY, next);
    return next.map(key => this.view(key));
  }

  private view(key: StoredKey): AuthSigningKey {
    const now = this.clock.now();
    return {
      ...key,
      canDelete:
        key.status !== 'active' &&
        (!key.verifyUntil || key.verifyUntil.getTime() <= now.getTime()),
    };
  }

  private async load(): Promise<StoredKey[]> {
    const raw = await this.settings.getSetting(SETTING_KEY);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map(item => {
      const row = item as StoredKey;
      return {
        id: String(row.id),
        status: row.status === 'retired' ? 'retired' : 'active',
        source: String(row.source ?? 'generated'),
        createdAt: new Date(row.createdAt),
        retiredAt: row.retiredAt ? new Date(row.retiredAt) : null,
        verifyUntil: row.verifyUntil ? new Date(row.verifyUntil) : null,
      };
    });
  }
}

interface StoredKey {
  id: string;
  status: 'active' | 'retired';
  source: string;
  createdAt: Date;
  retiredAt: Date | null;
  verifyUntil: Date | null;
}
