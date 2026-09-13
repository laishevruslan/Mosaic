import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import type { BlobObjectStore } from '../../domain/ports.js';
import { GcsBlobObjects } from './gcs-objects.js';
import { MemoryBlobObjects } from './memory-objects.js';
import { S3BlobObjects } from './s3-objects.js';

function assertSafeKey(root: string, objectKey: string): string {
  const full = resolve(root, objectKey);
  const prefix = resolve(root) + sep;
  if (full !== resolve(root) && !full.startsWith(prefix)) {
    throw new Error('Invalid blob object key.');
  }
  return full;
}

export class FileSystemBlobObjects implements BlobObjectStore {
  readonly driver = 'fs' as const;
  constructor(private readonly root: string) {}

  async put(objectKey: string, bytes: Uint8Array): Promise<void> {
    const path = assertSafeKey(this.root, objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(objectKey: string): Promise<Uint8Array | null> {
    const path = assertSafeKey(this.root, objectKey);
    try {
      const buffer = await readFile(path);
      return Uint8Array.from(buffer);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(objectKey: string): Promise<void> {
    const path = assertSafeKey(this.root, objectKey);
    await rm(path, { force: true });
  }

  async close(): Promise<void> {}
}

export interface BlobObjectsInput {
  driver?: 'memory' | 'fs' | 's3' | 'gcs';
  dir: string;
  nodeEnv: string;
  s3?: {
    bucket?: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
    forcePathStyle: boolean;
  };
  gcsBucket?: string;
}

export function createBlobObjects(input: BlobObjectsInput): BlobObjectStore {
  if (
    input.driver === 'memory' ||
    (!input.driver && input.nodeEnv === 'test')
  ) {
    return new MemoryBlobObjects();
  }
  if (input.driver === 's3') {
    const bucket = input.s3?.bucket?.trim();
    const accessKeyId = input.s3?.accessKeyId?.trim();
    const secretAccessKey = input.s3?.secretAccessKey?.trim();
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'BLOB_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.'
      );
    }
    const options: ConstructorParameters<typeof S3BlobObjects>[0] = {
      bucket,
      region: input.s3?.region ?? 'us-east-1',
      accessKeyId,
      secretAccessKey,
      forcePathStyle: input.s3?.forcePathStyle ?? false,
    };
    if (input.s3?.endpoint) {
      options.endpoint = input.s3.endpoint;
    }
    return new S3BlobObjects(options);
  }
  if (input.driver === 'gcs') {
    return new GcsBlobObjects(input.gcsBucket);
  }
  return new FileSystemBlobObjects(resolve(input.dir));
}
