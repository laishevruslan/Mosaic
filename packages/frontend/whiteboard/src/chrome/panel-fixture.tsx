import './tokens.css';

import { I18n } from '@affine/i18n';
import type { CSSProperties } from 'react';

import { MOSAIC_BOARD_PANEL_WIDTH } from './layout';
import * as styles from './panel-fixture.css';

const AFFINE_VARS: Record<string, string> = {
  '--affine-font-family': 'Inter, system-ui, sans-serif',
  '--affine-background-overlay-panel-color': '#ffffff',
  '--affine-border-color': '#e3e2e4',
  '--affine-shadow-2': '0 6px 16px rgba(0, 0, 0, 0.08)',
  '--affine-text-primary-color': '#121212',
  '--affine-text-secondary-color': '#77757d',
};

export function MosaicChromePanelFixture() {
  return (
    <div
      className={styles.fixtureRoot}
      data-testid="mosaic-chrome-panel-fixture"
      style={AFFINE_VARS as CSSProperties}
    >
      <h2 className={styles.fixtureTitle}>
        {I18n['com.affine.whiteboard.chrome.panel.fixture.title']()}
      </h2>
      <button
        type="button"
        className={styles.handle}
        data-testid="mosaic-board-panel-open"
      >
        {I18n['com.affine.whiteboard.chrome.panel.open']()}
      </button>
      <aside
        className={styles.dock}
        data-testid="mosaic-board-panel-dock"
        style={{ width: MOSAIC_BOARD_PANEL_WIDTH }}
        aria-label={I18n['com.affine.whiteboard.chrome.panel.title']()}
      >
        <strong>{I18n['com.affine.whiteboard.chrome.panel.title']()}</strong>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            data-testid="mosaic-board-panel-tab-templates"
            data-active="true"
          >
            {I18n['com.affine.whiteboard.chrome.panel.templates']()}
          </button>
          <button type="button" data-testid="mosaic-board-panel-tab-frames">
            {I18n['com.affine.whiteboard.chrome.panel.frames']()}
          </button>
          <button type="button" data-testid="mosaic-board-panel-tab-widgets">
            {I18n['com.affine.whiteboard.chrome.panel.widgets']()}
          </button>
        </div>
        <span>{I18n['com.affine.whiteboard.chrome.templates.retro']()}</span>
        <span>
          {I18n['com.affine.whiteboard.chrome.panel.templates.empty-frame']()}
        </span>
        <span>
          {I18n['com.affine.whiteboard.chrome.panel.templates.sticky']()}
        </span>
      </aside>
    </div>
  );
}
