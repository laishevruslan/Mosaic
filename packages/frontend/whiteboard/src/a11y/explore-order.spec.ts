import { describe, expect, it } from 'vitest';

import { nextInReadingOrder, readingOrder } from './explore-order';

describe('whiteboard keyboard explore order', () => {
  const items = [
    { id: 'right', x: 80, y: 10 },
    { id: 'below', x: 10, y: 40 },
    { id: 'left', x: 10, y: 10 },
  ];

  it('sorts top-to-bottom then left-to-right', () => {
    expect(readingOrder(items).map(item => item.id)).toEqual([
      'left',
      'right',
      'below',
    ]);
  });

  it('cycles Tab / Shift-Tab and stays on the edge', () => {
    expect(nextInReadingOrder(items, null, 1)?.id).toBe('left');
    expect(nextInReadingOrder(items, 'left', 1)?.id).toBe('right');
    expect(nextInReadingOrder(items, 'right', 1)?.id).toBe('below');
    expect(nextInReadingOrder(items, 'below', 1)?.id).toBe('below');
    expect(nextInReadingOrder(items, 'left', -1)?.id).toBe('left');
    expect(nextInReadingOrder(items, null, -1)?.id).toBe('below');
  });
});
