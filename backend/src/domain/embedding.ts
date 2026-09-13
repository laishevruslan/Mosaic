export interface EmbeddingChunk {
  id: string;
  workspaceId: string;
  docId: string;
  ordinal: number;
  text: string;
  vector: number[];
  createdAt: Date;
}

export interface EmbeddingIgnoredDoc {
  workspaceId: string;
  docId: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface EmbeddingArtifact {
  artifactId: string;
  workspaceId: string;
  fileName: string;
  mediaType: string;
  size: number;
  contentHash: string;
  embeddingStatus: string;
  createdAt: Date;
}

export interface EmbeddingProgress {
  workspaceId: string;
  total: number;
  embedded: number;
}

export const EMBEDDING_VECTOR_SIZE = 32;
