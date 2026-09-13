/**
 * Mosaic workshop chrome tokens (WC0).
 * Overlay on Affine `--affine-*` / `cssVarV2`; not a replacement theme.
 * Accent is teal, not Affine brand blue and not third-party trade dress.
 */

export const MOSAIC_FONT_UI_VALUE = 'var(--affine-font-family)';

export const MOSAIC_ACCENT = '#0d7377';
export const MOSAIC_ACCENT_HOVER = '#0a5c5f';
export const MOSAIC_ACCENT_PRESSED = '#08484a';

/** Slightly lighter teal for dark chrome so active icons stay readable. */
export const MOSAIC_ACCENT_DARK = '#3cb8bd';
export const MOSAIC_ACCENT_HOVER_DARK = '#4ec8cc';
export const MOSAIC_ACCENT_PRESSED_DARK = '#2aa8ad';

export const MOSAIC_PAPER_VALUE = 'var(--affine-background-overlay-panel-color)';
export const MOSAIC_CHROME_RADIUS_PX = 8;
export const MOSAIC_CHROME_BORDER_VALUE = '1px solid var(--affine-border-color)';
export const MOSAIC_CHROME_SHADOW_VALUE = 'var(--affine-shadow-2)';

export const MOSAIC_HIT = 32;
export const MOSAIC_HIT_COMFORTABLE = 36;
export const MOSAIC_ICON = 20;
export const MOSAIC_SPACE = 4;
export const MOSAIC_PANEL_PADDING = 8;

export const MOSAIC_STICKY_SWATCH_IDS = [
  'butter',
  'peach',
  'blush',
  'mint',
  'lilac',
  'fog',
] as const;

export type MosaicStickySwatchId = (typeof MOSAIC_STICKY_SWATCH_IDS)[number];

export const MOSAIC_STICKY_LIGHT: Record<MosaicStickySwatchId, string> = {
  butter: '#F7E7B8',
  peach: '#F6D4B8',
  blush: '#F3C9D4',
  mint: '#D4EBD6',
  lilac: '#DDD5F0',
  fog: '#E8ECF1',
};

/**
 * Dark sticky papers are Mosaic hexes (not Affine note tokens).
 * Tuned so `--mosaic-sticky-ink` meets WCAG 2.1 AA (≥ 4.5:1).
 */
export const MOSAIC_STICKY_DARK: Record<MosaicStickySwatchId, string> = {
  butter: '#6B5A28',
  peach: '#6B4A30',
  blush: '#6B3850',
  mint: '#355C3E',
  lilac: '#4A4270',
  fog: '#3A4250',
};

export const MOSAIC_STICKY_INK_LIGHT = '#3A3228';
export const MOSAIC_STICKY_INK_DARK = '#F4EFE6';

export const MOSAIC_TEXT_CONTRAST_AA = 4.5;

export const MOSAIC_CSS_VAR = {
  fontUi: '--mosaic-font-ui',
  accent: '--mosaic-accent',
  accentHover: '--mosaic-accent-hover',
  accentPressed: '--mosaic-accent-pressed',
  paper: '--mosaic-paper',
  chromeRadius: '--mosaic-chrome-radius',
  chromeBorder: '--mosaic-chrome-border',
  chromeShadow: '--mosaic-chrome-shadow',
  hit: '--mosaic-hit',
  hitComfortable: '--mosaic-hit-comfortable',
  icon: '--mosaic-icon',
  space: '--mosaic-space',
  stickyInk: '--mosaic-sticky-ink',
  stickyButter: '--mosaic-sticky-butter',
  stickyPeach: '--mosaic-sticky-peach',
  stickyBlush: '--mosaic-sticky-blush',
  stickyMint: '--mosaic-sticky-mint',
  stickyLilac: '--mosaic-sticky-lilac',
  stickyFog: '--mosaic-sticky-fog',
} as const;

export const MOSAIC_STICKY_CSS_VAR: Record<
  MosaicStickySwatchId,
  `--mosaic-sticky-${MosaicStickySwatchId}`
> = {
  butter: '--mosaic-sticky-butter',
  peach: '--mosaic-sticky-peach',
  blush: '--mosaic-sticky-blush',
  mint: '--mosaic-sticky-mint',
  lilac: '--mosaic-sticky-lilac',
  fog: '--mosaic-sticky-fog',
};

export type MosaicChromeTheme = 'light' | 'dark';

