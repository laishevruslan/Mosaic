export type BlobSourceType = 'currentDoc' | 'history';

export interface StoredBlob {
  workspaceId: string;
  key: string;
  mime: string;
  size: number;
  payloadHash: string;
  createdBy: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface BlobSourceRef {
  type: BlobSourceType;
  workspaceId: string;
  docId: string;
  timestampMs?: number;
}

export interface ManifestBlob {
  key: string;
  mime: string;
  size: number;
  createdAt: string;
  source: BlobSourceRef;
}

export type BlobUploadMethod = 'PRESIGNED' | 'MULTIPART' | 'GRAPHQL';

export interface BlobUploadSession {
  id: string;
  token: string;
  workspaceId: string;
  key: string;
  mime: string;
  size: number;
  method: BlobUploadMethod;
  partSize: number | null;
  expiresAt: Date;
  createdBy: string;
  createdAt: Date;
}

export interface BlobUploadPart {
  uploadId: string;
  partNumber: number;
  etag: string | null;
  token: string;
  size: number;
}

export interface DocHistoryRecord {
  spaceType: 'workspace' | 'userspace';
  spaceId: string;
  docId: string;
  timestamp: number;
  snapshot: Uint8Array;
  editorId: string | null;
}

/**
 * Accept keys the MIT client actually sends without dropping path-safety checks.
 *
 * BlockSuite `sha()` returns base64(SHA-256) with `+/` → `-_`, but keeps RFC 4648
 * `=` padding. Upstream AFFiNE does not regex-validate keys; we still reject `/`,
 * `\\`, and `..` so object-store paths cannot escape the workspace prefix.
 */
export function isBlobKey(value: string): boolean {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256) {
    return false;
  }
  if (
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..')
  ) {
    return false;
  }
  // body: base64url / hex / simple test keys; optional `=` padding at end only
  return /^[A-Za-z0-9._-]+={0,2}$/.test(value);
}

export function parseSourceType(value: string | undefined): BlobSourceType {
  if (value === 'history') {
    return 'history';
  }
  return 'currentDoc';
}
