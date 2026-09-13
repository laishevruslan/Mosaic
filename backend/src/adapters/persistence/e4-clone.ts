import type { SearchDocument, ShareViewStats } from '../../domain/search.js';

export function cloneSearchDocument(row: SearchDocument): SearchDocument {
  return { ...row, updatedAt: new Date(row.updatedAt) };
}

export function cloneShareStats(row: ShareViewStats): ShareViewStats {
  return {
    ...row,
    lastAccessedAt: row.lastAccessedAt ? new Date(row.lastAccessedAt) : null,
  };
}

export function matchesKeyword(row: SearchDocument, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  return `${row.title}\n${row.body}\n${row.flavour}\n${row.docId}`
    .toLowerCase()
    .includes(needle);
}