function parseHex(hex: string): { r: number; g: number; b: number } {
  const raw = hex.trim().replace(/^#/, '');
  if (raw.length === 3) {
    const r = Number.parseInt(raw[0] + raw[0], 16);
    const g = Number.parseInt(raw[1] + raw[1], 16);
    const b = Number.parseInt(raw[2] + raw[2], 16);
    return { r, g, b };
  }
  if (raw.length !== 6) {
    throw new Error(`Expected #RGB or #RRGGBB, got ${hex}`);
  }
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** WCAG 2.1 contrast ratio of two sRGB hex colors. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function stickyInkForTheme(theme: MosaicChromeTheme): string {
  return theme === 'dark' ? MOSAIC_STICKY_INK_DARK : MOSAIC_STICKY_INK_LIGHT;
}

export function stickyPaperForTheme(
  id: MosaicStickySwatchId,
  theme: MosaicChromeTheme
): string {
  return theme === 'dark' ? MOSAIC_STICKY_DARK[id] : MOSAIC_STICKY_LIGHT[id];
}

export function stickyTextContrast(
  id: MosaicStickySwatchId,
  theme: MosaicChromeTheme
): number {
  return contrastRatio(stickyInkForTheme(theme), stickyPaperForTheme(id, theme));
}

export function lightChromeVars(): Record<string, string> {
  return {
    [MOSAIC_CSS_VAR.fontUi]: MOSAIC_FONT_UI_VALUE,
    [MOSAIC_CSS_VAR.accent]: MOSAIC_ACCENT,
    [MOSAIC_CSS_VAR.accentHover]: MOSAIC_ACCENT_HOVER,
    [MOSAIC_CSS_VAR.accentPressed]: MOSAIC_ACCENT_PRESSED,
    [MOSAIC_CSS_VAR.paper]: MOSAIC_PAPER_VALUE,
    [MOSAIC_CSS_VAR.chromeRadius]: `${MOSAIC_CHROME_RADIUS_PX}px`,
    [MOSAIC_CSS_VAR.chromeBorder]: MOSAIC_CHROME_BORDER_VALUE,
    [MOSAIC_CSS_VAR.chromeShadow]: MOSAIC_CHROME_SHADOW_VALUE,
    [MOSAIC_CSS_VAR.hit]: `${MOSAIC_HIT}px`,
    [MOSAIC_CSS_VAR.hitComfortable]: `${MOSAIC_HIT_COMFORTABLE}px`,
    [MOSAIC_CSS_VAR.icon]: `${MOSAIC_ICON}px`,
    [MOSAIC_CSS_VAR.space]: `${MOSAIC_SPACE}px`,
    [MOSAIC_CSS_VAR.stickyInk]: MOSAIC_STICKY_INK_LIGHT,
    [MOSAIC_CSS_VAR.stickyButter]: MOSAIC_STICKY_LIGHT.butter,
    [MOSAIC_CSS_VAR.stickyPeach]: MOSAIC_STICKY_LIGHT.peach,
    [MOSAIC_CSS_VAR.stickyBlush]: MOSAIC_STICKY_LIGHT.blush,
    [MOSAIC_CSS_VAR.stickyMint]: MOSAIC_STICKY_LIGHT.mint,
    [MOSAIC_CSS_VAR.stickyLilac]: MOSAIC_STICKY_LIGHT.lilac,
    [MOSAIC_CSS_VAR.stickyFog]: MOSAIC_STICKY_LIGHT.fog,
  };
}

export function darkChromeVars(): Record<string, string> {
  return {
    ...lightChromeVars(),
    [MOSAIC_CSS_VAR.accent]: MOSAIC_ACCENT_DARK,
    [MOSAIC_CSS_VAR.accentHover]: MOSAIC_ACCENT_HOVER_DARK,
    [MOSAIC_CSS_VAR.accentPressed]: MOSAIC_ACCENT_PRESSED_DARK,
    [MOSAIC_CSS_VAR.stickyInk]: MOSAIC_STICKY_INK_DARK,
    [MOSAIC_CSS_VAR.stickyButter]: MOSAIC_STICKY_DARK.butter,
    [MOSAIC_CSS_VAR.stickyPeach]: MOSAIC_STICKY_DARK.peach,
    [MOSAIC_CSS_VAR.stickyBlush]: MOSAIC_STICKY_DARK.blush,
    [MOSAIC_CSS_VAR.stickyMint]: MOSAIC_STICKY_DARK.mint,
    [MOSAIC_CSS_VAR.stickyLilac]: MOSAIC_STICKY_DARK.lilac,
    [MOSAIC_CSS_VAR.stickyFog]: MOSAIC_STICKY_DARK.fog,
  };
}
