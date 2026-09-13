import { style, styleVariants } from '@vanilla-extract/css';

import { MOSAIC_PANEL_PADDING, type MosaicStickySwatchId } from './tokens';

export const mosaicChromePanel = style({
  boxSizing: 'border-box',
  background: 'var(--mosaic-paper)',
  borderRadius: 'var(--mosaic-chrome-radius)',
  border: 'var(--mosaic-chrome-border)',
  boxShadow: 'var(--mosaic-chrome-shadow)',
  padding: MOSAIC_PANEL_PADDING,
  fontFamily: 'var(--mosaic-font-ui)',
  color: 'var(--affine-text-primary-color)',
});

const mosaicChromeIconButtonBase = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--affine-icon-color, var(--affine-text-primary-color))',
  borderRadius: 'var(--mosaic-chrome-radius)',
  cursor: 'pointer',
  flexShrink: 0,
  fontFamily: 'var(--mosaic-font-ui)',
  selectors: {
    '&[data-active="true"]': {
      color: 'var(--mosaic-accent)',
    },
    '&:hover': {
      background: 'var(--affine-hover-color)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--mosaic-accent)',
      outlineOffset: '2px',
    },
  },
});

export const mosaicChromeIconButton = styleVariants({
  hit: [
    mosaicChromeIconButtonBase,
    {
      width: 'var(--mosaic-hit)',
      height: 'var(--mosaic-hit)',
    },
  ],
  comfortable: [
    mosaicChromeIconButtonBase,
    {
      width: 'var(--mosaic-hit-comfortable)',
      height: 'var(--mosaic-hit-comfortable)',
    },
  ],
});

export const mosaicChromeIcon = style({
  width: 'var(--mosaic-icon)',
  height: 'var(--mosaic-icon)',
  display: 'block',
  flexShrink: 0,
  background: 'currentColor',
  borderRadius: 2,
});

const mosaicStickySwatchBase = style({
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'flex-end',
  minWidth: 96,
  minHeight: 80,
  padding: MOSAIC_PANEL_PADDING,
  borderRadius: 'var(--mosaic-chrome-radius)',
  color: 'var(--mosaic-sticky-ink)',
  fontFamily: 'var(--mosaic-font-ui)',
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 500,
});

export const mosaicStickySwatch = styleVariants({
  butter: [
    mosaicStickySwatchBase,
    { background: 'var(--mosaic-sticky-butter)' },
  ],
  peach: [
    mosaicStickySwatchBase,
    { background: 'var(--mosaic-sticky-peach)' },
  ],
  blush: [
    mosaicStickySwatchBase,
    { background: 'var(--mosaic-sticky-blush)' },
  ],
  mint: [mosaicStickySwatchBase, { background: 'var(--mosaic-sticky-mint)' }],
  lilac: [
    mosaicStickySwatchBase,
    { background: 'var(--mosaic-sticky-lilac)' },
  ],
  fog: [mosaicStickySwatchBase, { background: 'var(--mosaic-sticky-fog)' }],
} satisfies Record<MosaicStickySwatchId, unknown>);
