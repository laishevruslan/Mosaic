import { describe, expect, it } from 'vitest';

import { isBlobKey } from '../../src/domain/blob.js';

describe('isBlobKey', () => {
  it('accepts BlockSuite sha() keys (base64url with = padding)', () => {
    expect(isBlobKey('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')).toBe(
      true
    );
    expect(isBlobKey('abcdEFGH0123-_xyZ9wq')).toBe(true);
  });

  it('accepts hex digests and simple test keys', () => {
    expect(isBlobKey('sketch-1')).toBe(true);
    expect(isBlobKey('a'.repeat(64))).toBe(true);
  });

  it('rejects path traversal and empty keys', () => {
    expect(isBlobKey('')).toBe(false);
    expect(isBlobKey('../etc/passwd')).toBe(false);
    expect(isBlobKey('a/b')).toBe(false);
    expect(isBlobKey('a\\b')).toBe(false);
    expect(isBlobKey('abc===')).toBe(false);
  });
});
