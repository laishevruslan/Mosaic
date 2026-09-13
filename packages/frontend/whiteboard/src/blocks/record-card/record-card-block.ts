import { I18n } from '@affine/i18n';
import { BlockComponent } from '@blocksuite/affine/std';
import { html } from 'lit';

import { recordCardFace } from '../board/record-face';
import { recordRowTitle, renameRecordRow, resolveBoardDatabase } from '../board/hub';
import type { RecordCardBlockModel } from './model';
import { recordCardStyles } from './styles';

export class RecordCardBlockComponent extends BlockComponent<RecordCardBlockModel> {
  static override styles = recordCardStyles;

  private face() {
    const rowId = this.model.props.rowId$.value;
    const databaseId = this.model.props.databaseId$.value;
    const linked = this.model.props.databaseDocId$.value;
    const database = resolveBoardDatabase(
      this.model.store,
      databaseId,
      linked || undefined
    );
    const exists = !!(rowId && this.model.store.getBlock(rowId));
    const title = rowId ? recordRowTitle(this.model.store, rowId) : '';
    return recordCardFace({
      rowId,
      title,
      rowExists: exists && !!database,
    });
  }

  private commitTitle(event: Event) {
    const rowId = this.model.props.rowId$.value;
    if (!rowId || this.std.store.readonly) return;
    const next = (event.target as HTMLInputElement).value;
    if (next.trim()) renameRecordRow(this.model.store, rowId, next.trim());
  }

  protected renderContent(preview = false) {
    const face = this.face();
    const kicker = preview
      ? I18n['com.affine.whiteboard.hello.preview-label']()
      : face.deleted
        ? I18n['com.affine.whiteboard.board.record-deleted']()
        : I18n['com.affine.whiteboard.chrome.record-card.kicker']();
    const title = face.pending
      ? I18n['com.affine.whiteboard.chrome.record-card.title']()
      : face.title || I18n['com.affine.whiteboard.chrome.record-card.title']();
    const meta = face.pending
      ? I18n['com.affine.whiteboard.chrome.record-card.pending']()
      : face.deleted
        ? I18n['com.affine.whiteboard.board.record-deleted-hint']()
        : this.model.props.databaseId$.value;

    return html`
      <div
        class="wb-record-card"
        data-testid="mosaic-record-card"
        data-pending=${String(face.pending)}
        data-deleted=${String(face.deleted)}
      >
        <div class="wb-record-card__kicker">${kicker}</div>
        ${
          preview || face.pending || face.deleted
            ? html`<div class="wb-record-card__title">${title}</div>`
            : html`<input
                class="wb-record-card__title"
                data-testid="wb-record-card-title"
                .value=${title}
                @change=${(event: Event) => this.commitTitle(event)}
                @pointerdown=${(event: Event) => event.stopPropagation()}
              />`
        }
        <div class="wb-record-card__meta">${meta}</div>
      </div>
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(
      this.model.propsUpdated.subscribe(() => this.requestUpdate())
    );
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
