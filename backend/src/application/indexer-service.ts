import type { Histogram } from 'prom-client';

import type { SearchDocument } from '../domain/search.js';
import type {
  Clock,
  CommentStore,
  DocStore,
  IndexStore,
  WorkspaceStore,
} from '../domain/ports.js';
import type { JobWorker } from '../adapters/jobs/worker.js';
import { extractSearchDocuments, yjsHaystack } from './indexer-extract.js';
import type { OpenSearchIndex } from '../adapters/search/opensearch-index.js';

export interface IndexerMetrics {
  docsTotal?: { set(value: number): void };
  lagSeconds?: { set(value: number): void };
  searchDuration?: Pick<Histogram<string>, 'observe'>;
}

export class IndexerService {
  constructor(
    private readonly index: IndexStore,
    private readonly docs: DocStore,
    private readonly comments: CommentStore,
    private readonly workspaces: WorkspaceStore,
    private readonly clock: Clock,
    private readonly jobs?: JobWorker,
    private readonly extras: {
      metrics?: IndexerMetrics;
      remote?: OpenSearchIndex;
    } = {}
  ) {}

  enqueue(workspaceId: string, docId: string): void {
    void this.jobs?.enqueue('index.document', { workspaceId, docId });
  }

  async handleIndexJob(payload: Record<string, unknown>): Promise<void> {
    const workspaceId = payload.workspaceId;
    const docId = payload.docId;
    if (typeof workspaceId !== 'string' || typeof docId !== 'string') {
      return;
    }
    await this.indexDocument(workspaceId, docId);
  }

  async indexDocument(workspaceId: string, docId: string): Promise<number> {
    const record = await this.docs.getDocument(
      'workspace',
      workspaceId,
      docId
    );
    if (!record) {
      await this.index.deleteSearchDocuments(workspaceId, docId);
      try {
        await this.extras.remote?.deleteDocument(workspaceId, docId);
      } catch {
        // Ignore remote delete failures.
      }
      await this.refreshMetrics();
      return 0;
    }
    const updates = await this.docs.listUpdates('workspace', workspaceId, docId);
    const comments = await this.comments.listComments(workspaceId, docId);
    const haystack = yjsHaystack(
      record.snapshot,
      updates.map(item => item.payload)
    );
    const documents = extractSearchDocuments({
      workspaceId,
      docId,
      haystack,
      comments: comments.items,
      updatedAt: new Date(record.timestamp),
    });
    await this.index.replaceSearchDocuments(workspaceId, docId, documents);
    try {
      await this.extras.remote?.replaceDocuments(workspaceId, docId, documents);
    } catch {
      // Local FTS remains the source of truth when the optional cluster is down.
    }
    await this.refreshMetrics();
    return documents.length;
  }

  async reindex(workspaceId?: string): Promise<number> {
    const ids = workspaceId
      ? [workspaceId]
      : await this.workspaces.listWorkspaceIds();
    let total = 0;
    for (const id of ids) {
      const timestamps = await this.docs.listTimestamps('workspace', id);
      for (const docId of Object.keys(timestamps)) {
        total += await this.indexDocument(id, docId);
      }
    }
    return total;
  }

  async searchDocuments(
    workspaceId: string,
    keyword: string,
    limit: number
  ): Promise<SearchDocument[]> {
    const started = Date.now();
    try {
      const remote = await this.extras.remote?.search(
        workspaceId,
        keyword,
        limit
      );
      if (remote) {
        return remote;
      }
      return this.index.searchDocuments(workspaceId, keyword, limit);
    } finally {
      this.extras.metrics?.searchDuration?.observe((Date.now() - started) / 1000);
    }
  }

  async hasIndex(workspaceId: string): Promise<boolean> {
    return (await this.index.countSearchDocuments(workspaceId)) > 0;
  }

  async aggregate(
    workspaceId: string,
    input: { field?: string; query?: unknown; options?: { pagination?: { limit?: number } } }
  ): Promise<{
    buckets: Array<{
      key: string;
      count: number;
      hits: { nodes: Array<{ fields: Record<string, unknown>; highlights: Record<string, string> | null }> };
    }>;
    pagination: { count: number; hasMore: boolean; nextCursor: string | null };
  }> {
    const flavours = await this.index.listSearchFlavours(workspaceId);
    const field = input.field ?? 'flavour';
    const buckets = flavours.map(row => ({
      key: field === 'flavour' ? row.flavour : row.flavour,
      count: row.count,
      hits: { nodes: [] as Array<{ fields: Record<string, unknown>; highlights: Record<string, string> | null }> },
    }));
    return {
      buckets,
      pagination: {
        count: buckets.length,
        hasMore: false,
        nextCursor: null,
      },
    };
  }

  private async refreshMetrics(): Promise<void> {
    const total = await this.index.countSearchDocuments();
    this.extras.metrics?.docsTotal?.set(total);
    const latest = await this.index.latestSearchUpdatedAt();
    if (latest) {
      const lag = Math.max(0, (this.clock.now().getTime() - latest.getTime()) / 1000);
      this.extras.metrics?.lagSeconds?.set(lag);
    } else {
      this.extras.metrics?.lagSeconds?.set(0);
    }
  }
}
