import { applyUpdate, Doc as YDoc } from 'yjs';

import type { JobWorker } from '../adapters/jobs/worker.js';
import type { AuditService } from './audit-service.js';
import type { WorkspaceService } from './workspace-service.js';
import {
  EMBEDDING_VECTOR_SIZE,
  type EmbeddingArtifact,
  type EmbeddingChunk,
  type EmbeddingIgnoredDoc,
  type EmbeddingProgress,
} from '../domain/embedding.js';
import type {
  CommentStore,
  DocStore,
  EmbeddingStore,
  Clock,
} from '../domain/ports.js';
import type { User } from '../domain/identity.js';

export function hashEmbed(
  text: string,
  dim = EMBEDDING_VECTOR_SIZE
): number[] {
  const vec = Array.from({ length: dim }, () => 0);
  for (let i = 0; i < text.length; i++) {
    const slot = i % dim;
    vec[slot] = (vec[slot] ?? 0) + (text.charCodeAt(i) % 97) / 97;
  }
  const mag = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vec.map(value => value / mag);
}

function cosine(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function yjsText(snapshot: Uint8Array | null, updates: Uint8Array[]): string {
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

function chunkText(text: string, size = 500): string[] {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return [];
  }
  const chunks: string[] = [];
  for (let i = 0; i < trimmed.length; i += size) {
    chunks.push(trimmed.slice(i, i + size));
  }
  return chunks.slice(0, 40);
}

export class EmbeddingService {
  constructor(
    private readonly store: EmbeddingStore,
    private readonly docs: DocStore,
    private readonly comments: CommentStore,
    private readonly clock: Clock,
    private readonly workspaces: WorkspaceService,
    private readonly jobs?: JobWorker,
    private readonly audit?: AuditService
  ) {}

  async hasIndexedAny(): Promise<boolean> {
    return (await this.store.countEmbeddingChunks()) > 0;
  }

  async progress(workspaceId: string): Promise<EmbeddingProgress> {
    return this.store.getEmbeddingProgress(workspaceId);
  }

  async enqueueDocument(
    user: User,
    workspaceId: string,
    docId: string
  ): Promise<void> {
    await this.workspaces.requireMember(user, workspaceId);
    const workspace = await this.workspaces.get(user, workspaceId);
    if (!workspace.enableDocEmbedding) {
      return;
    }
    await this.jobs?.enqueue('embed.document', { workspaceId, docId });
  }

  async handleEmbedJob(payload: Record<string, unknown>): Promise<void> {
    const workspaceId =
      typeof payload.workspaceId === 'string' ? payload.workspaceId : null;
    const docId = typeof payload.docId === 'string' ? payload.docId : null;
    if (!workspaceId || !docId) {
      return;
    }
    if (await this.store.isIgnoredDoc(workspaceId, docId)) {
      return;
    }
    const record = await this.docs.getDocument('workspace', workspaceId, docId);
    if (!record) {
      return;
    }
    const updates = await this.docs.listUpdates('workspace', workspaceId, docId);
    const comments = await this.comments.listComments(workspaceId, docId);
    const text = `${yjsText(
      record.snapshot,
      updates.map(item => item.payload)
    )}\n${JSON.stringify(comments.items.map(item => item.content))}`;
    const pieces = chunkText(text);
    const now = this.clock.now();
    const chunks: EmbeddingChunk[] = pieces.map((piece, ordinal) => ({
      id: crypto.randomUUID(),
      workspaceId,
      docId,
      ordinal,
      text: piece,
      vector: hashEmbed(piece),
      createdAt: now,
    }));
    await this.store.replaceEmbeddingChunks(workspaceId, docId, chunks);
    const timestamps = await this.docs.listTimestamps('workspace', workspaceId);
    const ignored = await this.store.listIgnoredDocs(workspaceId);
    const ignoredSet = new Set(ignored.map(item => item.docId));
    const total = Object.keys(timestamps).filter(
      id => !ignoredSet.has(id)
    ).length;
    const existing = await this.store.getEmbeddingProgress(workspaceId);
    await this.store.setEmbeddingProgress({
      workspaceId,
      total,
      embedded: Math.min(total, existing.embedded + 1),
    });
    await this.audit?.record({
      workspaceId,
      action: 'ai.embed_job',
      targetType: 'document',
      targetId: docId,
      metadata: { chunks: chunks.length },
    });
  }

  async retrieve(
    workspaceId: string,
    query: string,
    limit = 4
  ): Promise<EmbeddingChunk[]> {
    const vector = hashEmbed(query);
    const chunks = await this.store.listEmbeddingChunks(workspaceId);
    return chunks
      .map(chunk => ({ chunk, score: cosine(vector, chunk.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.chunk);
  }

  async addIgnored(
    user: User,
    workspaceId: string,
    docIds: string[]
  ): Promise<number> {
    await this.workspaces.requireAdmin(user, workspaceId);
    const docs: EmbeddingIgnoredDoc[] = docIds.map(docId => ({
      workspaceId,
      docId,
      createdBy: user.id,
      createdAt: this.clock.now(),
    }));
    return this.store.addIgnoredDocs(docs);
  }

  async removeIgnored(
    user: User,
    workspaceId: string,
    docIds: string[]
  ): Promise<number> {
    await this.workspaces.requireAdmin(user, workspaceId);
    return this.store.removeIgnoredDocs(workspaceId, docIds);
  }

  async listIgnored(
    user: User,
    workspaceId: string
  ): Promise<EmbeddingIgnoredDoc[]> {
    await this.workspaces.requireMember(user, workspaceId);
    return this.store.listIgnoredDocs(workspaceId);
  }

  async addArtifact(
    user: User,
    workspaceId: string,
    input: {
      fileName: string;
      mediaType: string;
      size: number;
      contentHash: string;
    }
  ): Promise<EmbeddingArtifact> {
    await this.workspaces.requireAdmin(user, workspaceId);
    return this.store.createArtifact({
      artifactId: crypto.randomUUID(),
      workspaceId,
      fileName: input.fileName,
      mediaType: input.mediaType,
      size: input.size,
      contentHash: input.contentHash,
      embeddingStatus: 'pending',
      createdAt: this.clock.now(),
    });
  }

  async listArtifacts(
    user: User,
    workspaceId: string
  ): Promise<EmbeddingArtifact[]> {
    await this.workspaces.requireMember(user, workspaceId);
    return this.store.listArtifacts(workspaceId);
  }

  async removeArtifact(
    user: User,
    workspaceId: string,
    artifactId: string
  ): Promise<boolean> {
    await this.workspaces.requireAdmin(user, workspaceId);
    const artifact = await this.store.getArtifact(artifactId);
    if (!artifact || artifact.workspaceId !== workspaceId) {
      return false;
    }
    return this.store.deleteArtifact(artifactId);
  }
}
