import { globalStyle } from '@vanilla-extract/css';

import { MOSAIC_WORKSHOP_CHROME_ATTR } from './layout';
import { MOSAIC_HIT_COMFORTABLE } from './tokens';

const chrome = `[${MOSAIC_WORKSHOP_CHROME_ATTR}]`;

const appCard = `${chrome} affine-edgeless-bookmark .affine-bookmark-card, ${chrome} affine-embed-edgeless-linked-doc-block .affine-embed-linked-doc-block`;

globalStyle(appCard, {
  borderRadius: 'var(--mosaic-chrome-radius)',
  border: 'var(--mosaic-chrome-border)',
  boxShadow: 'var(--mosaic-app-card-shadow, var(--affine-shadow-1))',
  fontFamily: 'var(--mosaic-font-ui)',
  background: 'var(--mosaic-paper)',
});

globalStyle(
  `${chrome} affine-edgeless-bookmark .affine-bookmark-content-title-icon, ${chrome} affine-embed-edgeless-linked-doc-block .affine-embed-linked-doc-content-title-icon`,
  {
    width: '16px',
    height: '16px',
    flexShrink: 0,
  }
);

globalStyle(
  `${chrome} affine-edgeless-bookmark editor-icon-button, ${chrome} affine-embed-edgeless-linked-doc-block editor-icon-button`,
  {
    minWidth: `${MOSAIC_HIT_COMFORTABLE}px`,
    minHeight: `${MOSAIC_HIT_COMFORTABLE}px`,
  }
);
