import { describe, expect, it } from 'vitest';

import {
  createStickyNoteProps,
  MOSAIC_STICKY_BORDER_STYLE,
  MOSAIC_STICKY_DEFAULT_SWATCH,
  MOSAIC_STICKY_DISPLAY_MODE,
  MOSAIC_STICKY_HEIGHT,
  MOSAIC_STICKY_KIND,
  MOSAIC_STICKY_RADIUS,
  MOSAIC_STICKY_SHADOW,
  MOSAIC_STICKY_TOOL,
  MOSAIC_STICKY_WIDTH,
  mosaicStickyBackground,
  stickySwatchFromColor,
} from './sticky-preset';
import { MOSAIC_STICKY_DARK, MOSAIC_STICKY_LIGHT } from './tokens';

const FORBIDDEN = [
  '#4262ff',
  '#ffd02f',
  '#ff9999',
  'roobert',
  'mirotone',
  '@mirohq',
] as const;

describe('mosaic sticky preset', () => {
  it('places a 218×200 edgeless sticky with sticker shadow and butter paper', () => {
    const props = createStickyNoteProps({ x: 40, y: 80 });

    expect(MOSAIC_STICKY_TOOL).toBe('mosaic:sticky');
    expect(MOSAIC_STICKY_KIND).toBe('sticky');
    expect(MOSAIC_STICKY_WIDTH).toBe(218);
    expect(MOSAIC_STICKY_HEIGHT).toBe(200);
    expect(props.xywh).toBe('[40,80,218,200]');
    expect(props.displayMode).toBe(MOSAIC_STICKY_DISPLAY_MODE);
    expect(props.displayMode).toBe('edgeless');
    expect(props.hidden).toBe(false);
    expect(props.edgeless.kind).toBe('sticky');
    expect(props.edgeless.collapse).toBe(false);
    expect(props.edgeless.style.borderRadius).toBe(MOSAIC_STICKY_RADIUS);
    expect(props.edgeless.style.borderSize).toBe(0);
    expect(props.edgeless.style.borderStyle).toBe(MOSAIC_STICKY_BORDER_STYLE);
    expect(props.edgeless.style.shadowType).toBe(MOSAIC_STICKY_SHADOW);
    expect(props.edgeless.style.shadowType).toBe(
      '--affine-note-shadow-sticker'
    );
    expect(props.background).toEqual(
      mosaicStickyBackground(MOSAIC_STICKY_DEFAULT_SWATCH)
    );
    expect(props.background.light).toBe(MOSAIC_STICKY_LIGHT.butter);
    expect(props.background.dark).toBe(MOSAIC_STICKY_DARK.butter);
    expect(props).not.toHaveProperty('connectable');
  });

  it('maps stored colors back to Mosaic swatch ids', () => {
    expect(stickySwatchFromColor(MOSAIC_STICKY_LIGHT.mint)).toBe('mint');
    expect(
      stickySwatchFromColor({
        light: MOSAIC_STICKY_LIGHT.lilac,
        dark: MOSAIC_STICKY_DARK.lilac,
      })
    ).toBe('lilac');
    expect(stickySwatchFromColor('#ffffff')).toBeNull();
  });

  it('keeps Mosaic pastels and Affine sticker shadow out of competing-product dress', () => {
    const blob = JSON.stringify({
      ...createStickyNoteProps({ x: 0, y: 0, swatch: 'peach' }),
      light: MOSAIC_STICKY_LIGHT,
      dark: MOSAIC_STICKY_DARK,
    }).toLowerCase();

    for (const token of FORBIDDEN) {
      expect(blob).not.toContain(token);
    }
  });
});
