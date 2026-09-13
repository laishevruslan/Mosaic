import type { CommentStore, DocStore } from '../domain/ports.js';
import { yjsHaystack } from './indexer-extract.js';
import type { IndexerService } from './indexer-service.js';

export interface SearchDocHit {
  docId: string;
  title: string;
  blockId: string;
  highlight: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchNodeHit {
  fields: Record<string, unknown>;
  highlights: Record<string, string> | null;
}

function keywordFromQuery(query: unknown): string {
  if (!query || typeof query !== 'object') {
    return '';
  }
  const record = query as Record<string, unknown>;
  if (typeof record.match === 'string') {
    return record.match;
  }
  if (Array.isArray(record.queries)) {
    for (const nested of record.queries) {
      const found = keywordFromQuery(nested);
      if (found) {
        return found;
      }
    }
  }
  if (record.query) {
    return keywordFromQuery(record.query);
  }
  return '';
}

function yjsText(snapshot: Uint8Array | null, updates: Uint8Array[]): string {
  return yjsHaystack(snapshot, updates);
}

function snippet(haystack: string, needle: string): string {
  const index = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) {
    return haystack.slice(0, 160);
  }
  const start = Math.max(0, index - 40);
  return haystack.slice(start, start + 160);
}

export class SearchService {
  private indexer?: IndexerService;

  constructor(
    private readonly docs: DocStore,
    private readonly comments: CommentStore
  ) {}

  bindIndexer(indexer: IndexerService): void {
    this.indexer = indexer;
  }

  async searchDocs(
    workspaceId: string,
    keyword: string,
    limit = 20
  ): Promise<SearchDocHit[]> {
    const needle = keyword.trim();
    if (!needle) {
      return [];
    }
    if (this.indexer && (await this.indexer.hasIndex(workspaceId))) {
      const indexed = await this.indexer.searchDocuments(
        workspaceId,
        needle,
        limit
      );
      if (indexed.length > 0) {
        return indexed.map(row => ({
          docId: row.docId,
          title: row.title || row.docId,
          blockId: row.blockId,
          highlight: snippet(`${row.title}\n${row.body}`, needle),
          createdAt: row.updatedAt,
          updatedAt: row.updatedAt,
        }));
      }
    }
    return this.scanDocs(workspaceId, needle, limit);
  }

  private async scanDocs(
    workspaceId: string,
    needle: string,
    limit: number
  ): Promise<SearchDocHit[]> {
    const timestamps = await this.docs.listTimestamps('workspace', workspaceId);
    const hits: SearchDocHit[] = [];
    for (const docId of Object.keys(timestamps)) {
      const record = await this.docs.getDocument(
        'workspace',
        workspaceId,
        docId
      );
      if (!record) {
        continue;
      }
      const updates = await this.docs.listUpdates(
        'workspace',
        workspaceId,
        docId
      );
      const text = yjsText(
        record.snapshot,
        updates.map(item => item.payload)
      );
      const comments = await this.comments.listComments(workspaceId, docId);
      const commentText = JSON.stringify(
        comments.items.map(item => item.content)
      );
      const haystack = `${docId}\n${text}\n${commentText}`;
      if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
        continue;
      }
      const updated = new Date(record.timestamp);
      hits.push({
        docId,
        title: docId,
        blockId: '',
        highlight: snippet(haystack, needle),
        createdAt: updated,
        updatedAt: updated,
      });
      if (hits.length >= limit) {
        break;
      }
    }
    return hits;
  }

  async search(
    workspaceId: string,
    input: {
      query?: unknown;
      options?: {
        fields?: string[];
        pagination?: { limit?: number; skip?: number };
      };
    }
  ): Promise<{
    nodes: SearchNodeHit[];
    count: number;
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const keyword = keywordFromQuery(input.query);
    const limit = Math.min(
      50,
      Math.max(1, input.options?.pagination?.limit ?? 20)
    );
    const skip = Math.max(0, input.options?.pagination?.skip ?? 0);
    const docs = await this.searchDocs(workspaceId, keyword, skip + limit + 1);
    const page = docs.slice(skip, skip + limit);
    const fields = input.options?.fields ?? ['docId', 'title', 'content'];
    const nodes = page.map(hit => {
      const all: Record<string, unknown> = {
        docId: hit.docId,
        title: hit.title,
        content: hit.highlight,
        blockId: hit.blockId,
      };
      const selected: Record<string, unknown> = {};
      for (const field of fields) {
        if (field in all) {
          selected[field] = all[field];
        }
      }
      return {
        fields: Object.keys(selected).length > 0 ? selected : all,
        highlights: { content: hit.highlight },
      };
    });
    return {
      nodes,
      count: nodes.length,
      hasMore: docs.length > skip + limit,
      nextCursor: docs.length > skip + limit ? String(skip + limit) : null,
    };
  }

  async aggregate(
    workspaceId: string,
    input: {
      field?: string;
      query?: unknown;
      options?: { pagination?: { limit?: number } };
    }
  ) {
    if (this.indexer) {
      return this.indexer.aggregate(workspaceId, input);
    }
    return {
      buckets: [],
      pagination: { count: 0, hasMore: false, nextCursor: null },
    };
  }
}
