import { style } from '@vanilla-extract/css';

import { mosaicChromePanel } from './panel.css';
import { MOSAIC_STICKY_HEIGHT, MOSAIC_STICKY_WIDTH } from './sticky-preset';

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

export const stickyNote = style({
  boxSizing: 'border-box',
  width: MOSAIC_STICKY_WIDTH,
  height: MOSAIC_STICKY_HEIGHT,
  padding: 12,
  borderRadius: 8,
  border: 'none',
  background: 'var(--mosaic-sticky-butter)',
  color: 'var(--mosaic-sticky-ink)',
  fontFamily: 'var(--mosaic-font-ui)',
  fontSize: 14,
  lineHeight: '20px',
  boxShadow: 'var(--affine-note-shadow-sticker, 0 6px 16px rgba(0,0,0,.12))',
});

export const palette = style([
  mosaicChromePanel,
  {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 36,
  },
]);
