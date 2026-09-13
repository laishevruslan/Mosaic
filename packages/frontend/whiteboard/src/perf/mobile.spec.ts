import { describe, expect, it } from 'vitest';

import { WHITEBOARD_LOD, WHITEBOARD_LOD_MOBILE } from '../const';
import {
  getWidgetLodLevel,
  maxLiveForKind,
} from './policy';
import {
  isMobileViewport,
  mobileWidgetCreateOnly,
  resolveWhiteboardLod,
} from './mobile';

describe('whiteboard mobile LOD', () => {
  it('stays on the desktop profile in Node (no matchMedia)', () => {
    expect(isMobileViewport()).toBe(false);
    expect(resolveWhiteboardLod()).toEqual(WHITEBOARD_LOD);
    expect(resolveWhiteboardLod(true)).toEqual(WHITEBOARD_LOD_MOBILE);
    expect(WHITEBOARD_LOD_MOBILE.z0).toBeGreaterThan(WHITEBOARD_LOD.z0);
    expect(WHITEBOARD_LOD_MOBILE.maxLiveCharts).toBe(1);
    expect(mobileWidgetCreateOnly('chart')).toBe(false);
    expect(mobileWidgetCreateOnly('kanban')).toBe(false);
  });

  it('applies conservative live budgets and zoom thresholds when forced mobile', () => {
    const lod = resolveWhiteboardLod(true);
    expect(lod.z0).toBeGreaterThan(WHITEBOARD_LOD.z0);
    expect(lod.z1).toBeGreaterThan(WHITEBOARD_LOD.z1);
    expect(getWidgetLodLevel(WHITEBOARD_LOD.z0 - 0.01, false, false)).toBe(
      'l0'
    );
    expect(maxLiveForKind('chart')).toBe(WHITEBOARD_LOD.maxLiveCharts);
    expect(lod.maxLiveKanban).toBe(1);
    expect(lod.l1KanbanCards).toBe(2);
  });
});
