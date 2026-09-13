import './tokens.css';

import { I18n } from '@affine/i18n';
import type { CSSProperties } from 'react';

import { MOSAIC_TAG_COLORS } from './object-tags';
import * as styles from './objects-fixture.css';

const AFFINE_VARS: Record<string, string> = {
  '--affine-font-family': 'Inter, system-ui, sans-serif',
  '--affine-background-overlay-panel-color': '#ffffff',
  '--affine-border-color': '#e3e2e4',
  '--affine-shadow-1': '0 1px 4px rgba(0, 0, 0, 0.08)',
  '--affine-shadow-2': '0 6px 16px rgba(0, 0, 0, 0.08)',
  '--affine-text-primary-color': '#121212',
  '--affine-text-secondary-color': '#77757d',
  '--affine-tag-blue': '#c6def8',
};

export function MosaicChromeObjectsFixture() {
  return (
    <div
      className={styles.fixtureRoot}
      data-testid="mosaic-chrome-objects-fixture"
      style={AFFINE_VARS as CSSProperties}
    >
      <h2 className={styles.fixtureTitle}>
        {I18n['com.affine.whiteboard.chrome.objects.fixture.title']()}
      </h2>
      <div className={styles.fixtureRow}>
        <div>
          <div
            className={styles.frameTitle}
            data-testid="mosaic-frame-title"
            data-selected="true"
          >
            {I18n['com.affine.whiteboard.chrome.frame.title']()}
          </div>
          <div
            className={styles.emptyFrame}
            data-testid="mosaic-frame-empty"
            data-empty="true"
          />
        </div>
        <div className={styles.appCard} data-testid="mosaic-app-card">
          <strong>
            {I18n['com.affine.whiteboard.chrome.card.fixture.title']()}
          </strong>
          <span>
            {I18n['com.affine.whiteboard.chrome.card.fixture.meta']()}
          </span>
        </div>
        <div
          className={styles.recordCard}
          data-testid="mosaic-record-card-preview"
          data-pending="true"
        >
          <span>
            {I18n['com.affine.whiteboard.chrome.record-card.kicker']()}
          </span>
          <strong>
            {I18n['com.affine.whiteboard.chrome.record-card.title']()}
          </strong>
          <span>
            {I18n['com.affine.whiteboard.chrome.record-card.pending']()}
          </span>
        </div>
      </div>
      <div
        className={styles.chips}
        data-testid="mosaic-tag-chips-preview"
        role="group"
        aria-label={I18n['com.affine.whiteboard.chrome.tag.picker']()}
      >
        <span
          className={styles.chip}
          data-testid="mosaic-tag-chip"
          style={{ background: MOSAIC_TAG_COLORS[0] }}
        >
          {I18n['com.affine.whiteboard.chrome.tag.sample']()}
        </span>
        <span className={styles.chip} data-testid="mosaic-tag-overflow">
          {I18n['com.affine.whiteboard.chrome.tag.overflow']({ count: 2 })}
        </span>
      </div>
    </div>
  );
}
