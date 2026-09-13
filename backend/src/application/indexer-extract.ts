import { applyUpdate, Doc as YDoc } from 'yjs';

import type { CommentRecord } from '../domain/comment.js';
import type { SearchDocument } from '../domain/search.js';

export function yjsHaystack(
  snapshot: Uint8Array | null,
  updates: Uint8Array[]
): string {
  const doc = new YDoc();
  if (snapshot && snapshot.byteLength > 0) {
    applyUpdate(doc, snapshot);
  }
  for (const update of updates) {
    applyUpdate(doc, update);
  }
  const parts: string[] = [];
  doc.share.forEach((abstract, key) => {
    const typed = abstract as { _map?: Map<unknown, unknown> };
    if (typed._map && typed._map.size > 0) {
      parts.push(JSON.stringify(doc.getMap(key).toJSON()));
      return;
    }
    const text = doc.getText(key).toString();
    parts.push(text.length > 0 ? text : key);
  });
  return parts.join('\n');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    const text = String(value);
    return text === '[object Object]' ? '' : text;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function titleFrom(record: Record<string, unknown>): string {
  const direct = readString(record.title);
  if (direct.trim()) {
    return direct.trim();
  }
  const props = asRecord(record.props);
  if (props) {
    const nested = readString(props.title);
    if (nested.trim()) {
      return nested.trim();
    }
  }
  return '';
}

function flavourOf(
  record: Record<string, unknown>,
  fallback: string
): string {
  return typeof record.flavour === 'string' ? record.flavour : fallback;
}

function collectText(value: unknown, into: string[]): void {
  if (typeof value === 'string') {
    if (value.trim().length > 1) {
      into.push(value.trim());
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, into);
    }
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  for (const [key, nested] of Object.entries(record)) {
    if (key === 'id' || key === 'flavour' || key === 'type') {
      continue;
    }
    collectText(nested, into);
  }
}

function pushDoc(
  out: SearchDocument[],
  seen: Set<string>,
  doc: SearchDocument
): void {
  const key = `${doc.docId}\0${doc.blockId}\0${doc.flavour}\0${doc.title}\0${doc.body.slice(0, 80)}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  out.push(doc);
}

function walkBlocks(
  value: unknown,
  ctx: { flavour: string; blockId: string },
  workspaceId: string,
  docId: string,
  updatedAt: Date,
  out: SearchDocument[],
  seen: Set<string>
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkBlocks(item, ctx, workspaceId, docId, updatedAt, out, seen);
    }
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  const flavour = flavourOf(record, ctx.flavour);
  const blockId =
    typeof record.id === 'string' && record.id.length > 0
      ? record.id
      : ctx.blockId;
  const title = titleFrom(record);
  const texts: string[] = [];
  collectText(record, texts);
  const body = [...new Set(texts.filter(text => text !== title))].join('\n');
  const interesting =
    flavour.startsWith('wb:') ||
    flavour.startsWith('affine:paragraph') ||
    flavour.startsWith('affine:note') ||
    flavour.startsWith('affine:list') ||
    flavour === 'affine:database' ||
    flavour === 'affine:page' ||
    title.length > 0;
  if (interesting && (title || body)) {
    pushDoc(out, seen, {
      workspaceId,
      docId,
      blockId,
      flavour,
      title: title || docId,
      body: body || title,
      updatedAt,
    });
  }
  if (flavour === 'affine:database' || flavour === 'wb:board') {
    const cells = record.cells ?? record.rows ?? record.children;
    walkBlocks(cells, { flavour, blockId }, workspaceId, docId, updatedAt, out, seen);
  }
  for (const nested of Object.values(record)) {
    if (nested === record.cells) {
      continue;
    }
    walkBlocks(
      nested,
      { flavour, blockId },
      workspaceId,
      docId,
      updatedAt,
      out,
      seen
    );
  }
}

function parseJsonBlobs(haystack: string): unknown[] {
  const blobs: unknown[] = [];
  for (const line of haystack.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      continue;
    }
    try {
      blobs.push(JSON.parse(trimmed));
    } catch {
      // Concatenated Yjs maps are best-effort JSON.
    }
  }
  return blobs;
}

function commentBody(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

export function extractSearchDocuments(input: {
  workspaceId: string;
  docId: string;
  haystack: string;
  comments: CommentRecord[];
  updatedAt: Date;
}): SearchDocument[] {
  const seen = new Set<string>();
  const out: SearchDocument[] = [];
  pushDoc(out, seen, {
    workspaceId: input.workspaceId,
    docId: input.docId,
    blockId: '',
    flavour: 'affine:page',
    title: input.docId,
    body: input.haystack,
    updatedAt: input.updatedAt,
  });
  for (const blob of parseJsonBlobs(input.haystack)) {
    walkBlocks(
      blob,
      { flavour: 'affine:page', blockId: '' },
      input.workspaceId,
      input.docId,
      input.updatedAt,
      out,
      seen
    );
  }
  for (const comment of input.comments) {
    pushDoc(out, seen, {
      workspaceId: input.workspaceId,
      docId: input.docId,
      blockId: comment.id,
      flavour: 'affine:comment',
      title: input.docId,
      body: commentBody(comment.content),
      updatedAt: comment.updatedAt,
    });
  }
  return out;
}
