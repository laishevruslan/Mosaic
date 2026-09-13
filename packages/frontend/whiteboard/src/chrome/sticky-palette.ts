import { I18n } from '@affine/i18n';
import type { NoteBlockModel } from '@blocksuite/affine/model';
import type { BlockStdScope } from '@blocksuite/affine/std';
import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { mosaicStickyBackground, stickySwatchFromColor } from './sticky-preset';
import {
  MOSAIC_STICKY_CSS_VAR,
  MOSAIC_STICKY_SWATCH_IDS,
  type MosaicStickySwatchId,
} from './tokens';

const SWATCH_LABEL: Record<MosaicStickySwatchId, () => string> = {
  butter: () => I18n['com.affine.whiteboard.chrome.sticky.butter'](),
  peach: () => I18n['com.affine.whiteboard.chrome.sticky.peach'](),
  blush: () => I18n['com.affine.whiteboard.chrome.sticky.blush'](),
  mint: () => I18n['com.affine.whiteboard.chrome.sticky.mint'](),
  lilac: () => I18n['com.affine.whiteboard.chrome.sticky.lilac'](),
  fog: () => I18n['com.affine.whiteboard.chrome.sticky.fog'](),
};

export class MosaicStickyPalette extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    button {
      width: 20px;
      height: 20px;
      padding: 0;
      border-radius: 4px;
      border: 1px solid var(--affine-border-color);
      background: var(--swatch, var(--mosaic-sticky-butter));
      cursor: pointer;
    }
    button[data-active='true'] {
      outline: 2px solid var(--mosaic-accent);
      outline-offset: 1px;
    }
    button:focus-visible {
      outline: 2px solid var(--mosaic-accent);
      outline-offset: 1px;
    }
  `;

  private apply(id: MosaicStickySwatchId) {
    const notes = this.notes;
    const std = this.std;
    if (!notes?.length || !std || std.store.readonly) return;
    std.store.captureSync();
    const background = mosaicStickyBackground(id);
    for (const note of notes) {
      std.store.updateBlock(note, { background });
    }
  }

  override render() {
    const current = stickySwatchFromColor(this.notes?.[0]?.props.background);
    return html`${MOSAIC_STICKY_SWATCH_IDS.map(id => {
      const label = SWATCH_LABEL[id]();
      return html`
        <button
          type="button"
          data-testid="mosaic-sticky-swatch-${id}"
          data-active=${String(current === id)}
          aria-pressed=${String(current === id)}
          aria-label=${label}
          title=${label}
          style=${styleMap({
            '--swatch': `var(${MOSAIC_STICKY_CSS_VAR[id]})`,
          })}
          @click=${() => this.apply(id)}
        ></button>
      `;
    })}`;
  }

  @property({ attribute: false })
  accessor notes: NoteBlockModel[] | undefined;

  @property({ attribute: false })
  accessor std: BlockStdScope | undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'wb-sticky-palette': MosaicStickyPalette;
  }
}
