import type { AuditService } from './audit-service.js';
import { sha256 } from './crypto.js';
import type { WorkspaceService } from './workspace-service.js';
import type {
  ByokLease,
  ByokProfile,
  ByokProvider,
  ByokUsagePoint,
} from '../domain/byok.js';
import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type { ByokStore, Clock } from '../domain/ports.js';

function cipher(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function fingerprint(definition: Record<string, unknown>): string {
  return sha256(JSON.stringify(definition)).slice(0, 16);
}

const CATALOG = {
  version: '1',
  providers: [
    {
      provider: 'openai' as ByokProvider,
      models: [
        {
          modelId: 'gpt-4o-mini',
          displayName: 'GPT-4o mini',
          recommended: true,
        },
      ],
    },
    {
      provider: 'anthropic' as ByokProvider,
      models: [
        {
          modelId: 'claude-sonnet-4-0',
          displayName: 'Claude Sonnet',
          recommended: true,
        },
      ],
    },
    {
      provider: 'gemini' as ByokProvider,
      models: [
        { modelId: 'gemini-2.0-flash', displayName: 'Gemini Flash', recommended: true },
      ],
    },
    {
      provider: 'fal' as ByokProvider,
      models: [{ modelId: 'fal-ai/flux', displayName: 'Flux', recommended: false }],
    },
  ],
};

export class ByokService {
  constructor(
    private readonly store: ByokStore,
    private readonly workspaces: WorkspaceService,
    private readonly clock: Clock,
    private readonly audit?: AuditService
  ) {}

  catalog() {
    return {
      version: CATALOG.version,
      providers: CATALOG.providers.map(provider => ({
        provider: provider.provider,
        models: provider.models.map(model => ({
          ...model,
          capabilities: [
            {
              input: ['text'],
              output: ['text'],
              features: ['tool_calling'],
              attachmentKinds: [],
              attachmentSources: [],
            },
          ],
        })),
      })),
    };
  }

  async settings(user: User, workspaceId: string) {
    await this.workspaces.requireMember(user, workspaceId);
    const profiles = await this.store.listByokProfiles(workspaceId);
    return {
      workspaceId,
      entitled: true,
      serverEntitled: true,
      localEntitled: false,
      policy: {
        enabled: true,
        allowedProviders: ['openai', 'anthropic', 'gemini', 'fal'] as ByokProvider[],
        customEndpointMode: 'enabled',
        privateEndpointSupported: false,
      },
      catalog: this.catalog(),
      profiles,
    };
  }

  async usage(
    user: User,
    workspaceId: string,
    from: Date,
    to: Date
  ): Promise<ByokUsagePoint[]> {
    await this.workspaces.requireMember(user, workspaceId);
    return this.store.listByokUsage(workspaceId, from, to);
  }

  async create(
    user: User,
    input: {
      workspaceId: string;
      provider: ByokProvider;
      name: string;
      description?: string | null;
      enabled: boolean;
      credential: string;
      definition: Record<string, unknown>;
    }
  ): Promise<ByokProfile> {
    await this.workspaces.requireAdmin(user, input.workspaceId);
    const existing = await this.store.listByokProfiles(input.workspaceId);
    const now = this.clock.now();
    const profile = await this.store.createByokProfile({
      profileId: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      provider: input.provider,
      name: input.name,
      description: input.description ?? null,
      enabled: input.enabled,
      sortOrder: existing.length,
      revision: 1,
      credentialCipher: cipher(input.credential),
      definition: input.definition,
      createdAt: now,
      updatedAt: now,
    });
    await this.audit?.record({
      workspaceId: input.workspaceId,
      actorId: user.id,
      action: 'ai.byok_create',
      targetType: 'byok_profile',
      targetId: profile.profileId,
      metadata: { provider: input.provider },
    });
    return profile;
  }

  async replace(
    user: User,
    input: {
      workspaceId: string;
      profileId: string;
      expectedRevision: number;
      name: string;
      description?: string | null;
      enabled: boolean;
      credential?: string | null;
      definition: Record<string, unknown>;
    }
  ): Promise<ByokProfile> {
    await this.workspaces.requireAdmin(user, input.workspaceId);
    const current = await this.requireProfile(input.workspaceId, input.profileId);
    if (current.revision !== input.expectedRevision) {
      throw errors.badRequest('BYOK profile revision mismatch.');
    }
    return this.store.updateByokProfile(input.profileId, {
      name: input.name,
      description: input.description ?? current.description,
      enabled: input.enabled,
      definition: input.definition,
      revision: current.revision + 1,
      ...(input.credential
        ? { credentialCipher: cipher(input.credential) }
        : {}),
      updatedAt: this.clock.now(),
    });
  }

  async rotate(
    user: User,
    input: {
      workspaceId: string;
      profileId: string;
      expectedRevision: number;
      credential: string;
    }
  ): Promise<ByokProfile> {
    await this.workspaces.requireAdmin(user, input.workspaceId);
    const current = await this.requireProfile(input.workspaceId, input.profileId);
    if (current.revision !== input.expectedRevision) {
      throw errors.badRequest('BYOK profile revision mismatch.');
    }
    return this.store.updateByokProfile(input.profileId, {
      credentialCipher: cipher(input.credential),
      revision: current.revision + 1,
      updatedAt: this.clock.now(),
    });
  }

  async remove(
    user: User,
    workspaceId: string,
    profileId: string
  ): Promise<boolean> {
    await this.workspaces.requireAdmin(user, workspaceId);
    await this.requireProfile(workspaceId, profileId);
    return this.store.deleteByokProfile(profileId);
  }

  async reorder(
    user: User,
    input: {
      workspaceId: string;
      profiles: Array<{ profileId: string; expectedRevision: number }>;
    }
  ): Promise<ByokProfile[]> {
    await this.workspaces.requireAdmin(user, input.workspaceId);
    const updated: ByokProfile[] = [];
    for (const [index, item] of input.profiles.entries()) {
      const current = await this.requireProfile(input.workspaceId, item.profileId);
      if (current.revision !== item.expectedRevision) {
        throw errors.badRequest('BYOK profile revision mismatch.');
      }
      updated.push(
        await this.store.updateByokProfile(item.profileId, {
          sortOrder: index,
          revision: current.revision + 1,
          updatedAt: this.clock.now(),
        })
      );
    }
    return updated;
  }

  async probe(
    user: User,
    workspaceId: string,
    definition: Record<string, unknown>
  ) {
    await this.workspaces.requireMember(user, workspaceId);
    const now = this.clock.now();
    return {
      definitionFingerprint: fingerprint(definition),
      stale: false,
      connection: { kind: 'verified', testedAt: now, errorKind: null },
      models: [
        {
          modelId: 'default',
          checks: [
            {
              operation: 'chat',
              status: { kind: 'verified', testedAt: now, errorKind: null },
            },
          ],
        },
      ],
    };
  }

  async lease(
    user: User,
    workspaceId: string
  ): Promise<ByokLease> {
    await this.workspaces.requireAdmin(user, workspaceId);
    return this.store.createByokLease({
      leaseId: crypto.randomUUID(),
      workspaceId,
      expiresAt: new Date(this.clock.now().getTime() + 15 * 60 * 1000),
    });
  }

  async activeCredential(
    workspaceId: string
  ): Promise<{ apiKey: string; baseUrl?: string } | null> {
    const profiles = await this.store.listByokProfiles(workspaceId);
    const enabled = profiles.find(profile => profile.enabled);
    if (!enabled) {
      return null;
    }
    const endpoint = enabled.definition['endpoint'] as
      | { url?: string }
      | undefined;
    return {
      apiKey: Buffer.from(enabled.credentialCipher, 'base64').toString('utf8'),
      ...(endpoint?.url ? { baseUrl: endpoint.url } : {}),
    };
  }

  gqlProfile(profile: ByokProfile) {
    const now = this.clock.now();
    const definition = profile.definition as {
      endpoint?: { kind?: string; url?: string; dialect?: string };
      models?: Array<{
        modelId: string;
        enabled: boolean;
        capabilities?: unknown[];
      }>;
    };
    return {
      profileId: profile.profileId,
      workspaceId: profile.workspaceId,
      provider: profile.provider,
      name: profile.name,
      description: profile.description,
      enabled: profile.enabled,
      sortOrder: profile.sortOrder,
      revision: profile.revision,
      definition: {
        endpoint: {
          kind: definition.endpoint?.kind ?? 'provider_default',
          url: definition.endpoint?.url ?? null,
          dialect: definition.endpoint?.dialect ?? null,
        },
        models: (definition.models ?? []).map(model => ({
          modelId: model.modelId,
          enabled: model.enabled,
          capabilities: model.capabilities ?? [
            {
              input: ['text'],
              output: ['text'],
              features: [],
              attachmentKinds: [],
              attachmentSources: [],
            },
          ],
        })),
      },
      validation: {
        definitionFingerprint: fingerprint(profile.definition),
        credentialGeneration: profile.revision,
        connection: { kind: 'not_tested', testedAt: now, errorKind: null },
        models: [],
      },
    };
  }

  private async requireProfile(
    workspaceId: string,
    profileId: string
  ): Promise<ByokProfile> {
    const profile = await this.store.getByokProfile(profileId);
    if (!profile || profile.workspaceId !== workspaceId) {
      throw errors.badRequest('BYOK profile not found.');
    }
    return profile;
  }
}
