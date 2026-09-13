import type { AnalyticsStore, IndexStore } from '../../domain/ports.js';
import type {
  DailyAnalytics,
  SearchDocument,
  SearchFlavourCount,
  ShareViewStats,
} from '../../domain/search.js';
import { PostgresE3Store } from './postgres-e3.js';

interface SearchRow {
  workspace_id: string;
  doc_id: string;
  block_id: string;
  flavour: string;
  title: string;
  body: string;
  updated_at: Date;
}

interface ShareRow {
  workspace_id: string;
  doc_id: string;
  views: number;
  unique_views: number;
  guest_views: number;
  last_accessed_at: Date | null;
  visitor_keys: string[] | null;
}

interface DailyRow {
  day: Date;
  workspace_storage_bytes: string | number;
  blob_storage_bytes: string | number;
  copilot_conversations: number;
  sync_active_users: number;
}

function mapSearch(row: SearchRow): SearchDocument {
  return {
    workspaceId: row.workspace_id,
    docId: row.doc_id,
    blockId: row.block_id,
    flavour: row.flavour,
    title: row.title,
    body: row.body,
    updatedAt: row.updated_at,
  };
}

function mapShare(row: ShareRow): ShareViewStats {
  return {
    workspaceId: row.workspace_id,
    docId: row.doc_id,
    views: row.views,
    uniqueViews: row.unique_views,
    guestViews: row.guest_views,
    lastAccessedAt: row.last_accessed_at,
  };
}

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapDaily(row: DailyRow): DailyAnalytics {
  return {
    day: isoDay(row.day),
    workspaceStorageBytes: Number(row.workspace_storage_bytes),
    blobStorageBytes: Number(row.blob_storage_bytes),
    copilotConversations: row.copilot_conversations,
    syncActiveUsers: row.sync_active_users,
  };
}

function likePattern(keyword: string): string {
  return `%${keyword.replace(/[%_\\]/g, '\\$&')}%`;
}

