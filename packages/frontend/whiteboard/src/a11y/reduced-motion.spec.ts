import { describe, expect, it } from 'vitest';

import { prefersReducedMotion } from './reduced-motion';

describe('prefersReducedMotion', () => {
  it('is false when matchMedia is unavailable', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
