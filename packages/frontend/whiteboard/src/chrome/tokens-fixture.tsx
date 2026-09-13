import './tokens.css';

import { I18n } from '@affine/i18n';
import type { CSSProperties } from 'react';

import {
  mosaicChromeIcon,
  mosaicChromeIconButton,
  mosaicChromePanel,
  mosaicStickySwatch,
} from './panel.css';
import { MOSAIC_STICKY_SWATCH_IDS, type MosaicStickySwatchId } from './tokens';
import * as styles from './tokens-fixture.css';

const AFFINE_LIGHT_VARS: Record<string, string> = {
  '--affine-font-family': 'Inter, system-ui, sans-serif',
  '--affine-background-primary-color': '#ffffff',
  '--affine-background-overlay-panel-color': '#ffffff',
  '--affine-border-color': '#e3e2e4',
  '--affine-shadow-2': '0 6px 16px rgba(0, 0, 0, 0.08)',
  '--affine-text-primary-color': '#121212',
  '--affine-icon-color': '#77757d',
  '--affine-hover-color': 'rgba(0, 0, 0, 0.04)',
};

const AFFINE_DARK_VARS: Record<string, string> = {
  ...AFFINE_LIGHT_VARS,
  '--affine-background-primary-color': '#1c1c1c',
  '--affine-background-overlay-panel-color': '#2a2a2a',
  '--affine-border-color': '#4a4a4a',
  '--affine-shadow-2': '0 6px 16px rgba(0, 0, 0, 0.4)',
  '--affine-text-primary-color': '#f4f4f5',
  '--affine-icon-color': '#c6c6c6',
  '--affine-hover-color': 'rgba(255, 255, 255, 0.08)',
};

const SWATCH_I18N: Record<MosaicStickySwatchId, () => string> = {
  butter: () => I18n['com.affine.whiteboard.chrome.sticky.butter'](),
  peach: () => I18n['com.affine.whiteboard.chrome.sticky.peach'](),
  blush: () => I18n['com.affine.whiteboard.chrome.sticky.blush'](),
  mint: () => I18n['com.affine.whiteboard.chrome.sticky.mint'](),
  lilac: () => I18n['com.affine.whiteboard.chrome.sticky.lilac'](),
  fog: () => I18n['com.affine.whiteboard.chrome.sticky.fog'](),
};

function ThemePreview({ theme }: { theme: 'light' | 'dark' }) {
  const vars = theme === 'dark' ? AFFINE_DARK_VARS : AFFINE_LIGHT_VARS;
  const title =
    theme === 'dark'
      ? I18n['com.affine.whiteboard.chrome.fixture.theme-dark']()
      : I18n['com.affine.whiteboard.chrome.fixture.theme-light']();

  return (
    <section
      className={styles.fixtureTheme}
      data-theme={theme}
      data-testid={`mosaic-chrome-theme-${theme}`}
      style={vars as CSSProperties}
    >
      <h3 className={styles.fixtureHeading}>{title}</h3>
      <div
        className={mosaicChromePanel}
        data-testid={`mosaic-chrome-panel-${theme}`}
      >
        <div className={styles.fixtureRow}>
          <button
            type="button"
            className={mosaicChromeIconButton.hit}
            data-testid={`mosaic-chrome-icon-32-${theme}`}
            aria-label={I18n['com.affine.whiteboard.chrome.fixture.icon-32']()}
          >
            <span className={mosaicChromeIcon} />
          </button>
          <button
            type="button"
            className={mosaicChromeIconButton.comfortable}
            data-active="true"
            data-testid={`mosaic-chrome-icon-36-${theme}`}
            aria-label={I18n['com.affine.whiteboard.chrome.fixture.icon-36']()}
          >
            <span className={mosaicChromeIcon} />
          </button>
          <span className={styles.fixtureLabel}>
            {I18n['com.affine.whiteboard.chrome.fixture.panel']()}
          </span>
        </div>
      </div>
      <p className={styles.fixtureLabel}>
        {I18n['com.affine.whiteboard.chrome.fixture.swatches']()}
      </p>
      <div className={styles.fixtureSwatches}>
        {MOSAIC_STICKY_SWATCH_IDS.map(id => (
          <div
            key={id}
            className={mosaicStickySwatch[id]}
            data-testid={`mosaic-sticky-${id}-${theme}`}
            data-swatch={id}
          >
            {SWATCH_I18N[id]()}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MosaicChromeTokensFixture() {
  return (
    <div
      className={styles.fixtureRoot}
      data-testid="mosaic-chrome-tokens-fixture"
    >
      <h2 className={styles.fixtureTitle}>
        {I18n['com.affine.whiteboard.chrome.fixture.title']()}
      </h2>
      <ThemePreview theme="light" />
      <ThemePreview theme="dark" />
    </div>
  );
}
