import './tokens.css';

import { I18n } from '@affine/i18n';

import { MOSAIC_WORKSHOP_CHROME_ATTR } from './layout';
import * as styles from './layout-fixture.css';
import {
  mosaicChromeIcon,
  mosaicChromeIconButton,
  mosaicChromePanel,
} from './panel.css';

const AFFINE_VARS: Record<string, string> = {
  '--affine-font-family': 'Inter, system-ui, sans-serif',
  '--affine-background-primary-color': '#f4f4f5',
  '--affine-background-overlay-panel-color': '#ffffff',
  '--affine-border-color': '#e3e2e4',
  '--affine-shadow-2': '0 6px 16px rgba(0, 0, 0, 0.08)',
  '--affine-text-primary-color': '#121212',
  '--affine-icon-color': '#77757d',
  '--affine-hover-color': 'rgba(0, 0, 0, 0.04)',
};

function RailButtons() {
  return (
    <>
      <button
        type="button"
        className={mosaicChromeIconButton.comfortable}
        data-active="true"
        aria-pressed="true"
        aria-label={I18n['com.affine.whiteboard.chrome.rail.select']()}
      >
        <span className={mosaicChromeIcon} />
      </button>
      <button
        type="button"
        className={mosaicChromeIconButton.comfortable}
        aria-pressed="false"
        aria-label={I18n['com.affine.whiteboard.chrome.rail.frame']()}
      >
        <span className={mosaicChromeIcon} />
      </button>
      <button
        type="button"
        className={mosaicChromeIconButton.comfortable}
        aria-pressed="false"
        aria-label={I18n['com.affine.whiteboard.chrome.rail.connector']()}
      >
        <span className={mosaicChromeIcon} />
      </button>
      <button
        type="button"
        className={mosaicChromeIconButton.comfortable}
        aria-pressed="false"
        aria-label={I18n['com.affine.whiteboard.chrome.rail.more']()}
      >
        <span className={mosaicChromeIcon} />
      </button>
    </>
  );
}

function Board({
  mode,
  width,
}: {
  mode: 'rail' | 'fallback';
  width: number;
}) {
  return (
    <section
      className={styles.layoutFixtureBoard}
      data-testid={`mosaic-chrome-layout-${mode}-${width}`}
      {...{ [MOSAIC_WORKSHOP_CHROME_ATTR]: mode }}
      style={{ ...AFFINE_VARS, maxWidth: width, width: '100%' }}
    >
      <div className={styles.layoutFixtureCanvas} />
      <div
        className={mosaicChromePanel}
        data-edgeless-toolbar=""
        data-testid={`mosaic-chrome-rail-${mode}-${width}`}
        role="toolbar"
        aria-orientation={mode === 'rail' ? 'vertical' : 'horizontal'}
        aria-label={I18n['com.affine.whiteboard.chrome.rail.label']()}
      >
        <RailButtons />
      </div>
      <div
        className={mosaicChromePanel}
        data-edgeless-zoom=""
        data-testid={`mosaic-chrome-zoom-${mode}-${width}`}
        aria-label={I18n['com.affine.whiteboard.chrome.zoom.label']()}
      >
        − 100% +
      </div>
      <div
        className={styles.layoutFixtureSelection}
        data-testid={`mosaic-chrome-selection-${mode}-${width}`}
      >
        {I18n['com.affine.whiteboard.chrome.selection.label']()}
      </div>
    </section>
  );
}

export function MosaicChromeLayoutFixture() {
  return (
    <div
      className={styles.layoutFixtureRoot}
      data-testid="mosaic-chrome-layout-fixture"
    >
      <h2 className={styles.layoutFixtureTitle}>
        {I18n['com.affine.whiteboard.chrome.layout.title']()}
      </h2>
      <Board mode="rail" width={1440} />
      <Board mode="rail" width={1280} />
      <Board mode="fallback" width={1100} />
    </div>
  );
}
