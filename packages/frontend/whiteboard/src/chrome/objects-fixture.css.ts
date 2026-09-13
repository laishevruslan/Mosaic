import { style } from '@vanilla-extract/css';

import { mosaicChromePanel, mosaicTagChip } from './panel.css';
import { MOSAIC_FRAME_TITLE_HEIGHT } from './tokens';

export const fixtureRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  fontFamily: 'var(--mosaic-font-ui)',
  color: 'var(--affine-text-primary-color)',
});

export const fixtureTitle = style({
  margin: 0,
  fontSize: 18,
  lineHeight: '26px',
  fontWeight: 600,
});

export const fixtureRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: 16,
});

export const emptyFrame = style({
  boxSizing: 'border-box',
  width: 240,
  height: 160,
  borderRadius: 'var(--mosaic-chrome-radius)',
  border: '1px dashed var(--affine-border-color)',
  background: 'transparent',
});

export const frameTitle = style({
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  height: MOSAIC_FRAME_TITLE_HEIGHT,
  minHeight: MOSAIC_FRAME_TITLE_HEIGHT,
  padding: '0 8px',
  borderRadius: 'var(--mosaic-chrome-radius)',
  border: '1px solid var(--mosaic-accent)',
  background: 'var(--mosaic-paper)',
  fontSize: 13,
  boxShadow: '0 0 0 1px var(--mosaic-accent)',
});

export const appCard = style([
  mosaicChromePanel,
  {
    width: 280,
    minHeight: 88,
    boxShadow: 'var(--mosaic-app-card-shadow, var(--affine-shadow-1))',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
]);

export const recordCard = style([
  mosaicChromePanel,
  {
    width: 280,
    minHeight: 136,
    boxShadow: 'var(--mosaic-app-card-shadow, var(--affine-shadow-1))',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
  },
]);

export const chips = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

export const chip = mosaicTagChip;
