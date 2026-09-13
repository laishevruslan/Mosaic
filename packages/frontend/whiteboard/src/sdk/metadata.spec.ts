import { describe, expect, it } from 'vitest';

import {
  assertMosaicMetaSize,
  isJsonCompatible,
  mergeMosaicMeta,
  MOSAIC_META_MAX_BYTES,
  mosaicMetaBytes,
  readMosaicMeta,
} from './metadata';

describe('mosaicMeta', () => {
  it('accepts JSON values and rejects functions', () => {
    expect(isJsonCompatible({ a: 1, b: [true, null, 'x'] })).toBe(true);
    expect(isJsonCompatible(() => 0)).toBe(false);
    expect(isJsonCompatible(Number.NaN)).toBe(false);
    expect(readMosaicMeta({ mosaicMeta: { k: 'v' } })).toEqual({ k: 'v' });
    expect(mergeMosaicMeta({ a: 1 }, 'b', false)).toEqual({ a: 1, b: false });
    expect(mergeMosaicMeta({ a: 1 }, 'a', undefined)).toEqual({});
  });

  it('enforces the 6KB cap', () => {
    const small = { note: 'ok' };
    expect(mosaicMetaBytes(small)).toBeLessThan(MOSAIC_META_MAX_BYTES);
    assertMosaicMetaSize(small);
    expect(() =>
      mergeMosaicMeta({}, 'blob', 'n'.repeat(MOSAIC_META_MAX_BYTES))
    ).toThrow(/exceeds/);
  });
});
