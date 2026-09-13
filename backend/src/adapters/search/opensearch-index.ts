import type { HttpFetcher } from '../../domain/ports.js';
import type { SearchDocument } from '../../domain/search.js';

export class OpenSearchIndex {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: HttpFetcher,
    private readonly indexName = 'mosaic-search'
  ) {}

  async replaceDocuments(
    workspaceId: string,
    docId: string,
    docs: SearchDocument[]
  ): Promise<void> {
    await this.deleteDocument(workspaceId, docId);
    for (const doc of docs) {
      const id = encodeURIComponent(
        `${doc.workspaceId}:${doc.docId}:${doc.blockId || '_'}`
      );
      const res = await this.fetchFn(
        `${this.baseUrl}/${this.indexName}/_doc/${id}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workspaceId: doc.workspaceId,
            docId: doc.docId,
            blockId: doc.blockId,
            flavour: doc.flavour,
            title: doc.title,
            body: doc.body,
            updatedAt: doc.updatedAt.toISOString(),
          }),
        }
      );
      if (!res.ok) {
        throw new Error(`OpenSearch index failed: ${res.status}`);
      }
    }
  }

  async deleteDocument(workspaceId: string, docId: string): Promise<void> {
    await this.fetchFn(`${this.baseUrl}/${this.indexName}/_delete_by_query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: {
          bool: {
            must: [
              { term: { workspaceId } },
              { term: { docId } },
            ],
          },
        },
      }),
    });
  }

  async search(
    workspaceId: string,
    keyword: string,
    limit: number
  ): Promise<SearchDocument[] | null> {
    try {
      const res = await this.fetchFn(
        `${this.baseUrl}/${this.indexName}/_search`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            size: limit,
            query: {
              bool: {
                must: [
                  { term: { workspaceId } },
                  {
                    simple_query_string: {
                      query: keyword,
                      fields: ['title', 'body'],
                    },
                  },
                ],
              },
            },
          }),
        }
      );
      if (!res.ok) {
        return null;
      }
      const body = (await res.json()) as {
        hits?: { hits?: Array<{ _source?: Record<string, unknown> }> };
      };
      return (body.hits?.hits ?? []).map(hit => {
        const src = hit._source ?? {};
        return {
          workspaceId: String(src.workspaceId ?? workspaceId),
          docId: String(src.docId ?? ''),
          blockId: String(src.blockId ?? ''),
          flavour: String(src.flavour ?? 'affine:page'),
          title: String(src.title ?? ''),
          body: String(src.body ?? ''),
          updatedAt: src.updatedAt
            ? new Date(String(src.updatedAt))
            : new Date(),
        };
      });
    } catch {
      return null;
    }
  }
}
