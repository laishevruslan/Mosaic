import { I18n } from '@affine/i18n';
import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import {
  chipOverflow,
  type MosaicTagOption,
  resolveTagOption,
} from './object-tags';

export class MosaicTagChips extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
      pointer-events: none;
    }
    .chip {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      max-width: 96px;
      height: 20px;
      padding: 0 6px;
      border-radius: 999px;
      border: 1px solid var(--affine-border-color);
      font-family: var(--mosaic-font-ui);
      font-size: 11px;
      line-height: 18px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .extra {
      height: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--mosaic-paper);
      border: 1px solid var(--affine-border-color);
      font-family: var(--mosaic-font-ui);
      font-size: 11px;
    }
  `;

  override render() {
    const { shown, extra } = chipOverflow(this.tagIds ?? []);
    if (!shown.length) return html``;
    return html`${shown.map(id => {
      const option = resolveTagOption(id, this.options ?? []);
      return html`<span
        class="chip"
        data-testid="mosaic-tag-chip"
        data-tag-id=${id}
        title=${option.value}
        style=${styleMap({ background: option.color })}
        >${option.value}</span
      >`;
    })}${
      extra
        ? html`<span class="extra" data-testid="mosaic-tag-overflow"
            >${I18n['com.affine.whiteboard.chrome.tag.overflow']({
              count: extra,
            })}</span
          >`
        : null
    }`;
  }

  @property({ attribute: false })
  accessor tagIds: string[] | undefined;

  @property({ attribute: false })
  accessor options: MosaicTagOption[] | undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'wb-tag-chips': MosaicTagChips;
  }
}
