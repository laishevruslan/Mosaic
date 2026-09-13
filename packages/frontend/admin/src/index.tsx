import './global.css';
import './setup';

import { getOrCreateI18n } from '@affine/i18n';
import { createRoot } from 'react-dom/client';

import { App } from './app';

const i18n = getOrCreateI18n();
if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ru')) {
  void i18n.changeLanguage('ru');
}

// oxlint-disable-next-line typescript/no-non-null-assertion
createRoot(document.getElementById('app')!).render(<App />);
