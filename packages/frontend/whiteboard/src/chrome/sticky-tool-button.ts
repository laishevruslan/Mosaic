import { I18n } from '@affine/i18n';
import { QuickToolMixin } from '@blocksuite/affine/widgets/edgeless-toolbar';
import { EdgelessIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement } from 'lit';

import { StickyTool } from './sticky-tool';

export class MosaicStickyToolButton extends QuickToolMixin(LitElement) {
  static override styles = css`
    :host {
      display: flex;
    }
  `;

  override type = StickyTool;

  override render() {
    const { active } = this;
    return html`
      <edgeless-tool-icon-button
        class="edgeless-sticky-button"
        data-testid="mosaic-sticky-tool"
        .tooltip=${I18n['com.affine.whiteboard.chrome.rail.sticky']()}
        .tooltipOffset=${17}
        .active=${active}
        .iconContainerPadding=${6}
        .iconSize=${'24px'}
        @click=${() => this.setEdgelessTool(StickyTool)}
      >
        ${EdgelessIcon()}
      </edgeless-tool-icon-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wb-sticky-tool-button': MosaicStickyToolButton;
  }
}
