import './tokens.css';

import { I18n } from '@affine/i18n';

import { mosaicStickySwatch } from './panel.css';
import * as styles from './sticky-fixture.css';
import {
  MOSAIC_STICKY_HEIGHT,
  MOSAIC_STICKY_KIND,
  MOSAIC_STICKY_WIDTH,
} from './sticky-preset';
import { MOSAIC_STICKY_SWATCH_IDS, type MosaicStickySwatchId } from './tokens';

const AFFINE_VARS: Record<string, string> = {
  '--affine-font-family': 'Inter, system-ui, sans-serif',
  '--affine-background-overlay-panel-color': '#ffffff',
  '--affine-border-color': '#e3e2e4',
  '--affine-shadow-2': '0 6px 16px rgba(0, 0, 0, 0.08)',
  '--affine-text-primary-color': '#121212',
  '--affine-note-shadow-sticker':
    '0 1px 0 rgba(0,0,0,.04), 0 8px 24px rgba(58,50,40,.16)',
};

const SWATCH_I18N: Record<MosaicStickySwatchId, () => string> = {
  butter: () => I18n['com.affine.whiteboard.chrome.sticky.butter'](),
  peach: () => I18n['com.affine.whiteboard.chrome.sticky.peach'](),
  blush: () => I18n['com.affine.whiteboard.chrome.sticky.blush'](),
  mint: () => I18n['com.affine.whiteboard.chrome.sticky.mint'](),
  lilac: () => I18n['com.affine.whiteboard.chrome.sticky.lilac'](),
  fog: () => I18n['com.affine.whiteboard.chrome.sticky.fog'](),
};

export function MosaicChromeStickyFixture() {
  return (
    <div
      className={styles.fixtureRoot}
      data-testid="mosaic-chrome-sticky-fixture"
      style={AFFINE_VARS}
    >
      <h2 className={styles.fixtureTitle}>
        {I18n['com.affine.whiteboard.chrome.sticky.fixture.title']()}
      </h2>
      <div className={styles.fixtureRow}>
        <div
          className={styles.stickyNote}
          data-note-kind={MOSAIC_STICKY_KIND}
          data-testid="mosaic-sticky-preview"
        >
          {MOSAIC_STICKY_WIDTH}×{MOSAIC_STICKY_HEIGHT}
        </div>
        <div
          className={styles.palette}
          role="group"
          aria-label={I18n['com.affine.whiteboard.chrome.sticky.palette']()}
          data-testid="mosaic-sticky-palette"
        >
          {MOSAIC_STICKY_SWATCH_IDS.map(id => (
            <div
              key={id}
              className={mosaicStickySwatch[id]}
              data-testid={`mosaic-sticky-swatch-${id}`}
              aria-label={SWATCH_I18N[id]()}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
