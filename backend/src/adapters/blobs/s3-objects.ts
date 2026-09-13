import { createHash, createHmac } from 'node:crypto';

import type { BlobObjectStore } from '../../domain/ports.js';

export interface S3BlobOptions {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  fetch?: typeof fetch;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function signingKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeObjectKey(objectKey: string): string {
  return objectKey
    .split('/')
    .map(part => encodeRfc3986(part))
    .join('/');
}

function amzDate(now: Date): { amz: string; stamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amz: iso, stamp: iso.slice(0, 8) };
}

export class S3BlobObjects implements BlobObjectStore {
  readonly driver = 's3' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: S3BlobOptions) {
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async put(objectKey: string, bytes: Uint8Array): Promise<void> {
    const response = await this.request('PUT', objectKey, bytes);
    if (!response.ok) {
      throw new Error(
        `S3 PutObject failed (${response.status}): ${await response.text()}`
      );
    }
  }

  async get(objectKey: string): Promise<Uint8Array | null> {
    const response = await this.request('GET', objectKey);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(
        `S3 GetObject failed (${response.status}): ${await response.text()}`
      );
    }
    return Uint8Array.from(Buffer.from(await response.arrayBuffer()));
  }

  async delete(objectKey: string): Promise<void> {
    const response = await this.request('DELETE', objectKey);
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `S3 DeleteObject failed (${response.status}): ${await response.text()}`
      );
    }
  }

  async close(): Promise<void> {}

  private endpointHost(): { host: string; url: URL; pathStyle: boolean } {
    const pathStyle = this.opts.forcePathStyle ?? Boolean(this.opts.endpoint);
    if (this.opts.endpoint) {
      const url = new URL(this.opts.endpoint);
      return { host: url.host, url, pathStyle };
    }
    const host = `${this.opts.bucket}.s3.${this.opts.region}.amazonaws.com`;
    return {
      host,
      url: new URL(`https://${host}`),
      pathStyle: false,
    };
  }

  private objectUrl(objectKey: string): { url: URL; host: string } {
    const { host, url, pathStyle } = this.endpointHost();
    const encoded = encodeObjectKey(objectKey);
    const path = pathStyle
      ? `${url.pathname.replace(/\/$/, '')}/${this.opts.bucket}/${encoded}`
      : `${url.pathname.replace(/\/$/, '')}/${encoded}`;
    const target = new URL(url.toString());
    target.pathname = path.startsWith('/') ? path : `/${path}`;
    return { url: target, host };
  }

  private async request(
    method: 'GET' | 'PUT' | 'DELETE',
    objectKey: string,
    body?: Uint8Array
  ): Promise<Response> {
    const { url, host } = this.objectUrl(objectKey);
    const now = new Date();
    const { amz, stamp } = amzDate(now);
    const payloadHash = body ? sha256Hex(body) : sha256Hex('');
    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amz}`,
    ].join('\n');
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      method,
      url.pathname,
      url.search.replace(/^\?/, ''),
      `${canonicalHeaders}\n`,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${stamp}/${this.opts.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amz,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');
    const signature = createHmac(
      'sha256',
      signingKey(this.opts.secretAccessKey, stamp, this.opts.region, 's3')
    )
      .update(stringToSign, 'utf8')
      .digest('hex');
    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amz,
      authorization: `AWS4-HMAC-SHA256 Credential=${this.opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    const init: RequestInit = { method, headers };
    if (body) {
      init.body = Buffer.from(body);
    }
    return this.fetchImpl(url, init);
  }
}
