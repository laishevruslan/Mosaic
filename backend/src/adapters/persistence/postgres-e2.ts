import type postgres from 'postgres';

import type { ApiToken, ApiTokenScope } from '../../domain/api-token.js';
import type { ByokLease, ByokProfile, ByokUsagePoint } from '../../domain/byok.js';
import type {
  CalendarAccount,
  CalendarEvent,
  CalendarProvider,
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
import type { McpAccessMode, McpCredential } from '../../domain/mcp.js';
import type {
  ApiTokenStore,
  ByokStore,
  CalendarStore,
  EmbeddingStore,
  McpStore,
} from '../../domain/ports.js';
import { PostgresE0Store } from './postgres-e0.js';

interface McpRow {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  access_mode: McpAccessMode;
  token_hash: string;
  fingerprint: string;
  created_at: Date;
  expires_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
  grace_ends_at: Date | null;
}

interface AccountRow {
  id: string;
  user_id: string;
  provider: CalendarProvider;
  provider_account_id: string;
  display_name: string | null;
  email: string | null;
  status: string;
  last_error: string | null;
  refresh_interval_minutes: number;
  token_cipher: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SubRow {
  id: string;
  account_id: string;
  provider: CalendarProvider;
  external_calendar_id: string;
  display_name: string | null;
  timezone: string | null;
  color: string | null;
  enabled: boolean;
  last_sync_at: Date | null;
}

interface EventRow {
  id: string;
  subscription_id: string;
  external_event_id: string;
  recurrence_id: string | null;
  status: string | null;
  title: string | null;
  description: string | null;
  location: string | null;
  start_at_utc: Date;
  end_at_utc: Date;
  original_timezone: string | null;
  all_day: boolean;
}

interface WsCalRow {
  id: string;
  workspace_id: string;
  created_by_user_id: string;
  display_name_override: string | null;
  color_override: string | null;
  enabled: boolean;
}

interface WsCalItemRow {
  id: string;
  workspace_calendar_id: string;
  subscription_id: string;
  sort_order: number | null;
  color_override: string | null;
  enabled: boolean;
}

interface ChunkRow {
  id: string;
  workspace_id: string;
  doc_id: string;
  ordinal: number;
  text: string;
  vector: number[];
  created_at: Date;
}

interface IgnoredRow {
  workspace_id: string;
  doc_id: string;
  created_by: string | null;
  created_at: Date;
}

interface ArtifactRow {
  artifact_id: string;
  workspace_id: string;
  file_name: string;
  media_type: string;
  size: string | number;
  content_hash: string;
  embedding_status: string;
  created_at: Date;
}

interface ProgressRow {
  workspace_id: string;
  total: number;
  embedded: number;
}

interface ByokRow {
  profile_id: string;
  workspace_id: string;
  provider: ByokProfile['provider'];
  name: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
  revision: number;
  credential_cipher: string;
  definition: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface TokenRow {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  fingerprint: string;
  scopes: string[];
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

function mapMcp(row: McpRow): McpCredential {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    name: row.name,
    accessMode: row.access_mode,
    tokenHash: row.token_hash,
    fingerprint: row.fingerprint,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    graceEndsAt: row.grace_ends_at,
  };
}

function mapAccount(row: AccountRow): CalendarAccount {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    displayName: row.display_name,
    email: row.email,
    status: row.status,
    lastError: row.last_error,
    refreshIntervalMinutes: row.refresh_interval_minutes,
    tokenCipher: row.token_cipher,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSub(row: SubRow): CalendarSubscription {
  return {
    id: row.id,
    accountId: row.account_id,
    provider: row.provider,
    externalCalendarId: row.external_calendar_id,
    displayName: row.display_name,
    timezone: row.timezone,
    color: row.color,
    enabled: row.enabled,
    lastSyncAt: row.last_sync_at,
  };
}

function mapEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    externalEventId: row.external_event_id,
    recurrenceId: row.recurrence_id,
    status: row.status,
    title: row.title,
    description: row.description,
    location: row.location,
    startAtUtc: row.start_at_utc,
    endAtUtc: row.end_at_utc,
    originalTimezone: row.original_timezone,
    allDay: row.all_day,
  };
}

function mapProfile(row: ByokRow): ByokProfile {
  return {
    profileId: row.profile_id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    revision: row.revision,
    credentialCipher: row.credential_cipher,
    definition: row.definition,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapToken(row: TokenRow): ApiToken {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    tokenHash: row.token_hash,
    fingerprint: row.fingerprint,
    scopes: row.scopes as ApiTokenScope[],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

function asJson(value: unknown): postgres.JSONValue {
  const serialized = JSON.parse(
    JSON.stringify(value ?? null)
  ) as postgres.JSONValue;
  if (serialized !== null && typeof serialized === 'object') {
    return serialized;
  }
  return { value: serialized };
}

export class PostgresE2Store
  extends PostgresE0Store
  implements McpStore, CalendarStore, EmbeddingStore, ByokStore, ApiTokenStore
{
  constructor(sql: postgres.Sql) {
    super(sql);
  }

  async createMcpCredential(credential: McpCredential): Promise<McpCredential> {
    await this.sql`
      INSERT INTO mcp_credentials (
        id, workspace_id, user_id, name, access_mode, token_hash, fingerprint,
        created_at, expires_at, last_used_at, revoked_at, grace_ends_at
      ) VALUES (
        ${credential.id}, ${credential.workspaceId}, ${credential.userId},
        ${credential.name}, ${credential.accessMode}, ${credential.tokenHash},
        ${credential.fingerprint}, ${credential.createdAt}, ${credential.expiresAt},
        ${credential.lastUsedAt}, ${credential.revokedAt}, ${credential.graceEndsAt}
      )
    `;
    return credential;
  }

  async getMcpCredential(id: string): Promise<McpCredential | null> {
    const [row] = await this.sql<McpRow[]>`
      SELECT * FROM mcp_credentials WHERE id = ${id}
    `;
    return row ? mapMcp(row) : null;
  }

  async findMcpCredentialByHash(
    tokenHash: string
  ): Promise<McpCredential | null> {
    const [row] = await this.sql<McpRow[]>`
      SELECT * FROM mcp_credentials WHERE token_hash = ${tokenHash}
    `;
    return row ? mapMcp(row) : null;
  }

  async listMcpCredentials(workspaceId: string): Promise<McpCredential[]> {
    const rows = await this.sql<McpRow[]>`
      SELECT * FROM mcp_credentials WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
    `;
    return rows.map(mapMcp);
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
    const current = await this.getMcpCredential(id);
    if (!current) {
      throw new Error('MCP credential not found');
    }
    const next = { ...current, ...patch };
    await this.sql`
      UPDATE mcp_credentials SET
        token_hash = ${next.tokenHash},
        fingerprint = ${next.fingerprint},
        expires_at = ${next.expiresAt},
        last_used_at = ${next.lastUsedAt},
        revoked_at = ${next.revokedAt},
        grace_ends_at = ${next.graceEndsAt}
      WHERE id = ${id}
    `;
    return next;
  }

  async createCalendarAccount(
    account: CalendarAccount
  ): Promise<CalendarAccount> {
    await this.sql`
      INSERT INTO calendar_accounts (
        id, user_id, provider, provider_account_id, display_name, email, status,
        last_error, refresh_interval_minutes, token_cipher, created_at, updated_at
      ) VALUES (
        ${account.id}, ${account.userId}, ${account.provider}, ${account.providerAccountId},
        ${account.displayName}, ${account.email}, ${account.status}, ${account.lastError},
        ${account.refreshIntervalMinutes}, ${account.tokenCipher}, ${account.createdAt},
        ${account.updatedAt}
      )
    `;
    return account;
  }

  async getCalendarAccount(id: string): Promise<CalendarAccount | null> {
    const [row] = await this.sql<AccountRow[]>`
      SELECT * FROM calendar_accounts WHERE id = ${id}
    `;
    return row ? mapAccount(row) : null;
  }

  async listCalendarAccounts(userId: string): Promise<CalendarAccount[]> {
    const rows = await this.sql<AccountRow[]>`
      SELECT * FROM calendar_accounts WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return rows.map(mapAccount);
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
    const current = await this.getCalendarAccount(id);
    if (!current) {
      throw new Error('Calendar account not found');
    }
    const next = { ...current, ...patch };
    await this.sql`
      UPDATE calendar_accounts SET
        display_name = ${next.displayName},
        email = ${next.email},
        status = ${next.status},
        last_error = ${next.lastError},
        refresh_interval_minutes = ${next.refreshIntervalMinutes},
        token_cipher = ${next.tokenCipher},
        updated_at = ${next.updatedAt}
      WHERE id = ${id}
    `;
    return next;
  }

  async deleteCalendarAccount(id: string): Promise<boolean> {
    const result = await this.sql`DELETE FROM calendar_accounts WHERE id = ${id}`;
    return result.count > 0;
  }

  async createCalendarSubscription(
    sub: CalendarSubscription
  ): Promise<CalendarSubscription> {
    await this.sql`
      INSERT INTO calendar_subscriptions (
        id, account_id, provider, external_calendar_id, display_name, timezone,
        color, enabled, last_sync_at
      ) VALUES (
        ${sub.id}, ${sub.accountId}, ${sub.provider}, ${sub.externalCalendarId},
        ${sub.displayName}, ${sub.timezone}, ${sub.color}, ${sub.enabled},
        ${sub.lastSyncAt}
      )
    `;
    return sub;
  }

  async listCalendarSubscriptions(
    accountId: string
  ): Promise<CalendarSubscription[]> {
    const rows = await this.sql<SubRow[]>`
      SELECT * FROM calendar_subscriptions WHERE account_id = ${accountId}
    `;
    return rows.map(mapSub);
  }

  async getCalendarSubscription(
    id: string
  ): Promise<CalendarSubscription | null> {
    const [row] = await this.sql<SubRow[]>`
      SELECT * FROM calendar_subscriptions WHERE id = ${id}
    `;
    return row ? mapSub(row) : null;
  }

  async upsertCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    await this.sql`
      INSERT INTO calendar_events (
        id, subscription_id, external_event_id, recurrence_id, status, title,
        description, location, start_at_utc, end_at_utc, original_timezone, all_day
      ) VALUES (
        ${event.id}, ${event.subscriptionId}, ${event.externalEventId},
        ${event.recurrenceId}, ${event.status}, ${event.title}, ${event.description},
        ${event.location}, ${event.startAtUtc}, ${event.endAtUtc},
        ${event.originalTimezone}, ${event.allDay}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        location = EXCLUDED.location,
        start_at_utc = EXCLUDED.start_at_utc,
        end_at_utc = EXCLUDED.end_at_utc,
        status = EXCLUDED.status
    `;
    return event;
  }

  async listCalendarEvents(
    subscriptionId: string,
    from: Date,
    to: Date
  ): Promise<CalendarEvent[]> {
    const rows = await this.sql<EventRow[]>`
      SELECT * FROM calendar_events
      WHERE subscription_id = ${subscriptionId}
        AND start_at_utc >= ${from}
        AND start_at_utc <= ${to}
      ORDER BY start_at_utc ASC
    `;
    return rows.map(mapEvent);
  }

  async getWorkspaceCalendar(
    workspaceId: string
  ): Promise<WorkspaceCalendar | null> {
    const [row] = await this.sql<WsCalRow[]>`
      SELECT * FROM workspace_calendars WHERE workspace_id = ${workspaceId}
    `;
    return row
      ? {
          id: row.id,
          workspaceId: row.workspace_id,
          createdByUserId: row.created_by_user_id,
          displayNameOverride: row.display_name_override,
          colorOverride: row.color_override,
          enabled: row.enabled,
        }
      : null;
  }

  async upsertWorkspaceCalendar(
    calendar: WorkspaceCalendar
  ): Promise<WorkspaceCalendar> {
    await this.sql`
      INSERT INTO workspace_calendars (
        id, workspace_id, created_by_user_id, display_name_override, color_override, enabled
      ) VALUES (
        ${calendar.id}, ${calendar.workspaceId}, ${calendar.createdByUserId},
        ${calendar.displayNameOverride}, ${calendar.colorOverride}, ${calendar.enabled}
      )
      ON CONFLICT (workspace_id) DO UPDATE SET
        display_name_override = EXCLUDED.display_name_override,
        color_override = EXCLUDED.color_override,
        enabled = EXCLUDED.enabled
    `;
    return (await this.getWorkspaceCalendar(calendar.workspaceId)) ?? calendar;
  }

  async replaceWorkspaceCalendarItems(
    workspaceCalendarId: string,
    items: WorkspaceCalendarItem[]
  ): Promise<WorkspaceCalendarItem[]> {
    await this.sql`
      DELETE FROM workspace_calendar_items WHERE workspace_calendar_id = ${workspaceCalendarId}
    `;
    for (const item of items) {
      await this.sql`
        INSERT INTO workspace_calendar_items (
          id, workspace_calendar_id, subscription_id, sort_order, color_override, enabled
        ) VALUES (
          ${item.id}, ${item.workspaceCalendarId}, ${item.subscriptionId},
          ${item.sortOrder}, ${item.colorOverride}, ${item.enabled}
        )
      `;
    }
    return items;
  }

  async listWorkspaceCalendarItems(
    workspaceCalendarId: string
  ): Promise<WorkspaceCalendarItem[]> {
    const rows = await this.sql<WsCalItemRow[]>`
      SELECT * FROM workspace_calendar_items
      WHERE workspace_calendar_id = ${workspaceCalendarId}
      ORDER BY sort_order ASC NULLS LAST
    `;
    return rows.map(row => ({
      id: row.id,
      workspaceCalendarId: row.workspace_calendar_id,
      subscriptionId: row.subscription_id,
      sortOrder: row.sort_order,
      colorOverride: row.color_override,
      enabled: row.enabled,
    }));
  }

  async replaceEmbeddingChunks(
    workspaceId: string,
    docId: string,
    chunks: EmbeddingChunk[]
  ): Promise<void> {
    await this.sql`
      DELETE FROM embedding_chunks WHERE workspace_id = ${workspaceId} AND doc_id = ${docId}
    `;
    for (const chunk of chunks) {
      await this.sql`
        INSERT INTO embedding_chunks (
          id, workspace_id, doc_id, ordinal, text, vector, created_at
        ) VALUES (
          ${chunk.id}, ${chunk.workspaceId}, ${chunk.docId}, ${chunk.ordinal},
          ${chunk.text}, ${this.sql.json(asJson(chunk.vector))}, ${chunk.createdAt}
        )
      `;
    }
  }

  async listEmbeddingChunks(workspaceId: string): Promise<EmbeddingChunk[]> {
    const rows = await this.sql<ChunkRow[]>`
      SELECT * FROM embedding_chunks WHERE workspace_id = ${workspaceId}
      ORDER BY doc_id, ordinal
    `;
    return rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      docId: row.doc_id,
      ordinal: row.ordinal,
      text: row.text,
      vector: row.vector,
      createdAt: row.created_at,
    }));
  }

  async countEmbeddingChunks(): Promise<number> {
    const [row] = await this.sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM embedding_chunks
    `;
    return Number(row?.count ?? 0);
  }

  async addIgnoredDocs(docs: EmbeddingIgnoredDoc[]): Promise<number> {
    for (const doc of docs) {
      await this.sql`
        INSERT INTO embedding_ignored_docs (workspace_id, doc_id, created_by, created_at)
        VALUES (${doc.workspaceId}, ${doc.docId}, ${doc.createdBy}, ${doc.createdAt})
        ON CONFLICT (workspace_id, doc_id) DO NOTHING
      `;
    }
    return docs.length;
  }

  async removeIgnoredDocs(
    workspaceId: string,
    docIds: string[]
  ): Promise<number> {
    if (docIds.length === 0) {
      return 0;
    }
    const result = await this.sql`
      DELETE FROM embedding_ignored_docs
      WHERE workspace_id = ${workspaceId} AND doc_id IN ${this.sql(docIds)}
    `;
    return result.count;
  }

  async listIgnoredDocs(workspaceId: string): Promise<EmbeddingIgnoredDoc[]> {
    const rows = await this.sql<IgnoredRow[]>`
      SELECT * FROM embedding_ignored_docs WHERE workspace_id = ${workspaceId}
    `;
    return rows.map(row => ({
      workspaceId: row.workspace_id,
      docId: row.doc_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }

  async isIgnoredDoc(workspaceId: string, docId: string): Promise<boolean> {
    const [row] = await this.sql<{ ok: boolean }[]>`
      SELECT TRUE AS ok FROM embedding_ignored_docs
      WHERE workspace_id = ${workspaceId} AND doc_id = ${docId}
    `;
    return Boolean(row);
  }

  async createArtifact(
    artifact: EmbeddingArtifact
  ): Promise<EmbeddingArtifact> {
    await this.sql`
      INSERT INTO embedding_artifacts (
        artifact_id, workspace_id, file_name, media_type, size, content_hash,
        embedding_status, created_at
      ) VALUES (
        ${artifact.artifactId}, ${artifact.workspaceId}, ${artifact.fileName},
        ${artifact.mediaType}, ${artifact.size}, ${artifact.contentHash},
        ${artifact.embeddingStatus}, ${artifact.createdAt}
      )
    `;
    return artifact;
  }

  async getArtifact(artifactId: string): Promise<EmbeddingArtifact | null> {
    const [row] = await this.sql<ArtifactRow[]>`
      SELECT * FROM embedding_artifacts WHERE artifact_id = ${artifactId}
    `;
    return row
      ? {
          artifactId: row.artifact_id,
          workspaceId: row.workspace_id,
          fileName: row.file_name,
          mediaType: row.media_type,
          size: Number(row.size),
          contentHash: row.content_hash,
          embeddingStatus: row.embedding_status,
          createdAt: row.created_at,
        }
      : null;
  }

  async listArtifacts(workspaceId: string): Promise<EmbeddingArtifact[]> {
    const rows = await this.sql<ArtifactRow[]>`
      SELECT * FROM embedding_artifacts WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
    `;
    return rows.map(row => ({
      artifactId: row.artifact_id,
      workspaceId: row.workspace_id,
      fileName: row.file_name,
      mediaType: row.media_type,
      size: Number(row.size),
      contentHash: row.content_hash,
      embeddingStatus: row.embedding_status,
      createdAt: row.created_at,
    }));
  }

  async deleteArtifact(artifactId: string): Promise<boolean> {
    const result = await this
      .sql`DELETE FROM embedding_artifacts WHERE artifact_id = ${artifactId}`;
    return result.count > 0;
  }

  async getEmbeddingProgress(workspaceId: string): Promise<EmbeddingProgress> {
    const [row] = await this.sql<ProgressRow[]>`
      SELECT * FROM embedding_progress WHERE workspace_id = ${workspaceId}
    `;
    return row
      ? {
          workspaceId: row.workspace_id,
          total: row.total,
          embedded: row.embedded,
        }
      : { workspaceId, total: 0, embedded: 0 };
  }

  async setEmbeddingProgress(progress: EmbeddingProgress): Promise<void> {
    await this.sql`
      INSERT INTO embedding_progress (workspace_id, total, embedded)
      VALUES (${progress.workspaceId}, ${progress.total}, ${progress.embedded})
      ON CONFLICT (workspace_id) DO UPDATE SET
        total = EXCLUDED.total,
        embedded = EXCLUDED.embedded
    `;
  }

  async createByokProfile(profile: ByokProfile): Promise<ByokProfile> {
    await this.sql`
      INSERT INTO byok_profiles (
        profile_id, workspace_id, provider, name, description, enabled, sort_order,
        revision, credential_cipher, definition, created_at, updated_at
      ) VALUES (
        ${profile.profileId}, ${profile.workspaceId}, ${profile.provider},
        ${profile.name}, ${profile.description}, ${profile.enabled}, ${profile.sortOrder},
        ${profile.revision}, ${profile.credentialCipher},
        ${this.sql.json(asJson(profile.definition))}, ${profile.createdAt}, ${profile.updatedAt}
      )
    `;
    return profile;
  }

  async getByokProfile(profileId: string): Promise<ByokProfile | null> {
    const [row] = await this.sql<ByokRow[]>`
      SELECT * FROM byok_profiles WHERE profile_id = ${profileId}
    `;
    return row ? mapProfile(row) : null;
  }

  async listByokProfiles(workspaceId: string): Promise<ByokProfile[]> {
    const rows = await this.sql<ByokRow[]>`
      SELECT * FROM byok_profiles WHERE workspace_id = ${workspaceId}
      ORDER BY sort_order ASC
    `;
    return rows.map(mapProfile);
  }

  async updateByokProfile(
    profileId: string,
    patch: Partial<Omit<ByokProfile, 'profileId' | 'workspaceId' | 'createdAt'>>
  ): Promise<ByokProfile> {
    const current = await this.getByokProfile(profileId);
    if (!current) {
      throw new Error('BYOK profile not found');
    }
    const next = { ...current, ...patch };
    await this.sql`
      UPDATE byok_profiles SET
        provider = ${next.provider},
        name = ${next.name},
        description = ${next.description},
        enabled = ${next.enabled},
        sort_order = ${next.sortOrder},
        revision = ${next.revision},
        credential_cipher = ${next.credentialCipher},
        definition = ${this.sql.json(asJson(next.definition))},
        updated_at = ${next.updatedAt}
      WHERE profile_id = ${profileId}
    `;
    return next;
  }

  async deleteByokProfile(profileId: string): Promise<boolean> {
    const result = await this
      .sql`DELETE FROM byok_profiles WHERE profile_id = ${profileId}`;
    return result.count > 0;
  }

  async createByokLease(lease: ByokLease): Promise<ByokLease> {
    await this.sql`
      INSERT INTO byok_leases (lease_id, workspace_id, expires_at)
      VALUES (${lease.leaseId}, ${lease.workspaceId}, ${lease.expiresAt})
    `;
    return lease;
  }

  async addByokUsage(
    workspaceId: string,
    date: Date,
    featureKind: string,
    tokens: number
  ): Promise<void> {
    const day = date.toISOString().slice(0, 10);
    await this.sql`
      INSERT INTO byok_usage (workspace_id, used_on, feature_kind, total_tokens)
      VALUES (${workspaceId}, ${day}::date, ${featureKind}, ${tokens})
      ON CONFLICT (workspace_id, used_on, feature_kind) DO UPDATE SET
        total_tokens = byok_usage.total_tokens + EXCLUDED.total_tokens
    `;
  }

  async listByokUsage(
    workspaceId: string,
    from: Date,
    to: Date
  ): Promise<ByokUsagePoint[]> {
    const rows = await this.sql<
      { used_on: Date; feature_kind: string; total_tokens: string }[]
    >`
      SELECT used_on, feature_kind, total_tokens::text AS total_tokens
      FROM byok_usage
      WHERE workspace_id = ${workspaceId}
        AND used_on >= ${from.toISOString().slice(0, 10)}::date
        AND used_on <= ${to.toISOString().slice(0, 10)}::date
      ORDER BY used_on ASC
    `;
    return rows.map(row => ({
      date: row.used_on,
      featureKind: row.feature_kind,
      totalTokens: Number(row.total_tokens),
    }));
  }

  async createApiToken(token: ApiToken): Promise<ApiToken> {
    await this.sql`
      INSERT INTO api_tokens (
        id, user_id, name, token_hash, fingerprint, scopes, created_at,
        last_used_at, revoked_at
      ) VALUES (
        ${token.id}, ${token.userId}, ${token.name}, ${token.tokenHash},
        ${token.fingerprint}, ${token.scopes}, ${token.createdAt},
        ${token.lastUsedAt}, ${token.revokedAt}
      )
    `;
    return token;
  }

  async getApiToken(id: string): Promise<ApiToken | null> {
    const [row] = await this.sql<TokenRow[]>`
      SELECT * FROM api_tokens WHERE id = ${id}
    `;
    return row ? mapToken(row) : null;
  }

  async findApiTokenByHash(tokenHash: string): Promise<ApiToken | null> {
    const [row] = await this.sql<TokenRow[]>`
      SELECT * FROM api_tokens WHERE token_hash = ${tokenHash}
    `;
    return row ? mapToken(row) : null;
  }

  async listApiTokens(userId: string): Promise<ApiToken[]> {
    const rows = await this.sql<TokenRow[]>`
      SELECT * FROM api_tokens WHERE user_id = ${userId} ORDER BY created_at DESC
    `;
    return rows.map(mapToken);
  }

  async updateApiToken(
    id: string,
    patch: Partial<Pick<ApiToken, 'lastUsedAt' | 'revokedAt'>>
  ): Promise<ApiToken> {
    const current = await this.getApiToken(id);
    if (!current) {
      throw new Error('API token not found');
    }
    const next = { ...current, ...patch };
    await this.sql`
      UPDATE api_tokens SET
        last_used_at = ${next.lastUsedAt},
        revoked_at = ${next.revokedAt}
      WHERE id = ${id}
    `;
    return next;
  }
}
