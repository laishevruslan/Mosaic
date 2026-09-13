import type { AppConfig } from '../config/env.js';
import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type { InstanceSettingsStore } from '../domain/ports.js';
import { hasFeature } from '../config/env.js';

const OVERLAY_KEY = 'app_config_overlay';

const SECRET_KEYS = new Set([
  'mailer.SMTP.password',
  'storages.blob.storage.config',
  'storages.avatar.storage.config',
  'oauth.providers.google',
  'oauth.providers.github',
  'oauth.providers.apple',
  'indexer.provider.apiKey',
  'indexer.provider.password',
]);

export interface AppConfigUpdate {
  module: string;
  key: string;
  value: unknown;
}

export interface AppConfigValidateRow {
  module: string;
  key: string;
  value: unknown;
  valid: boolean;
  error: string | null;
}

type Overlay = Record<string, unknown>;

export class AppConfigService {
  constructor(
    private readonly live: AppConfig,
    private readonly settings: InstanceSettingsStore,
    private readonly extras: {
      smtpConfigured: () => boolean;
      redisConfigured: boolean;
      aiConfigured: boolean;
      blobDriver: string;
    }
  ) {}

  async read(user: User): Promise<Record<string, unknown>> {
    this.assertAdmin(user);
    const overlay = await this.overlay();
    const smtpHost = this.stringOverlay(overlay, 'mailer.SMTP.host') ?? this.live.SMTP_HOST;
    return {
      server: {
        name:
          this.stringOverlay(overlay, 'server.name') ??
          this.live.MOSAIC_SERVER_NAME,
        externalUrl:
          this.stringOverlay(overlay, 'server.externalUrl') ??
          this.live.MOSAIC_PUBLIC_URL,
        hosts: [],
      },
      auth: {
        allowSignup: this.boolOverlay(overlay, 'auth.allowSignup') ?? this.live.allowSignup,
        allowSignupForOauth:
          this.boolOverlay(overlay, 'auth.allowSignupForOauth') ?? this.live.allowSignup,
        passwordRequirements: {
          min:
            this.numberOverlay(overlay, 'auth.passwordRequirements.min') ??
            this.live.PASSWORD_MIN_LENGTH,
          max:
            this.numberOverlay(overlay, 'auth.passwordRequirements.max') ??
            this.live.PASSWORD_MAX_LENGTH,
        },
        session: {
          ttl: Math.floor(this.live.SESSION_IDLE_MS / 1000),
        },
      },
      flags: {
        features: [...this.live.MOSAIC_FEATURES],
        mosaicServer: hasFeature(this.live, 'mosaic'),
      },
      mailer: {
        SMTP: {
          name: this.stringOverlay(overlay, 'mailer.SMTP.name') ?? 'Mosaic',
          host: smtpHost ?? '',
          port:
            this.numberOverlay(overlay, 'mailer.SMTP.port') ?? this.live.SMTP_PORT,
          username: this.stringOverlay(overlay, 'mailer.SMTP.username') ?? this.live.SMTP_USER ?? '',
          password: '',
          ignoreTLS:
            this.boolOverlay(overlay, 'mailer.SMTP.ignoreTLS') ??
            this.live.smtpIgnoreTls,
          sender:
            this.stringOverlay(overlay, 'mailer.SMTP.sender') ??
            this.live.SMTP_FROM ??
            '',
          configured: this.extras.smtpConfigured(),
        },
      },
      storages: {
        blob: {
          storage: {
            provider: this.extras.blobDriver,
            bucket: this.live.S3_BUCKET ?? '',
            config: {
              configured: Boolean(this.live.S3_ACCESS_KEY_ID),
            },
          },
        },
      },
      copilot: {
        enabled: this.extras.aiConfigured,
        configured: this.extras.aiConfigured,
      },
      indexer: {
        provider: {
          type: 'embedded',
          configured: true,
        },
      },
      oauth: {
        providers: {
          oidc: {
            configured: Boolean(this.live.MOSAIC_OIDC_ISSUER),
          },
        },
      },
      redis: {
        configured: this.extras.redisConfigured,
      },
    };
  }

