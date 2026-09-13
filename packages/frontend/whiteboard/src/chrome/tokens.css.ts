import { globalStyle } from '@vanilla-extract/css';

import { darkChromeVars, lightChromeVars } from './tokens';

globalStyle(':root, [data-theme="light"]', {
  vars: lightChromeVars(),
});

globalStyle('[data-theme="dark"]', {
  vars: darkChromeVars(),
});
