import type { AppConfig } from '../config/env.js';
import type {
  HealthPort,
  HealthStatus,
  ServerInfo,
  ServerInfoPort,
} from '../domain/health.js';
import type { MosaicStore, RedisPort } from '../domain/ports.js';

export class HealthService implements ServerInfoPort, HealthPort {
  constructor(
    private readonly config: AppConfig,
    private readonly store?: MosaicStore,
    private readonly redis?: RedisPort | null
  ) {}

  getServerInfo(): ServerInfo {
    return {
      name: this.config.MOSAIC_SERVER_NAME,
      version: this.config.MOSAIC_SERVER_VERSION,
      compatibility: this.config.MOSAIC_COMPAT_VERSION,
      message: 'Mosaic Server',
      flavor: this.config.flavor,
      type: this.config.deploymentType,
      features: [...this.config.MOSAIC_FEATURES],
    };
  }

  liveness(): HealthStatus {
    return {
      status: 'ok',
      checks: { process: 'up' },
    };
  }

  async readiness(): Promise<HealthStatus> {
    const checks: Record<string, 'up' | 'down' | 'skipped'> = {
      process: 'up',
      postgres: 'skipped',
      redis: 'skipped',
    };

    if (!this.store) {
      return { status: 'ok', checks };
    }

    if (this.store.kind === 'memory') {
      checks.postgres = 'skipped';
    } else {
      try {
        checks.postgres = (await this.store.ping()) ? 'up' : 'down';
      } catch {
        checks.postgres = 'down';
      }
    }

    if (!this.config.REDIS_URL) {
      checks.redis = 'skipped';
    } else if (!this.redis) {
      checks.redis = 'down';
    } else {
      try {
        checks.redis = (await this.redis.ping()) ? 'up' : 'down';
      } catch {
        checks.redis = 'down';
      }
    }

    const status =
      checks.postgres === 'down' || checks.redis === 'down' ? 'error' : 'ok';
    return { status, checks };
  }
}
