import { globalStyle, style } from '@vanilla-extract/css';

import { mosaicChromePanel } from './panel.css';

export const layoutFixtureRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  fontFamily: 'var(--mosaic-font-ui)',
  color: 'var(--affine-text-primary-color)',
});

export const layoutFixtureTitle = style({
  margin: 0,
  fontSize: 18,
  lineHeight: '26px',
  fontWeight: 600,
});

export const layoutFixtureBoard = style({
  position: 'relative',
  overflow: 'hidden',
  width: '100%',
  maxWidth: 1440,
  height: 360,
  borderRadius: 'var(--mosaic-chrome-radius)',
  border: '1px dashed var(--affine-border-color)',
  background: 'var(--affine-background-primary-color, #f5f5f5)',
  containerName: 'viewport',
  containerType: 'inline-size',
});

export const layoutFixtureCanvas = style({
  position: 'absolute',
  inset: 24,
  borderRadius: 4,
  background:
    'repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(0,0,0,.04) 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(0,0,0,.04) 24px)',
});

export const layoutFixtureSelection = style([
  mosaicChromePanel,
  {
    position: 'absolute',
    top: 88,
    left: '42%',
    height: 36,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },
]);

globalStyle(
  `${layoutFixtureBoard}[data-mosaic-workshop-chrome='rail'] [data-edgeless-toolbar]`,
  {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }
);

globalStyle(
  `${layoutFixtureBoard}[data-mosaic-workshop-chrome='fallback'] [data-edgeless-toolbar]`,
  {
    position: 'absolute',
    left: '50%',
    bottom: 0,
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  }
);

globalStyle(`${layoutFixtureBoard} [data-edgeless-zoom]`, {
  position: 'absolute',
  left: 12,
  bottom: 12,
  display: 'flex',
});
