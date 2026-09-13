import type {
  MosaicBound,
  MosaicViewportSetOptions,
  MosaicViewportState,
} from './types';

export function viewportCenterFromTopLeft(state: MosaicViewportState): {
  centerX: number;
  centerY: number;
} {
  return {
    centerX: state.x + state.width / 2 / state.zoom,
    centerY: state.y + state.height / 2 / state.zoom,
  };
}

export function viewportTopLeftFromCenter(input: {
  centerX: number;
  centerY: number;
  zoom: number;
  width: number;
  height: number;
}): Pick<MosaicViewportState, 'x' | 'y'> {
  return {
    x: input.centerX - input.width / 2 / input.zoom,
    y: input.centerY - input.height / 2 / input.zoom,
  };
}

export function unionBounds(
  bounds: readonly MosaicBound[]
): MosaicBound | null {
  if (!bounds.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const bound of bounds) {
    if (!Number.isFinite(bound.w) || !Number.isFinite(bound.h)) continue;
    if (bound.w <= 0 || bound.h <= 0) continue;
    minX = Math.min(minX, bound.x);
    minY = Math.min(minY, bound.y);
    maxX = Math.max(maxX, bound.x + bound.w);
    maxY = Math.max(maxY, bound.y + bound.h);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function isMosaicBound(value: unknown): value is MosaicBound {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.x === 'number' &&
    typeof record.y === 'number' &&
    typeof record.w === 'number' &&
    typeof record.h === 'number'
  );
}

export function applyViewportSet(
  current: MosaicViewportState,
  x: number,
  y: number,
  zoom: number,
  _options?: MosaicViewportSetOptions
): { centerX: number; centerY: number; zoom: number } {
  const nextZoom = zoom > 0 && Number.isFinite(zoom) ? zoom : current.zoom;
  const { centerX, centerY } = viewportCenterFromTopLeft({
    x,
    y,
    zoom: nextZoom,
    width: current.width,
    height: current.height,
  });
  return { centerX, centerY, zoom: nextZoom };
}
