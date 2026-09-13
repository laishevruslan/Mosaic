import type { ApiToken } from '../../domain/api-token.js';
import type { ByokLease, ByokProfile, ByokUsagePoint } from '../../domain/byok.js';
import type {
  CalendarAccount,
  CalendarEvent,
  CalendarSubscription,
  WorkspaceCalendar,
  WorkspaceCalendarItem,
} from '../../domain/calendar.js';
import type {
  EmbeddingArtifact,
  EmbeddingChunk,
  EmbeddingIgnoredDoc,
  EmbeddingProgress,
} from '../../domain/embedding.js';
import type { McpCredential } from '../../domain/mcp.js';
import type {
  ApiTokenStore,
  ByokStore,
  CalendarStore,
  EmbeddingStore,
  McpStore,
} from '../../domain/ports.js';
import { MemoryE0Store } from './e0-memory.js';

function cloneMcp(row: McpCredential): McpCredential {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    expiresAt: new Date(row.expiresAt),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
    graceEndsAt: row.graceEndsAt ? new Date(row.graceEndsAt) : null,
  };
}

function cloneAccount(row: CalendarAccount): CalendarAccount {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneSub(row: CalendarSubscription): CalendarSubscription {
  return {
    ...row,
    lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt) : null,
  };
}

function cloneEvent(row: CalendarEvent): CalendarEvent {
  return {
    ...row,
    startAtUtc: new Date(row.startAtUtc),
    endAtUtc: new Date(row.endAtUtc),
  };
}

