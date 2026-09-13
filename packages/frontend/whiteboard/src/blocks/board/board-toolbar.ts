import { I18n } from '@affine/i18n';
import { html, nothing } from 'lit';

import type { BoardLayout } from './types';

export type BoardToolbarProps = {
  layout: BoardLayout;
  focusMode: boolean;
  canEdit: boolean;
  fields: Array<{ id: string; name: string; hide?: boolean }>;
  groups: Array<{ id: string; name: string; hide?: boolean }>;
  onLayout: (layout: BoardLayout) => void;
  onToggleField: (id: string, hide: boolean) => void;
  onToggleGroup: (id: string, hide: boolean) => void;
  onFocus: () => void;
  onExportCsv: () => void;
  onSyncedView: () => void;
  onClone: () => void;
  onPlaceCard?: (rowId: string) => void;
};

export function renderBoardToolbar(props: BoardToolbarProps) {
  const layoutLabel =
    props.layout === 'table'
      ? I18n['com.affine.whiteboard.board.layout.table']()
      : I18n['com.affine.whiteboard.board.layout.kanban']();

  return html`
    <div class="wb-board-toolbar" data-testid="wb-board-toolbar">
      <button
        type="button"
        data-testid="wb-board-layout"
        ?disabled=${!props.canEdit}
        @click=${() =>
          props.onLayout(props.layout === 'table' ? 'kanban' : 'table')}
      >
        ${layoutLabel}
      </button>
      <details class="wb-board-toolbar__menu">
        <summary>${I18n['com.affine.whiteboard.board.toolbar.fields']()}</summary>
        ${props.fields.map(
          field => html`
            <label>
              <input
                type="checkbox"
                .checked=${!field.hide}
                ?disabled=${!props.canEdit}
                @change=${(event: Event) =>
                  props.onToggleField(
                    field.id,
                    !(event.target as HTMLInputElement).checked
                  )}
              />
              ${field.name}
            </label>
          `
        )}
      </details>
      <details class="wb-board-toolbar__menu">
        <summary>${I18n['com.affine.whiteboard.board.toolbar.hide']()}</summary>
        ${props.groups.map(
          group => html`
            <label>
              <input
                type="checkbox"
                .checked=${!group.hide}
                ?disabled=${!props.canEdit}
                @change=${(event: Event) =>
                  props.onToggleGroup(
                    group.id,
                    !(event.target as HTMLInputElement).checked
                  )}
              />
              ${group.name || I18n['com.affine.whiteboard.board.ungrouped']()}
            </label>
          `
        )}
      </details>
      <button
        type="button"
        data-testid="wb-board-focus"
        @click=${() => props.onFocus()}
      >
        ${
          props.focusMode
            ? I18n['com.affine.whiteboard.board.toolbar.back-to-canvas']()
            : I18n['com.affine.whiteboard.board.toolbar.focus']()
        }
      </button>
      <details class="wb-board-toolbar__menu">
        <summary>⋮</summary>
        <button type="button" @click=${() => props.onSyncedView()}>
          ${I18n['com.affine.whiteboard.board.toolbar.synced-view']()}
        </button>
        <button type="button" @click=${() => props.onClone()}>
          ${I18n['com.affine.whiteboard.board.toolbar.duplicate']()}
        </button>
        <button type="button" @click=${() => props.onExportCsv()}>
          ${I18n['com.affine.whiteboard.board.toolbar.export-csv']()}
        </button>
      </details>
      ${
        props.onPlaceCard
          ? html`<span class="wb-board-toolbar__hint">
              ${I18n['com.affine.whiteboard.board.toolbar.place-hint']()}
            </span>`
          : nothing
      }
    </div>
  `;
}
