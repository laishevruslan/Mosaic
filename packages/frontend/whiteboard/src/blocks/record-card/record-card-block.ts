import { I18n } from '@affine/i18n';
import { BlockComponent } from '@blocksuite/affine/std';
import { html } from 'lit';

import type { RecordCardBlockModel } from './model';
import { recordCardStyles } from './styles';

export class RecordCardBlockComponent extends BlockComponent<RecordCardBlockModel> {
  static override styles = recordCardStyles;

  protected renderContent(preview = false) {
    const rowId = this.model.props.rowId$.value;
    const title = rowId
      ? rowId
      : I18n['com.affine.whiteboard.chrome.record-card.title']();
    const kicker = preview
      ? I18n['com.affine.whiteboard.hello.preview-label']()
      : I18n['com.affine.whiteboard.chrome.record-card.kicker']();
    const meta = rowId
      ? this.model.props.databaseId$.value
      : I18n['com.affine.whiteboard.chrome.record-card.pending']();

    return html`
      <div
        class="wb-record-card"
        data-testid="mosaic-record-card"
        data-pending=${String(!rowId)}
      >
        <div class="wb-record-card__kicker">${kicker}</div>
        <div class="wb-record-card__title">${title}</div>
        <div class="wb-record-card__meta">${meta}</div>
      </div>
    `;
  }

  override renderBlock() {
    return this.renderContent(false);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wb-record-card': RecordCardBlockComponent;
  }
}
