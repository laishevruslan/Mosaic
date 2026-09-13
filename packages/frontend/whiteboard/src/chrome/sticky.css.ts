import { globalStyle } from '@vanilla-extract/css';

globalStyle("affine-edgeless-note[data-note-kind='sticky']", {
  color: 'var(--mosaic-sticky-ink)',
  fontFamily: 'var(--mosaic-font-ui)',
});

globalStyle(
  "affine-edgeless-note[data-note-kind='sticky'] [data-testid='edgeless-note-collapse-button']",
  {
    display: 'none',
  }
);
