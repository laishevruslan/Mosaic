import { describe, expect, it } from 'vitest';

import {
  applyViewportSet,
  unionBounds,
  viewportCenterFromTopLeft,
  viewportTopLeftFromCenter,
} from './viewport';

describe('mosaic viewport math', () => {
  it('converts top-left to center and back', () => {
    const state = { x: 100, y: 40, zoom: 2, width: 800, height: 400 };
    const { centerX, centerY } = viewportCenterFromTopLeft(state);
    expect(centerX).toBe(300);
    expect(centerY).toBe(140);
    expect(
      viewportTopLeftFromCenter({
        centerX,
        centerY,
        zoom: 2,
        width: 800,
        height: 400,
      })
    ).toEqual({ x: 100, y: 40 });
  });

  it('unions element bounds and applies set()', () => {
    expect(
      unionBounds([
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 20, y: 5, w: 10, h: 10 },
      ])
    ).toEqual({ x: 0, y: 0, w: 30, h: 15 });
    const next = applyViewportSet(
      { x: 0, y: 0, zoom: 1, width: 1000, height: 500 },
      50,
      25,
      2
    );
    expect(next.zoom).toBe(2);
    expect(next.centerX).toBe(300);
    expect(next.centerY).toBe(150);
  });
});
