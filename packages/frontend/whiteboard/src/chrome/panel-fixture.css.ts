import { style } from '@vanilla-extract/css';

import { MOSAIC_BOARD_PANEL_WIDTH } from './layout';
import { mosaicChromePanel } from './panel.css';

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

export const dock = style([
  mosaicChromePanel,
  {
    width: MOSAIC_BOARD_PANEL_WIDTH,
    minHeight: 240,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
]);

export const tabs = style({
  display: 'flex',
  gap: 4,
});

export const handle = style({
  width: 36,
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--mosaic-chrome-radius)',
  border: 'var(--mosaic-chrome-border)',
  background: 'var(--mosaic-paper)',
});
