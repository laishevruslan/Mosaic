/**
 * Sticky note preset (WC2). Pure data — no BlockSuite runtime.
 * Kind lives on affine:note edgeless.kind; this file is the Mosaic defaults.
 */

import {
  MOSAIC_STICKY_DARK,
  MOSAIC_STICKY_LIGHT,
  MOSAIC_STICKY_SWATCH_IDS,
  type MosaicStickySwatchId,
} from './tokens';

export const MOSAIC_STICKY_TOOL = 'mosaic:sticky';
export const MOSAIC_STICKY_KIND = 'sticky';
export const MOSAIC_STICKY_DEFAULT_SWATCH: MosaicStickySwatchId = 'butter';

/** Matches BlockSuite NOTE_MIN_WIDTH (170 + 24×2). Plan target is ~200. */
export const MOSAIC_STICKY_WIDTH = 218;
export const MOSAIC_STICKY_HEIGHT = 200;

export const MOSAIC_STICKY_SHADOW = '--affine-note-shadow-sticker';
export const MOSAIC_STICKY_RADIUS = 8;
export const MOSAIC_STICKY_BORDER_STYLE = 'none';
export const MOSAIC_STICKY_DISPLAY_MODE = 'edgeless';

export type MosaicStickyColor = {
  light: string;
  dark: string;
};

export type MosaicStickyNoteProps = {
  xywh: string;
  background: MosaicStickyColor;
  displayMode: typeof MOSAIC_STICKY_DISPLAY_MODE;
  hidden: false;
  edgeless: {
    kind: typeof MOSAIC_STICKY_KIND;
    collapse: false;
    style: {
      borderRadius: number;
      borderSize: number;
      borderStyle: typeof MOSAIC_STICKY_BORDER_STYLE;
      shadowType: typeof MOSAIC_STICKY_SHADOW;
    };
  };
};

export function mosaicStickyBackground(
  id: MosaicStickySwatchId = MOSAIC_STICKY_DEFAULT_SWATCH
): MosaicStickyColor {
  return {
    light: MOSAIC_STICKY_LIGHT[id],
    dark: MOSAIC_STICKY_DARK[id],
  };
}

export function stickySwatchFromColor(
  color: unknown
): MosaicStickySwatchId | null {
  const hexes: string[] = [];
  if (typeof color === 'string') hexes.push(color);
  if (color && typeof color === 'object') {
    const record = color as Record<string, unknown>;
    for (const key of ['light', 'dark', 'normal'] as const) {
      if (typeof record[key] === 'string') hexes.push(record[key]);
    }
  }
  const lower = new Set(hexes.map(hex => hex.toLowerCase()));
  for (const id of MOSAIC_STICKY_SWATCH_IDS) {
    if (
      lower.has(MOSAIC_STICKY_LIGHT[id].toLowerCase()) ||
      lower.has(MOSAIC_STICKY_DARK[id].toLowerCase())
    ) {
      return id;
    }
  }
  return null;
}

export function createStickyNoteProps(input: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  swatch?: MosaicStickySwatchId;
}): MosaicStickyNoteProps {
  const width = input.width ?? MOSAIC_STICKY_WIDTH;
  const height = input.height ?? MOSAIC_STICKY_HEIGHT;
  const swatch = input.swatch ?? MOSAIC_STICKY_DEFAULT_SWATCH;
  return {
    xywh: `[${input.x},${input.y},${width},${height}]`,
    background: mosaicStickyBackground(swatch),
    displayMode: MOSAIC_STICKY_DISPLAY_MODE,
    hidden: false,
    edgeless: {
      kind: MOSAIC_STICKY_KIND,
      collapse: false,
      style: {
        borderRadius: MOSAIC_STICKY_RADIUS,
        borderSize: 0,
        borderStyle: MOSAIC_STICKY_BORDER_STYLE,
        shadowType: MOSAIC_STICKY_SHADOW,
      },
    },
  };
}
