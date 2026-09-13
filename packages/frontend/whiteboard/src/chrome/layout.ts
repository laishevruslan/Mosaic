/**
 * WC1 layout geometry. Overlay on existing BlockSuite widgets; no Miro chrome.
 */

/** Matches stock zoom `@container viewport (width <= 1200px)`. Editor width, not the window. */
export const MOSAIC_WORKSHOP_BREAKPOINT = 1200;
export const MOSAIC_CHROME_INSET = 12;
/** Comfortable icon-button + panel padding 8+8. */
export const MOSAIC_RAIL_WIDTH = 52;
export const MOSAIC_ZOOM_CLUSTER_HEIGHT = 40;
export const MOSAIC_ZOOM_CLUSTER_WIDTH = 168;
export const MOSAIC_SELECTION_BAR_HEIGHT = 36;
export const MOSAIC_RAIL_ZOOM_GAP = 8;

export const MOSAIC_WORKSHOP_CHROME_ATTR = 'data-mosaic-workshop-chrome';
export const MOSAIC_WORKSHOP_LAYOUT_ATTR = 'data-mosaic-layout';

export type MosaicWorkshopChromeMode = 'rail' | 'fallback';

export type MosaicLayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MosaicRailLayoutInput = {
  flag: boolean;
  isMobile: boolean;
  presentMode: boolean;
  viewportWidth: number;
};

export function shouldUseRailLayout(input: MosaicRailLayoutInput): boolean {
  return (
    input.flag &&
    !input.isMobile &&
    !input.presentMode &&
    input.viewportWidth > MOSAIC_WORKSHOP_BREAKPOINT
  );
}

export function workshopChromeMode(
  input: MosaicRailLayoutInput
): MosaicWorkshopChromeMode {
  return shouldUseRailLayout(input) ? 'rail' : 'fallback';
}

/** Vertically centered left rail. */
export function centeredRailRect(
  viewportHeight: number,
  railHeight: number,
  inset = MOSAIC_CHROME_INSET
): MosaicLayoutRect {
  const h = Math.max(0, railHeight);
  const y = Math.max(0, (viewportHeight - h) / 2);
  return { x: inset, y, w: MOSAIC_RAIL_WIDTH, h };
}

/** Zoom cluster, bottom-left inset. */
export function zoomClusterRect(
  viewportHeight: number,
  inset = MOSAIC_CHROME_INSET
): MosaicLayoutRect {
  return {
    x: inset,
    y: viewportHeight - inset - MOSAIC_ZOOM_CLUSTER_HEIGHT,
    w: MOSAIC_ZOOM_CLUSTER_WIDTH,
    h: MOSAIC_ZOOM_CLUSTER_HEIGHT,
  };
}

export function rectsOverlap(
  a: MosaicLayoutRect,
  b: MosaicLayoutRect,
  gap = 0
): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

export function railOverlapsZoom(input: {
  viewportHeight: number;
  railHeight: number;
  gap?: number;
}): boolean {
  const rail = centeredRailRect(input.viewportHeight, input.railHeight);
  const zoom = zoomClusterRect(input.viewportHeight);
  return rectsOverlap(rail, zoom, input.gap ?? MOSAIC_RAIL_ZOOM_GAP);
}
