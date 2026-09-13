import type {
  DailyAnalytics,
  SearchDocument,
  SearchFlavourCount,
  ShareViewStats,
} from '../../domain/search.js';
import type { AnalyticsStore, IndexStore } from '../../domain/ports.js';
import { MemoryE3Store } from './e3-memory.js';
import {
  cloneSearchDocument,
  cloneShareStats,
  matchesKeyword,
} from './e4-clone.js';

function searchKey(workspaceId: string, docId: string, blockId: string): string {
  return `${workspaceId}\0${docId}\0${blockId}`;
}

function shareKey(workspaceId: string, docId: string): string {
  return `${workspaceId}:${docId}`;
}

export class MemoryE4Store
  extends MemoryE3Store
  implements IndexStore, AnalyticsStore
{
  private readonly searchDocs = new Map<string, SearchDocument>();
  private readonly shareStats = new Map<
    string,
    ShareViewStats & { visitors: Set<string> }
  >();
  private readonly daily = new Map<string, DailyAnalytics>();

  async replaceSearchDocuments(
    workspaceId: string,
    docId: string,
    docs: SearchDocument[]
  ): Promise<void> {
    for (const [key, row] of this.searchDocs) {
      if (row.workspaceId === workspaceId && row.docId === docId) {
        this.searchDocs.delete(key);
      }
    }
    for (const doc of docs) {
      this.searchDocs.set(
        searchKey(doc.workspaceId, doc.docId, doc.blockId),
        cloneSearchDocument(doc)
      );
    }
  }

  async searchDocuments(
    workspaceId: string,
    keyword: string,
    limit: number
  ): Promise<SearchDocument[]> {
    return [...this.searchDocs.values()]
      .filter(
        row => row.workspaceId === workspaceId && matchesKeyword(row, keyword)
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, Math.max(0, limit))
      .map(cloneSearchDocument);
  }

  async countSearchDocuments(workspaceId?: string): Promise<number> {
    if (!workspaceId) {
      return this.searchDocs.size;
    }
    let count = 0;
    for (const row of this.searchDocs.values()) {
      if (row.workspaceId === workspaceId) {
        count += 1;
      }
    }
    return count;
  }

  async listSearchFlavours(workspaceId: string): Promise<SearchFlavourCount[]> {
    const counts = new Map<string, number>();
    for (const row of this.searchDocs.values()) {
      if (row.workspaceId !== workspaceId) {
        continue;
      }
      counts.set(row.flavour, (counts.get(row.flavour) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([flavour, count]) => ({ flavour, count }))
      .sort((a, b) => b.count - a.count || a.flavour.localeCompare(b.flavour));
  }

  async deleteSearchDocuments(
    workspaceId: string,
    docId?: string
  ): Promise<void> {
    for (const [key, row] of this.searchDocs) {
      if (row.workspaceId !== workspaceId) {
        continue;
      }
      if (docId && row.docId !== docId) {
        continue;
      }
      this.searchDocs.delete(key);
    }
  }

  async latestSearchUpdatedAt(workspaceId?: string): Promise<Date | null> {
    let latest: Date | null = null;
    for (const row of this.searchDocs.values()) {
      if (workspaceId && row.workspaceId !== workspaceId) {
        continue;
      }
      if (!latest || row.updatedAt > latest) {
        latest = row.updatedAt;
      }
    }
    return latest ? new Date(latest) : null;
  }

  async recordShareView(input: {
    workspaceId: string;
    docId: string;
    at: Date;
    visitorKey: string;
    guest: boolean;
  }): Promise<ShareViewStats> {
    const key = shareKey(input.workspaceId, input.docId);
    const current = this.shareStats.get(key) ?? {
      workspaceId: input.workspaceId,
      docId: input.docId,
      views: 0,
      uniqueViews: 0,
      guestViews: 0,
      lastAccessedAt: null,
      visitors: new Set<string>(),
    };
    current.views += 1;
    if (input.guest) {
      current.guestViews += 1;
    }
    if (!current.visitors.has(input.visitorKey)) {
      current.visitors.add(input.visitorKey);
      current.uniqueViews += 1;
    }
    current.lastAccessedAt = new Date(input.at);
    this.shareStats.set(key, current);
    return cloneShareStats(current);
  }

  async getShareStats(
    workspaceId: string,
    docId: string
  ): Promise<ShareViewStats | null> {
    const row = this.shareStats.get(shareKey(workspaceId, docId));
    return row ? cloneShareStats(row) : null;
  }

  async listShareStats(): Promise<ShareViewStats[]> {
    return [...this.shareStats.values()].map(cloneShareStats);
  }

  async upsertDailyAnalytics(row: DailyAnalytics): Promise<void> {
    this.daily.set(row.day, { ...row });
  }

  async listDailyAnalytics(
    fromDay: string,
    toDay: string
  ): Promise<DailyAnalytics[]> {
    return [...this.daily.values()]
      .filter(row => row.day >= fromDay && row.day <= toDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map(row => ({ ...row }));
  }
}
