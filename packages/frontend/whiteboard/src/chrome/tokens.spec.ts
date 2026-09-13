import { describe, expect, it } from 'vitest';

import {
  mosaicChromeIconButton,
  mosaicChromePanel,
  mosaicStickySwatch,
} from './panel.css';
import {
  contrastRatio,
  darkChromeVars,
  lightChromeVars,
  MOSAIC_ACCENT,
  MOSAIC_ACCENT_DARK,
  MOSAIC_ACCENT_HOVER,
  MOSAIC_ACCENT_HOVER_DARK,
  MOSAIC_ACCENT_PRESSED,
  MOSAIC_ACCENT_PRESSED_DARK,
  MOSAIC_CHROME_RADIUS_PX,
  MOSAIC_CSS_VAR,
  MOSAIC_FONT_UI_VALUE,
  MOSAIC_HIT,
  MOSAIC_HIT_COMFORTABLE,
  MOSAIC_ICON,
  MOSAIC_SPACE,
  MOSAIC_STICKY_DARK,
  MOSAIC_STICKY_INK_DARK,
  MOSAIC_STICKY_INK_LIGHT,
  MOSAIC_STICKY_LIGHT,
  MOSAIC_STICKY_SWATCH_IDS,
  MOSAIC_TEXT_CONTRAST_AA,
  stickyTextContrast,
} from './tokens';

/** Trade-dress / competing-product checklist — asserted absent from token values. */
const FORBIDDEN_SUBSTRINGS = [
  '#4262ff',
  '#ffd02f',
  '#ff9999',
  'roobert',
  'mirotone',
  '@mirohq',
] as const;

describe('mosaic workshop chrome tokens', () => {
  it('keeps Affine UI font and Mosaic teal accent', () => {
    const light = lightChromeVars();
    const dark = darkChromeVars();

    expect(light[MOSAIC_CSS_VAR.fontUi]).toBe(MOSAIC_FONT_UI_VALUE);
    expect(dark[MOSAIC_CSS_VAR.fontUi]).toBe(MOSAIC_FONT_UI_VALUE);
    expect(MOSAIC_FONT_UI_VALUE).toBe('var(--affine-font-family)');
    expect(light[MOSAIC_CSS_VAR.accent]).toBe(MOSAIC_ACCENT);
    expect(MOSAIC_ACCENT.toLowerCase()).toBe('#0d7377');
    expect(dark[MOSAIC_CSS_VAR.accent]).toBe(MOSAIC_ACCENT_DARK);
    expect(light[MOSAIC_CSS_VAR.accent].toLowerCase()).not.toBe('#4262ff');
    expect(dark[MOSAIC_CSS_VAR.accent].toLowerCase()).not.toBe('#4262ff');
  });

  it('exposes icon-button hit areas 32 and 36 and a 20px icon', () => {
    const light = lightChromeVars();
    expect(MOSAIC_HIT).toBe(32);
    expect(MOSAIC_HIT_COMFORTABLE).toBe(36);
    expect(MOSAIC_ICON).toBe(20);
    expect(MOSAIC_SPACE).toBe(4);
    expect(MOSAIC_CHROME_RADIUS_PX).toBe(8);
    expect(light[MOSAIC_CSS_VAR.hit]).toBe('32px');
    expect(light[MOSAIC_CSS_VAR.hitComfortable]).toBe('36px');
    expect(light[MOSAIC_CSS_VAR.icon]).toBe('20px');
    expect(mosaicChromeIconButton.hit).toBeTypeOf('string');
    expect(mosaicChromeIconButton.comfortable).toBeTypeOf('string');
    expect(mosaicChromePanel).toBeTypeOf('string');
  });

  it.each(['light', 'dark'] as const)(
    'sticky pastel text contrast is AA in %s theme',
    theme => {
      for (const id of MOSAIC_STICKY_SWATCH_IDS) {
        expect(
          stickyTextContrast(id, theme),
          `${id} ${theme}`
        ).toBeGreaterThanOrEqual(MOSAIC_TEXT_CONTRAST_AA);
        expect(mosaicStickySwatch[id]).toBeTypeOf('string');
      }
    }
  );

  it('meets AA for the teal accent on white', () => {
    expect(contrastRatio(MOSAIC_ACCENT, '#ffffff')).toBeGreaterThanOrEqual(
      MOSAIC_TEXT_CONTRAST_AA
    );
  });

  it('does not ship forbidden brand hex, font, or packages in token values', () => {
    const haystack = [
      MOSAIC_ACCENT,
      MOSAIC_ACCENT_HOVER,
      MOSAIC_ACCENT_PRESSED,
      MOSAIC_ACCENT_DARK,
      MOSAIC_ACCENT_HOVER_DARK,
      MOSAIC_ACCENT_PRESSED_DARK,
      MOSAIC_FONT_UI_VALUE,
      MOSAIC_STICKY_INK_LIGHT,
      MOSAIC_STICKY_INK_DARK,
      ...Object.values(MOSAIC_STICKY_LIGHT),
      ...Object.values(MOSAIC_STICKY_DARK),
      ...Object.values(lightChromeVars()),
      ...Object.values(darkChromeVars()),
    ]
      .join('\n')
      .toLowerCase();

    for (const needle of FORBIDDEN_SUBSTRINGS) {
      expect(haystack, needle).not.toContain(needle);
    }
  });
});