function cloneProfile(row: ByokProfile): ByokProfile {
  return {
    ...row,
    definition: { ...row.definition },
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export class MemoryE2Store
  extends MemoryE0Store
  implements McpStore, CalendarStore, EmbeddingStore, ByokStore, ApiTokenStore
{
  private readonly mcp = new Map<string, McpCredential>();
  private readonly calendarAccounts = new Map<string, CalendarAccount>();
  private readonly calendarSubs = new Map<string, CalendarSubscription>();
  private readonly calendarEvents = new Map<string, CalendarEvent>();
  private readonly workspaceCalendars = new Map<string, WorkspaceCalendar>();
  private readonly workspaceCalendarItems = new Map<
    string,
    WorkspaceCalendarItem[]
  >();
  private readonly embeddingChunks = new Map<string, EmbeddingChunk[]>();
  private readonly ignoredDocs = new Map<string, EmbeddingIgnoredDoc>();
  private readonly artifacts = new Map<string, EmbeddingArtifact>();
  private readonly embeddingProgress = new Map<string, EmbeddingProgress>();
  private readonly byokProfiles = new Map<string, ByokProfile>();
  private readonly byokLeases = new Map<string, ByokLease>();
  private readonly byokUsage: ByokUsagePoint[] = [];
  private readonly apiTokens = new Map<string, ApiToken>();

  async createMcpCredential(credential: McpCredential): Promise<McpCredential> {
    const saved = cloneMcp(credential);
    this.mcp.set(saved.id, saved);
    return cloneMcp(saved);
  }

  async getMcpCredential(id: string): Promise<McpCredential | null> {
    const row = this.mcp.get(id);
    return row ? cloneMcp(row) : null;
  }

  async findMcpCredentialByHash(
    tokenHash: string
  ): Promise<McpCredential | null> {
    for (const row of this.mcp.values()) {
      if (row.tokenHash === tokenHash) {
        return cloneMcp(row);
      }
    }
    return null;
  }

  async listMcpCredentials(workspaceId: string): Promise<McpCredential[]> {
    return [...this.mcp.values()]
      .filter(row => row.workspaceId === workspaceId)
      .map(cloneMcp);
  }

  async updateMcpCredential(
    id: string,
    patch: Partial<
      Pick<
        McpCredential,
        | 'tokenHash'
        | 'fingerprint'
        | 'expiresAt'
        | 'lastUsedAt'
        | 'revokedAt'
        | 'graceEndsAt'
      >
    >
  ): Promise<McpCredential> {
    const current = this.mcp.get(id);
    if (!current) {
      throw new Error('MCP credential not found');
    }
    const next = cloneMcp({ ...current, ...patch });
    this.mcp.set(id, next);
    return cloneMcp(next);
  }

  async createCalendarAccount(
    account: CalendarAccount
  ): Promise<CalendarAccount> {
    const saved = cloneAccount(account);
    this.calendarAccounts.set(saved.id, saved);
    return cloneAccount(saved);
  }

  async getCalendarAccount(id: string): Promise<CalendarAccount | null> {
    const row = this.calendarAccounts.get(id);
    return row ? cloneAccount(row) : null;
  }

  async listCalendarAccounts(userId: string): Promise<CalendarAccount[]> {
    return [...this.calendarAccounts.values()]
      .filter(row => row.userId === userId)
      .map(cloneAccount);
  }

  async updateCalendarAccount(
    id: string,
    patch: Partial<
      Pick<
        CalendarAccount,
        | 'displayName'
        | 'email'
        | 'status'
        | 'lastError'
        | 'refreshIntervalMinutes'
        | 'tokenCipher'
        | 'updatedAt'
      >
    >
  ): Promise<CalendarAccount> {
    const current = this.calendarAccounts.get(id);
    if (!current) {
      throw new Error('Calendar account not found');
    }
    const next = cloneAccount({ ...current, ...patch });
    this.calendarAccounts.set(id, next);
    return cloneAccount(next);
  }

  async deleteCalendarAccount(id: string): Promise<boolean> {
    for (const sub of [...this.calendarSubs.values()]) {
      if (sub.accountId === id) {
        this.calendarSubs.delete(sub.id);
        for (const event of [...this.calendarEvents.values()]) {
          if (event.subscriptionId === sub.id) {
            this.calendarEvents.delete(event.id);
          }
        }
      }
    }
    return this.calendarAccounts.delete(id);
  }

  async createCalendarSubscription(
    sub: CalendarSubscription
  ): Promise<CalendarSubscription> {
    const saved = cloneSub(sub);
    this.calendarSubs.set(saved.id, saved);
    return cloneSub(saved);
  }

  async listCalendarSubscriptions(
    accountId: string
  ): Promise<CalendarSubscription[]> {
    return [...this.calendarSubs.values()]
      .filter(row => row.accountId === accountId)
      .map(cloneSub);
  }

  async getCalendarSubscription(
    id: string
  ): Promise<CalendarSubscription | null> {
    const row = this.calendarSubs.get(id);
    return row ? cloneSub(row) : null;
  }

  async upsertCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const saved = cloneEvent(event);
    this.calendarEvents.set(saved.id, saved);
    return cloneEvent(saved);
  }

  async listCalendarEvents(
    subscriptionId: string,
    from: Date,
    to: Date
  ): Promise<CalendarEvent[]> {
    return [...this.calendarEvents.values()]
      .filter(
        row =>
          row.subscriptionId === subscriptionId &&
          row.startAtUtc >= from &&
          row.startAtUtc <= to
      )
      .map(cloneEvent);
  }

  async getWorkspaceCalendar(
    workspaceId: string
  ): Promise<WorkspaceCalendar | null> {
    const row = [...this.workspaceCalendars.values()].find(
      item => item.workspaceId === workspaceId
    );
    return row ? { ...row } : null;
  }

  async upsertWorkspaceCalendar(
    calendar: WorkspaceCalendar
  ): Promise<WorkspaceCalendar> {
    this.workspaceCalendars.set(calendar.id, { ...calendar });
    return { ...calendar };
  }

  async replaceWorkspaceCalendarItems(
    workspaceCalendarId: string,
    items: WorkspaceCalendarItem[]
  ): Promise<WorkspaceCalendarItem[]> {
    const saved = items.map(item => ({ ...item }));
    this.workspaceCalendarItems.set(workspaceCalendarId, saved);
    return saved.map(item => ({ ...item }));
  }

  async listWorkspaceCalendarItems(
    workspaceCalendarId: string
  ): Promise<WorkspaceCalendarItem[]> {
    return (this.workspaceCalendarItems.get(workspaceCalendarId) ?? []).map(
      item => ({ ...item })
    );
  }

  async replaceEmbeddingChunks(
    workspaceId: string,
    docId: string,
    chunks: EmbeddingChunk[]
  ): Promise<void> {
    const key = `${workspaceId}:${docId}`;
    this.embeddingChunks.set(
      key,
      chunks.map(chunk => ({ ...chunk, vector: [...chunk.vector] }))
    );
  }

  async listEmbeddingChunks(workspaceId: string): Promise<EmbeddingChunk[]> {
    const out: EmbeddingChunk[] = [];
    for (const [key, chunks] of this.embeddingChunks) {
      if (key.startsWith(`${workspaceId}:`)) {
        out.push(
          ...chunks.map(chunk => ({ ...chunk, vector: [...chunk.vector] }))
        );
      }
    }
    return out;
  }

  async countEmbeddingChunks(): Promise<number> {
    let total = 0;
    for (const chunks of this.embeddingChunks.values()) {
      total += chunks.length;
    }
    return total;
  }

  async addIgnoredDocs(docs: EmbeddingIgnoredDoc[]): Promise<number> {
    for (const doc of docs) {
      this.ignoredDocs.set(`${doc.workspaceId}:${doc.docId}`, { ...doc });
    }
    return docs.length;
  }

  async removeIgnoredDocs(
    workspaceId: string,
    docIds: string[]
  ): Promise<number> {
    let removed = 0;
    for (const docId of docIds) {
      if (this.ignoredDocs.delete(`${workspaceId}:${docId}`)) {
        removed += 1;
      }
    }
    return removed;
  }

  async listIgnoredDocs(workspaceId: string): Promise<EmbeddingIgnoredDoc[]> {
    return [...this.ignoredDocs.values()]
      .filter(row => row.workspaceId === workspaceId)
      .map(row => ({ ...row }));
  }

  async isIgnoredDoc(workspaceId: string, docId: string): Promise<boolean> {
    return this.ignoredDocs.has(`${workspaceId}:${docId}`);
  }

  async createArtifact(
    artifact: EmbeddingArtifact
  ): Promise<EmbeddingArtifact> {
    this.artifacts.set(artifact.artifactId, { ...artifact });
    return { ...artifact };
  }

  async getArtifact(artifactId: string): Promise<EmbeddingArtifact | null> {
    const row = this.artifacts.get(artifactId);
    return row ? { ...row } : null;
  }

  async listArtifacts(workspaceId: string): Promise<EmbeddingArtifact[]> {
    return [...this.artifacts.values()]
      .filter(row => row.workspaceId === workspaceId)
      .map(row => ({ ...row }));
  }

  async deleteArtifact(artifactId: string): Promise<boolean> {
    return this.artifacts.delete(artifactId);
  }

  async getEmbeddingProgress(workspaceId: string): Promise<EmbeddingProgress> {
    return (
      this.embeddingProgress.get(workspaceId) ?? {
        workspaceId,
        total: 0,
        embedded: 0,
      }
    );
  }

  async setEmbeddingProgress(progress: EmbeddingProgress): Promise<void> {
    this.embeddingProgress.set(progress.workspaceId, { ...progress });
  }

  async createByokProfile(profile: ByokProfile): Promise<ByokProfile> {
    const saved = cloneProfile(profile);
    this.byokProfiles.set(saved.profileId, saved);
    return cloneProfile(saved);
  }

  async getByokProfile(profileId: string): Promise<ByokProfile | null> {
    const row = this.byokProfiles.get(profileId);
    return row ? cloneProfile(row) : null;
  }

  async listByokProfiles(workspaceId: string): Promise<ByokProfile[]> {
    return [...this.byokProfiles.values()]
      .filter(row => row.workspaceId === workspaceId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(cloneProfile);
  }

  async updateByokProfile(
    profileId: string,
    patch: Partial<Omit<ByokProfile, 'profileId' | 'workspaceId' | 'createdAt'>>
  ): Promise<ByokProfile> {
    const current = this.byokProfiles.get(profileId);
    if (!current) {
      throw new Error('BYOK profile not found');
    }
    const next = cloneProfile({ ...current, ...patch });
    this.byokProfiles.set(profileId, next);
    return cloneProfile(next);
  }

  async deleteByokProfile(profileId: string): Promise<boolean> {
    return this.byokProfiles.delete(profileId);
  }

  async createByokLease(lease: ByokLease): Promise<ByokLease> {
    this.byokLeases.set(lease.leaseId, { ...lease });
    return { ...lease, expiresAt: new Date(lease.expiresAt) };
  }

  async addByokUsage(
    workspaceId: string,
    date: Date,
    featureKind: string,
    tokens: number
  ): Promise<void> {
    this.byokUsage.push({
      date: new Date(date),
      featureKind: `${workspaceId}:${featureKind}`,
      totalTokens: tokens,
    });
  }

  async listByokUsage(
    workspaceId: string,
    from: Date,
    to: Date
  ): Promise<ByokUsagePoint[]> {
    const prefix = `${workspaceId}:`;
    return this.byokUsage
      .filter(
        row =>
          row.featureKind.startsWith(prefix) &&
          row.date >= from &&
          row.date <= to
      )
      .map(row => ({
        date: new Date(row.date),
        featureKind: row.featureKind.slice(prefix.length),
        totalTokens: row.totalTokens,
      }));
  }

  async createApiToken(token: ApiToken): Promise<ApiToken> {
    this.apiTokens.set(token.id, {
      ...token,
      scopes: [...token.scopes],
    });
    return {
      ...token,
      scopes: [...token.scopes],
      createdAt: new Date(token.createdAt),
      lastUsedAt: token.lastUsedAt ? new Date(token.lastUsedAt) : null,
      revokedAt: token.revokedAt ? new Date(token.revokedAt) : null,
    };
  }

  async getApiToken(id: string): Promise<ApiToken | null> {
    const row = this.apiTokens.get(id);
    return row
      ? {
          ...row,
          scopes: [...row.scopes],
          createdAt: new Date(row.createdAt),
          lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
          revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
        }
      : null;
  }

  async findApiTokenByHash(tokenHash: string): Promise<ApiToken | null> {
    for (const row of this.apiTokens.values()) {
      if (row.tokenHash === tokenHash) {
        return this.getApiToken(row.id);
      }
    }
    return null;
  }

  async listApiTokens(userId: string): Promise<ApiToken[]> {
    const out: ApiToken[] = [];
    for (const row of this.apiTokens.values()) {
      if (row.userId === userId) {
        const token = await this.getApiToken(row.id);
        if (token) {
          out.push(token);
        }
      }
    }
    return out;
  }

  async updateApiToken(
    id: string,
    patch: Partial<Pick<ApiToken, 'lastUsedAt' | 'revokedAt'>>
  ): Promise<ApiToken> {
    const current = this.apiTokens.get(id);
    if (!current) {
      throw new Error('API token not found');
    }
    const next = { ...current, ...patch };
    this.apiTokens.set(id, next);
    return (await this.getApiToken(id))!;
  }
}