  async validate(
    user: User,
    updates: AppConfigUpdate[]
  ): Promise<AppConfigValidateRow[]> {
    this.assertAdmin(user);
    return updates.map(update => this.validateOne(update));
  }

  async update(
    user: User,
    updates: AppConfigUpdate[]
  ): Promise<Record<string, unknown>> {
    this.assertAdmin(user);
    const overlay = await this.overlay();
    for (const update of updates) {
      const result = this.validateOne(update);
      if (!result.valid) {
        throw errors.badRequest(
          result.error ?? `Invalid config ${update.module}.${update.key}`
        );
      }
      const path = `${update.module}.${update.key}`;
      if (SECRET_KEYS.has(path)) {
        continue;
      }
      overlay[path] = update.value;
      this.applyLive(path, update.value);
    }
    await this.settings.putSetting(OVERLAY_KEY, overlay);
    return this.read(user);
  }

  private validateOne(update: AppConfigUpdate): AppConfigValidateRow {
    const path = `${update.module}.${update.key}`;
    if (SECRET_KEYS.has(path)) {
      return {
        module: update.module,
        key: update.key,
        value: update.value,
        valid: false,
        error: 'Secrets are env-only and cannot be stored from GraphQL.',
      };
    }
    if (path === 'auth.allowSignup' && typeof update.value !== 'boolean') {
      return invalid(update, 'Expected boolean.');
    }
    if (
      path === 'auth.passwordRequirements.min' &&
      typeof update.value !== 'number'
    ) {
      return invalid(update, 'Expected number.');
    }
    if (
      path === 'auth.passwordRequirements.max' &&
      typeof update.value !== 'number'
    ) {
      return invalid(update, 'Expected number.');
    }
    if (path === 'server.name' && typeof update.value !== 'string') {
      return invalid(update, 'Expected string.');
    }
    if (path === 'server.externalUrl' && typeof update.value !== 'string') {
      return invalid(update, 'Expected string.');
    }
    return {
      module: update.module,
      key: update.key,
      value: update.value,
      valid: true,
      error: null,
    };
  }

  private applyLive(path: string, value: unknown): void {
    if (path === 'auth.allowSignup' && typeof value === 'boolean') {
      this.live.allowSignup = value;
    }
    if (path === 'auth.passwordRequirements.min' && typeof value === 'number') {
      this.live.PASSWORD_MIN_LENGTH = value;
    }
    if (path === 'auth.passwordRequirements.max' && typeof value === 'number') {
      this.live.PASSWORD_MAX_LENGTH = value;
    }
    if (path === 'server.name' && typeof value === 'string') {
      this.live.MOSAIC_SERVER_NAME = value;
    }
    if (path === 'server.externalUrl' && typeof value === 'string') {
      this.live.MOSAIC_PUBLIC_URL = value;
    }
  }

  private async overlay(): Promise<Overlay> {
    const stored = await this.settings.getSetting(OVERLAY_KEY);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return { ...(stored as Overlay) };
    }
    return {};
  }

  private stringOverlay(overlay: Overlay, path: string): string | undefined {
    const value = overlay[path];
    return typeof value === 'string' ? value : undefined;
  }

  private boolOverlay(overlay: Overlay, path: string): boolean | undefined {
    const value = overlay[path];
    return typeof value === 'boolean' ? value : undefined;
  }

  private numberOverlay(overlay: Overlay, path: string): number | undefined {
    const value = overlay[path];
    return typeof value === 'number' ? value : undefined;
  }

  private assertAdmin(user: User): void {
    if (!user.features.includes('Admin')) {
      throw errors.accessDenied();
    }
  }
}

function invalid(
  update: AppConfigUpdate,
  error: string
): AppConfigValidateRow {
  return {
    module: update.module,
    key: update.key,
    value: update.value,
    valid: false,
    error,
  };
}
