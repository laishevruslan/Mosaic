import { globalStyle } from '@vanilla-extract/css';

import { MOSAIC_WORKSHOP_CHROME_ATTR } from './layout';

const chrome = `[${MOSAIC_WORKSHOP_CHROME_ATTR}]`;

globalStyle(
  `${chrome} affine-frame[data-empty='true'] .affine-frame-container`,
  {
    border: '1px dashed var(--affine-border-color) !important',
    borderRadius: 'var(--mosaic-chrome-radius) !important',
  }
);

globalStyle(
  `${chrome} affine-frame[data-empty='true'][data-selected='true'] .affine-frame-container`,
  {
    borderColor: 'var(--mosaic-accent) !important',
  }
);

globalStyle(
  `${chrome} affine-frame[data-selected='true'] .affine-frame-container`,
  {
    borderRadius: 'var(--mosaic-chrome-radius) !important',
  }
);
