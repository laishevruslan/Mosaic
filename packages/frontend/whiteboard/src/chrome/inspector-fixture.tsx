import './tokens.css';

import { I18n } from '@affine/i18n';
import type { CSSProperties } from 'react';

import * as styles from './inspector-fixture.css';
import { MOSAIC_BOARD_INSPECTOR_WIDTH } from './layout';

const AFFINE_VARS: Record<string, string> = {
  '--affine-font-family': 'Inter, system-ui, sans-serif',
  '--affine-background-overlay-panel-color': '#ffffff',
  '--affine-border-color': '#e3e2e4',
  '--affine-shadow-2': '0 6px 16px rgba(0, 0, 0, 0.08)',
  '--affine-text-primary-color': '#121212',
  '--affine-text-secondary-color': '#77757d',
};

export function MosaicChromeInspectorFixture() {
  return (
    <div
      className={styles.fixtureRoot}
      data-testid="mosaic-chrome-inspector-fixture"
      style={AFFINE_VARS as CSSProperties}
    >
      <h2 className={styles.fixtureTitle}>
        {I18n['com.affine.whiteboard.chrome.inspector.fixture.title']()}
      </h2>
      <aside
        className={styles.dock}
        data-testid="mosaic-board-inspector"
        style={{ width: MOSAIC_BOARD_INSPECTOR_WIDTH }}
        aria-label={I18n['com.affine.whiteboard.chrome.inspector.title']()}
      >
        <strong>
          {I18n['com.affine.whiteboard.chrome.inspector.chart']()}
        </strong>
        <p>{I18n['com.affine.whiteboard.chrome.inspector.sketch.hint']()}</p>
      </aside>
    </div>
  );
}