export class PostgresE4Store
  extends PostgresE3Store
  implements IndexStore, AnalyticsStore
{
  async replaceSearchDocuments(
    workspaceId: string,
    docId: string,
    docs: SearchDocument[]
  ): Promise<void> {
    await this.sql.begin(async tx => {
      await tx`
        DELETE FROM search_documents
        WHERE workspace_id = ${workspaceId} AND doc_id = ${docId}
      `;
      for (const doc of docs) {
        await tx`
          INSERT INTO search_documents (
            workspace_id, doc_id, block_id, flavour, title, body, updated_at
          ) VALUES (
            ${doc.workspaceId}, ${doc.docId}, ${doc.blockId}, ${doc.flavour},
            ${doc.title}, ${doc.body}, ${doc.updatedAt}
          )
        `;
      }
    });
  }

  async searchDocuments(
    workspaceId: string,
    keyword: string,
    limit: number
  ): Promise<SearchDocument[]> {
    const needle = keyword.trim();
    if (!needle) {
      return [];
    }
    const pattern = likePattern(needle);
    const rows = await this.sql<SearchRow[]>`
      SELECT * FROM search_documents
      WHERE workspace_id = ${workspaceId}
        AND (
          title ILIKE ${pattern} ESCAPE '\\'
          OR body ILIKE ${pattern} ESCAPE '\\'
          OR to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
             @@ plainto_tsquery('simple', ${needle})
        )
      ORDER BY updated_at DESC
      LIMIT ${Math.max(0, limit)}
    `;
    return rows.map(mapSearch);
  }

  async countSearchDocuments(workspaceId?: string): Promise<number> {
    const [row] = workspaceId
      ? await this.sql<{ count: string }[]>`
          SELECT count(*)::text AS count FROM search_documents
          WHERE workspace_id = ${workspaceId}
        `
      : await this.sql<{ count: string }[]>`
          SELECT count(*)::text AS count FROM search_documents
        `;
    return Number(row?.count ?? 0);
  }

  async listSearchFlavours(workspaceId: string): Promise<SearchFlavourCount[]> {
    const rows = await this.sql<{ flavour: string; count: string }[]>`
      SELECT flavour, count(*)::text AS count
      FROM search_documents
      WHERE workspace_id = ${workspaceId}
      GROUP BY flavour
      ORDER BY count(*) DESC, flavour ASC
    `;
    return rows.map(row => ({ flavour: row.flavour, count: Number(row.count) }));
  }

  async deleteSearchDocuments(
    workspaceId: string,
    docId?: string
  ): Promise<void> {
    if (docId) {
      await this.sql`
        DELETE FROM search_documents
        WHERE workspace_id = ${workspaceId} AND doc_id = ${docId}
      `;
      return;
    }
    await this.sql`
      DELETE FROM search_documents WHERE workspace_id = ${workspaceId}
    `;
  }

  async latestSearchUpdatedAt(workspaceId?: string): Promise<Date | null> {
    const [row] = workspaceId
      ? await this.sql<{ updated_at: Date | null }[]>`
          SELECT max(updated_at) AS updated_at FROM search_documents
          WHERE workspace_id = ${workspaceId}
        `
      : await this.sql<{ updated_at: Date | null }[]>`
          SELECT max(updated_at) AS updated_at FROM search_documents
        `;
    return row?.updated_at ?? null;
  }

  async recordShareView(input: {
    workspaceId: string;
    docId: string;
    at: Date;
    visitorKey: string;
    guest: boolean;
  }): Promise<ShareViewStats> {
    const [row] = await this.sql<ShareRow[]>`
      INSERT INTO share_link_stats (
        workspace_id, doc_id, views, unique_views, guest_views,
        last_accessed_at, visitor_keys
      ) VALUES (
        ${input.workspaceId}, ${input.docId}, 1,
        1, ${input.guest ? 1 : 0}, ${input.at}, ARRAY[${input.visitorKey}]::text[]
      )
      ON CONFLICT (workspace_id, doc_id) DO UPDATE SET
        views = share_link_stats.views + 1,
        guest_views = share_link_stats.guest_views + ${input.guest ? 1 : 0},
        unique_views = share_link_stats.unique_views +
          CASE WHEN ${input.visitorKey} = ANY (share_link_stats.visitor_keys)
            THEN 0 ELSE 1 END,
        visitor_keys = CASE
          WHEN ${input.visitorKey} = ANY (share_link_stats.visitor_keys)
            THEN share_link_stats.visitor_keys
          ELSE array_append(share_link_stats.visitor_keys, ${input.visitorKey})
        END,
        last_accessed_at = ${input.at}
      RETURNING *
    `;
    return mapShare(row!);
  }

  async getShareStats(
    workspaceId: string,
    docId: string
  ): Promise<ShareViewStats | null> {
    const [row] = await this.sql<ShareRow[]>`
      SELECT * FROM share_link_stats
      WHERE workspace_id = ${workspaceId} AND doc_id = ${docId}
    `;
    return row ? mapShare(row) : null;
  }

  async listShareStats(): Promise<ShareViewStats[]> {
    const rows = await this.sql<ShareRow[]>`
      SELECT * FROM share_link_stats
    `;
    return rows.map(mapShare);
  }

  async upsertDailyAnalytics(row: DailyAnalytics): Promise<void> {
    await this.sql`
      INSERT INTO analytics_daily (
        day, workspace_storage_bytes, blob_storage_bytes,
        copilot_conversations, sync_active_users
      ) VALUES (
        ${row.day}::date, ${row.workspaceStorageBytes}, ${row.blobStorageBytes},
        ${row.copilotConversations}, ${row.syncActiveUsers}
      )
      ON CONFLICT (day) DO UPDATE SET
        workspace_storage_bytes = EXCLUDED.workspace_storage_bytes,
        blob_storage_bytes = EXCLUDED.blob_storage_bytes,
        copilot_conversations = EXCLUDED.copilot_conversations,
        sync_active_users = EXCLUDED.sync_active_users
    `;
  }

  async listDailyAnalytics(
    fromDay: string,
    toDay: string
  ): Promise<DailyAnalytics[]> {
    const rows = await this.sql<DailyRow[]>`
      SELECT * FROM analytics_daily
      WHERE day >= ${fromDay}::date AND day <= ${toDay}::date
      ORDER BY day ASC
    `;
    return rows.map(mapDaily);
  }
}
