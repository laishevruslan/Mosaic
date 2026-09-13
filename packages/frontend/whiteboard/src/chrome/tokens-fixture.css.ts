import { style } from '@vanilla-extract/css';

export const fixtureRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
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

export const fixtureTheme = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 16,
  borderRadius: 'var(--mosaic-chrome-radius)',
  background: 'var(--affine-background-primary-color, #fff)',
  color: 'var(--affine-text-primary-color)',
  selectors: {
    '&[data-theme="dark"]': {
      background: 'var(--affine-background-primary-color, #1c1c1c)',
    },
  },
});

export const fixtureHeading = style({
  margin: 0,
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 600,
  opacity: 0.72,
});

export const fixtureRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
});

export const fixtureSwatches = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const fixtureLabel = style({
  fontSize: 12,
  lineHeight: '16px',
  opacity: 0.72,
});
