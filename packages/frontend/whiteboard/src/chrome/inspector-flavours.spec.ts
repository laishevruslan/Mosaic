import { describe, expect, it } from 'vitest';

import { WHITEBOARD_FLAVOURS } from '../const';
import { isInspectorFlavour } from './inspector-flavours';

describe('workshop inspector flavours', () => {
  it('opens for chart, board, and sketch widgets only', () => {
    expect(isInspectorFlavour(WHITEBOARD_FLAVOURS.chart)).toBe(true);
    expect(isInspectorFlavour(WHITEBOARD_FLAVOURS.board)).toBe(true);
    expect(isInspectorFlavour(WHITEBOARD_FLAVOURS.sketch)).toBe(true);
    expect(isInspectorFlavour(WHITEBOARD_FLAVOURS.recordCard)).toBe(false);
    expect(isInspectorFlavour('affine:note')).toBe(false);
  });
});
