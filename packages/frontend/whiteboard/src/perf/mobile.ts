import {
  WHITEBOARD_LOD,
  WHITEBOARD_LOD_MOBILE,
  type WhiteboardLodConfig,
} from '../const';

export function isMobileViewport(): boolean {
  if (typeof globalThis.matchMedia !== 'function') {
    return false;
  }
  try {
    return globalThis.matchMedia(
      '(max-width: 768px), (pointer: coarse)'
    ).matches;
  } catch {
    return false;
  }
}

export function resolveWhiteboardLod(
  mobile = isMobileViewport()
): WhiteboardLodConfig {
  return mobile ? WHITEBOARD_LOD_MOBILE : WHITEBOARD_LOD;
}

/** Charts and sketches stay create-only on mobile; kanban stays read+move. */
export function mobileWidgetCreateOnly(
  kind: 'chart' | 'sketch' | 'kanban'
): boolean {
  if (!isMobileViewport()) return false;
  return kind === 'chart' || kind === 'sketch';
}
