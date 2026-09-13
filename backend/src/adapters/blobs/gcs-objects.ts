import { errors } from '../../domain/errors.js';
import type { BlobObjectStore } from '../../domain/ports.js';

/**
 * GCS driver stub (E-Plat). Production GCS should use the S3-compatible XML API
 * (`BLOB_DRIVER=s3` + GCS HMAC keys) until a native `@google-cloud/storage`
 * adapter lands with the GCloud plugin track.
 */
export class GcsBlobObjects implements BlobObjectStore {
  readonly driver = 'gcs' as const;

  constructor(
    _bucket?: string,
    private readonly kmsKeyName?: string
  ) {}

  kmsConfigured(): boolean {
    return Boolean(this.kmsKeyName);
  }

  async put(): Promise<void> {
    throw errors.blobDriverUnimplemented('gcs');
  }

  async get(): Promise<Uint8Array | null> {
    throw errors.blobDriverUnimplemented('gcs');
  }

  async delete(): Promise<void> {
    throw errors.blobDriverUnimplemented('gcs');
  }

  async close(): Promise<void> {}
}
