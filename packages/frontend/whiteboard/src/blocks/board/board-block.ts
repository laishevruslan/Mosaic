import { I18n } from '@affine/i18n';
import { PeekViewProvider } from '@blocksuite/affine/components/peek';
import type { DatabaseBlockModel } from '@blocksuite/affine/model';
import { CommentProviderIdentifier } from '@blocksuite/affine/shared/services';
import { BlockComponent, BlockSelection } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { Text } from '@blocksuite/affine/store';
import { html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import type { Root } from 'react-dom/client';

import { snapshotAlt, widgetAriaLabel } from '../../a11y/widget-aria';
import { workshopRailFromElement } from '../../chrome/layout';
import {
  getDocAwareness,
  publishWidgetEditing,
  readLocalPayload,
  remoteOwnsLiveEditor,
} from '../../collab/awareness';
import {
  isFacilitatorLockedForPeer,
  readFacilitatorLock,
} from '../../collab/facilitation';
import { RECORD_CARD_WIDGET_SIZE, WHITEBOARD_FLAVOURS, WHITEBOARD_LOD } from '../../const';
import { detach } from '../../detach';
import { canEditBoardWidgets } from '../../infra/permissions';
import { insertGfxWidget } from '../../insert-widget';
import {
  tryLive,
  whiteboardPerfPolicy,
  xywhCenterDistance,
} from '../../perf/policy';
import { whiteboardTelemetry } from '../../perf/telemetry';
import { enterFocusMode, exitFocusMode } from './board-focus';
import type { BoardSettingsPanelProps } from './board-settings-panel';
import { renderBoardToolbar } from './board-toolbar';
import { databaseToSnapshot } from './column-snapshot';
import { readBoardGrid } from './grid';
import {
  applyCardMove,
  applyChecklistToggle,
  applyTimeLog,
  applyViewMeta,
  cloneBoardDatabase,
  createProjectionView,
  hideBoardField,
  hideBoardGroup,
  ingestRowTitle,
  resolveBoardDatabase,
  setBoardLayout,
} from './hub';
import {
  flavourToIngestKind,
  hitTestBoardColumn,
  ingestSourceToRow,
  isIngestGesture,
  shouldSkipRecordCardIngest,
} from './ingest';
import { createBoardKanbanLogic } from './kanban-host';
import { getBoardLodLevel, liveKanbanBudget } from './live-budget';
import {
  type BoardCardScroll,
  boardLodKicker,
  renderBoardGrid,
  renderBoardLod,
  renderBoardTable,
} from './lod-view';
import type { BoardBlockModel } from './model';
import { boardBlockStyles } from './styles';
import type { BoardLayout } from './types';
import { recordsToCsv } from './view-meta';
import { windowRange } from './virtualize';

export class BoardBlockComponent extends BlockComponent<BoardBlockModel> {
  static override styles = boardBlockStyles;

  @state()
  accessor selected = false;

  @state()
  accessor hovered = false;

  @state()
  accessor intersecting = true;

  @state()
  accessor columnScroll = 0;

  @state()
  accessor cardScroll: Record<string, number> = {};

  private _kanban?: ReturnType<typeof createBoardKanbanLogic>;
  private _databaseId?: string;
  private _kanbanType: 'kanban' | 'table' = 'kanban';
  private _columnViewport = 720;
  private _cardViewport = 240;
  private _panelRoot: Root | null = null;
  private _wasViewportLocked = false;
  private _ingestPointer: { x: number; y: number } | null = null;

  private canEdit() {
    const awareness = getDocAwareness(this.std.store);
    const states = awareness?.getStates?.();
    const lock = states
      ? readFacilitatorLock(
          states as never,
          awareness?.clientID,
          readLocalPayload(awareness)
        )
      : { on: false as const };
    return canEditBoardWidgets(
      this.std.store,
      this.model,
      isFacilitatorLockedForPeer(lock, awareness?.clientID)
    );
  }

  private get layout(): BoardLayout {
    return this.model.props.layout === 'table' ? 'table' : 'kanban';
  }

  protected get databaseModel() {
    const model = resolveBoardDatabase(
      this.model.store,
      this.model.props.blockId,
      this.model.props.linkedDocId
    );
    if (model?.flavour === 'affine:database') {
      return model as DatabaseBlockModel;
    }
    return undefined;
  }

  protected get titleText() {
    const title = this.model.props.title;
    const value = typeof title === 'string' ? title : title?.toString();
    return value || I18n['com.affine.whiteboard.board.title']();
  }

  private get zoom() {
    return this.std.getOptional(GfxControllerIdentifier)?.viewport.zoom ?? 1;
  }

  private get lod() {
    return getBoardLodLevel(this.zoom, this.selected, this.hovered);
  }

  private get showSettings() {
    return (
      this.selected &&
      this.canEdit() &&
      !workshopRailFromElement(this)
    );
  }

  private canUseLive(preview = false) {
    if (preview || !this.intersecting) return false;
    if (remoteOwnsLiveEditor(this.std.store, this.model.id)) return false;
    return this.lod === 'l2';
  }

  private boardGrid() {
    const database = this.databaseModel;
    if (!database) return;
    return readBoardGrid(databaseToSnapshot(database));
  }

  private kanban() {
    const database = this.databaseModel;
    if (!database) {
      this._kanban?.dispose();
      this._kanban = undefined;
      this._databaseId = undefined;
      return;
    }
    if (
      !this._kanban ||
      this._databaseId !== database.id ||
      this._kanbanType !== this.layout
    ) {
      this._kanban?.dispose();
      this._databaseId = database.id;
      this._kanbanType = this.layout === 'table' ? 'table' : 'kanban';
      this._kanban = createBoardKanbanLogic(
        this.std,
        database,
        this._kanbanType
      );
    }
    return this._kanban;
  }

  private disposeLive() {
    this._kanban?.dispose();
    this._kanban = undefined;
    this._databaseId = undefined;
    liveKanbanBudget.release(this.model.id);
    publishWidgetEditing(this.std.store, this.model.flavour, null);
  }

  private syncLive(preview = false) {
    const had = liveKanbanBudget.has(this.model.id);
    const viewport = this.std.getOptional(GfxControllerIdentifier)?.viewport;
    if (
      this.canUseLive(preview) &&
      tryLive(liveKanbanBudget, {
        id: this.model.id,
        kind: 'kanban',
        selected: this.selected,
        hovered: this.hovered,
        intersecting: this.intersecting,
        distanceToCenter: xywhCenterDistance(
          this.model.xywh,
          viewport?.center.x ?? 0,
          viewport?.center.y ?? 0
        ),
        exempt: !!this.model.props.liveBudgetExempt,
      })
    ) {
      publishWidgetEditing(this.std.store, this.model.flavour, this.model.id);
      if (!had) this.requestUpdate();
      return;
    }
    if (had || this._kanban) {
      this.disposeLive();
      this.requestUpdate();
    }
  }

  private displayLevel(preview: boolean) {
    if (!preview && liveKanbanBudget.has(this.model.id) && this.canUseLive()) {
      return 'l2' as const;
    }
    if (!this.intersecting) return 'l0' as const;
    const lod = this.lod;
    return lod === 'l2' ? ('l1' as const) : lod;
  }

  private handlers() {
    const database = this.databaseModel;
    const grid = this.boardGrid();
    if (!database || !grid) return;
    return {
      interactive: this.canEdit(),
      onMove: (rowId: string, x: string, y: string) => {
        if (!this.canEdit()) return;
        if (!grid.axes.x) return;
        const yColumn = database.props.columns.find(
          column => column.id === grid.axes.y
        );
        applyCardMove(this.model.store, database.id, rowId, {
          xPropertyId: grid.axes.x,
          xValue: x,
          yPropertyId: grid.axes.y,
          yValue: y,
          yIsMember: yColumn?.type === 'member',
        });
        this.requestUpdate();
      },
      onOpen: (rowId: string) => {
        detach(
          this.std.getOptional(PeekViewProvider)?.peek({
            docId: database.store.id,
            databaseId: database.id,
            databaseDocId: database.store.id,
            databaseRowId: rowId,
            target: this,
          })
        );
      },
      onComment: (rowId: string) => {
        this.std
          .getOptional(CommentProviderIdentifier)
          ?.addComment([new BlockSelection({ blockId: rowId })]);
      },
      onLogTime: (rowId: string) => {
        if (!this.canEdit()) return;
        applyTimeLog(this.model.store, database.id, rowId, 15);
        this.requestUpdate();
      },
      onToggleTask: (rowId: string, index: number) => {
        if (!this.canEdit()) return;
        applyChecklistToggle(this.model.store, database.id, rowId, index);
        this.requestUpdate();
      },
      onPlaceCard: (rowId: string) => this.placeRecordCard(rowId),
    };
  }

  private cardScrollConfig(): BoardCardScroll {
    return {
      offsets: this.cardScroll,
      viewport: this._cardViewport,
      onScroll: (key, offset, viewport) => {
        this._cardViewport = viewport || this._cardViewport;
        if (this.cardScroll[key] === offset) return;
        this.cardScroll = { ...this.cardScroll, [key]: offset };
      },
    };
  }

  inspectorProps(): BoardSettingsPanelProps | undefined {
    return this.settingsProps();
  }

  private settingsProps(): BoardSettingsPanelProps | undefined {
    const database = this.databaseModel;
    const grid = this.boardGrid();
    if (!database || !grid) return;
    const laneProperties = database.props.columns
      .filter(
        column =>
          column.id !== grid.axes.x &&
          (column.type === 'member' || column.type === 'select')
      )
      .map(column => ({ id: column.id, name: column.name }));
    return {
      axes: grid.axes,
      laneProperties,
      columns: grid.columns,
      lanes: grid.lanes,
      wipLimits: grid.wipLimits,
      laneFilter: (
        database.props.views.find(view => view.mode === 'kanban') as
          | { laneFilter?: string }
          | undefined
      )?.laneFilter,
      onAxesChange: axes => {
        applyViewMeta(this.model.store, database.id, { groupByAxes: axes });
        this.requestUpdate();
      },
      onWipChange: wipLimits => {
        applyViewMeta(this.model.store, database.id, { wipLimits });
        this.requestUpdate();
      },
      onLaneFilterChange: laneFilter => {
        applyViewMeta(this.model.store, database.id, { laneFilter });
        this.requestUpdate();
      },
    };
  }

  private switchLayout(layout: BoardLayout) {
    const database = this.databaseModel;
    if (!database || !this.canEdit()) return;
    const viewId = setBoardLayout(this.model.store, database.id, layout);
    this.model.store.updateBlock(this.model, {
      layout,
      viewId,
    });
    this.disposeLive();
    this.requestUpdate();
  }

  private toggleFocus() {
    const gfx = this.std.getOptional(GfxControllerIdentifier);
    if (this.model.props.focusMode) {
      exitFocusMode(
        {
          viewport: gfx?.viewport,
          setFocus: on => this.model.store.updateBlock(this.model, { focusMode: on }),
          setExempt: on =>
            this.model.store.updateBlock(this.model, { liveBudgetExempt: on }),
        },
        this._wasViewportLocked
      );
    } else {
      this._wasViewportLocked = enterFocusMode({
        viewport: gfx?.viewport,
        setFocus: on => this.model.store.updateBlock(this.model, { focusMode: on }),
        setExempt: on =>
          this.model.store.updateBlock(this.model, { liveBudgetExempt: on }),
      });
    }
    this.requestUpdate();
  }

  private exportCsv() {
    const database = this.databaseModel;
    const grid = this.boardGrid();
    if (!database || !grid) return;
    const csv = recordsToCsv(
      grid.columns.flatMap(column =>
        column.cards.map(card => ({
          title: card.title,
          cells: { Status: column.name },
        }))
      ),
      ['Status']
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'board.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private addSyncedView() {
    const database = this.databaseModel;
    if (!database || !this.canEdit()) return;
    const viewId = createProjectionView(
      this.model.store,
      database.id,
      this.layout
    );
    insertGfxWidget(
      this.std,
      this.model.flavour,
      {
        title: this.model.props.title,
        linkedDocId: this.model.props.linkedDocId ?? this.model.store.id,
        blockId: database.id,
        template: this.model.props.template,
        layout: this.layout,
        viewId,
        syncMode: 'projection',
      },
      { width: 720, height: 420 }
    );
  }

  private duplicateData() {
    const database = this.databaseModel;
    if (!database || !this.canEdit()) return;
    const created = cloneBoardDatabase(
      this.model.store,
      database.id,
      this.titleText,
      this.model.props.template ?? 'todo'
    );
    if (!created) return;
    insertGfxWidget(
      this.std,
      this.model.flavour,
      {
        title: new Text(this.titleText),
        linkedDocId: this.model.store.id,
        blockId: created.databaseId,
        template: this.model.props.template,
        layout: this.layout,
        viewId: created.viewId,
        syncMode: 'owned',
      },
      { width: 720, height: 420 }
    );
  }

  private placeRecordCard(rowId: string) {
    const database = this.databaseModel;
    if (!database || !this.canEdit()) return;
    insertGfxWidget(
      this.std,
      WHITEBOARD_FLAVOURS.recordCard,
      {
        databaseDocId: database.store.id,
        databaseId: database.id,
        rowId,
        compact: false,
      },
      RECORD_CARD_WIDGET_SIZE
    );
  }

  private ingestDroppedNotes(event: PointerEvent) {
    const database = this.databaseModel;
    const grid = this.boardGrid();
    const gfx = this.std.getOptional(GfxControllerIdentifier);
    if (!database || !grid || !gfx) return;
    if (!this.canEdit()) return;
    if (
      !isIngestGesture(this._ingestPointer, {
        x: event.clientX,
        y: event.clientY,
      })
    ) {
      return;
    }
    const bound = JSON.parse(this.model.xywh) as [number, number, number, number];
    const [bx, by, bw, bh] = bound;
    for (const id of gfx.selection.selectedIds) {
      if (id === this.model.id) continue;
      const model = this.std.store.getBlock(id)?.model as
        | {
            flavour: string;
            xywh?: string;
            props?: Record<string, unknown>;
            children?: Array<{ props?: { text?: { toString?: () => string } } }>;
          }
        | undefined;
      if (!model?.xywh) continue;
      const [x, y, w, h] = JSON.parse(model.xywh) as [
        number,
        number,
        number,
        number,
      ];
      const cx = x + w / 2;
      const cy = y + h / 2;
      if (cx < bx || cy < by || cx > bx + bw || cy > by + bh) continue;
      const sticky = (model.props?.edgeless as { kind?: string } | undefined)
        ?.kind === 'sticky';
      const kind = flavourToIngestKind(model.flavour, sticky);
      if (kind === 'unknown') continue;
      const title =
        model.children
          ?.map(child => child.props?.text?.toString?.() ?? '')
          .join(' ')
          .trim() ||
        (model.props?.title as { toString?: () => string } | undefined)?.toString?.() ||
        '';
      const source = {
        kind,
        title,
        tags: model.props?.tags as string[] | undefined,
        databaseId: model.props?.databaseId as string | undefined,
        rowId: model.props?.rowId as string | undefined,
      };
      if (shouldSkipRecordCardIngest(source, database.id)) continue;
      const row = ingestSourceToRow(source);
      if (!row) continue;
      const columnIndex = hitTestBoardColumn(cx - bx, bw, grid.columns.length);
      const column = grid.columns[columnIndex];
      ingestRowTitle(this.model.store, database.id, row.title, {
        xPropertyId: grid.axes.x,
        xValue: column?.id,
        labels: row.labels,
        cells: row.cells,
      });
    }
    this.requestUpdate();
  }

  private renderToolbar() {
    const database = this.databaseModel;
    const grid = this.boardGrid();
    if (!database || !grid) return nothing;
    const kanban = database.props.views.find(view => view.mode === 'kanban') as
      | {
          columns?: Array<{ id: string; hide?: boolean }>;
          groupProperties?: Array<{ key: string; hide?: boolean }>;
        }
      | undefined;
    return renderBoardToolbar({
      layout: this.layout,
      focusMode: !!this.model.props.focusMode,
      canEdit: this.canEdit(),
      fields: database.props.columns.map(column => ({
        id: column.id,
        name: column.name,
        hide: kanban?.columns?.find(item => item.id === column.id)?.hide,
      })),
      groups: grid.columns.map(column => ({
        id: column.id,
        name: column.name,
        hide: kanban?.groupProperties?.find(item => item.key === column.id)
          ?.hide,
      })),
      onLayout: layout => this.switchLayout(layout),
      onToggleField: (id, hide) => {
        hideBoardField(this.model.store, database.id, id, hide);
        this.requestUpdate();
      },
      onToggleGroup: (id, hide) => {
        hideBoardGroup(this.model.store, database.id, id, hide);
        this.requestUpdate();
      },
      onFocus: () => this.toggleFocus(),
      onExportCsv: () => this.exportCsv(),
      onSyncedView: () => this.addSyncedView(),
      onClone: () => this.duplicateData(),
    });
  }

  private async syncSettingsPanel() {
    const host = this.renderRoot.querySelector('.wb-board-settings-host');
    const props = this.settingsProps();
    if (!this.showSettings || !host || !props) {
      this._panelRoot?.unmount();
      this._panelRoot = null;
      return;
    }
    const [{ createElement }, { BoardSettingsPanel }, { createRoot }] =
      await Promise.all([
        import('react'),
        import('./board-settings-panel'),
        import('react-dom/client'),
      ]);
    if (!this._panelRoot) {
      this._panelRoot = createRoot(host);
    }
    this._panelRoot.render(createElement(BoardSettingsPanel, props));
  }

  protected renderSettings() {
    if (!this.showSettings) return nothing;
    return html`<div class="wb-board-settings-host"></div>`;
  }

  protected renderFrame(preview = false) {
    const snapshot = this.model.props.snapshotBlobId$.value;
    const level = this.displayLevel(preview);
    const live = level === 'l2';
    const grid = this.boardGrid();
    const useSwimlanes = !!grid?.axes.y;
    const kanban = live && !useSwimlanes && this.layout !== 'table'
      ? this.kanban()
      : undefined;
    const tableLive =
      live && this.layout === 'table' && !useSwimlanes ? this.kanban() : undefined;
    const columns = grid?.columns ?? [];
    const columnWindow =
      !useSwimlanes && columns.length > 6
        ? windowRange(
            columns.length,
            this.columnScroll,
            this._columnViewport,
            WHITEBOARD_LOD.kanbanColumnEstimatePx
          )
        : undefined;
    const handlers = live ? this.handlers() : undefined;
    const kanbanView = this.databaseModel?.props.views.find(
      view => view.mode === 'kanban'
    );

    return html`
      <div
        class="wb-board wb-board--${level}${this.model.props.focusMode ? ' wb-board--focus' : ''}"
        role="group"
        aria-label=${widgetAriaLabel('board', level, this.titleText)}
        data-layout=${this.layout}
        @pointerenter=${() => {
          this.hovered = true;
          this.syncLive(preview);
        }}
        @pointerleave=${() => {
          this.hovered = false;
          this.syncLive(preview);
        }}
      >
        <div class="wb-board__header">
          <div class="wb-board__title">${this.titleText}</div>
          <div class="wb-board__kicker">${boardLodKicker(level, preview)}</div>
        </div>
        ${preview ? nothing : this.renderToolbar()}
        <div
          class="wb-board__body"
          @pointerdown=${(event: PointerEvent) => event.stopPropagation()}
          @pointerup=${(event: PointerEvent) => this.ingestDroppedNotes(event)}
          @wheel=${(event: WheelEvent) => event.stopPropagation()}
          @scroll=${(event: Event) => {
            const target = event.currentTarget as HTMLElement;
            this.columnScroll = target.scrollLeft;
            this._columnViewport = target.clientWidth || this._columnViewport;
          }}
        >
          ${
            live && tableLive
              ? tableLive.render()
              : live && kanban
                ? kanban.render()
                : this.layout === 'table' && grid
                  ? renderBoardTable({
                      rows: grid.columns.flatMap(column =>
                        column.cards.map(card => ({
                          id: card.id,
                          title: card.title,
                          status: column.name,
                        }))
                      ),
                      level: level === 'l2' ? 'l1' : level,
                      handlers,
                    })
                  : grid && (useSwimlanes || live)
                    ? renderBoardGrid({
                        grid,
                        level,
                        laneFilter: (
                          kanbanView as { laneFilter?: string } | undefined
                        )?.laneFilter,
                        handlers,
                        cardScroll: live ? this.cardScrollConfig() : undefined,
                      })
                    : columns.length
                      ? renderBoardLod({
                          columns,
                          level: level === 'l2' ? 'l1' : level,
                          columnWindow,
                          wipLimits: grid?.wipLimits,
                        })
                      : snapshot
                        ? html`<img
                            class="wb-board__snapshot"
                            src=${snapshot}
                            alt=${snapshotAlt('board', this.titleText)}
                          />`
                        : html`<div class="wb-board__placeholder">
                            ${I18n['com.affine.whiteboard.board.empty']()}
                          </div>`
          }
        </div>
      </div>
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(
      this.model.propsUpdated.subscribe(() => this.requestUpdate())
    );
    const database = this.databaseModel;
    if (database) {
      this.disposables.add(
        database.propsUpdated.subscribe(() => this.requestUpdate())
      );
    }

    const onPointerDown = (event: PointerEvent) => {
      this._ingestPointer = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    this.disposables.add(() =>
      window.removeEventListener('pointerdown', onPointerDown, true)
    );

    const gfx = this.std.getOptional(GfxControllerIdentifier);
    if (gfx) {
      this.disposables.add(
        gfx.selection.slots.updated.subscribe(() => {
          this.selected = gfx.selection.has(this.model.id);
          this.syncLive();
          detach(this.syncSettingsPanel());
        })
      );
      this.disposables.add(
        gfx.viewport.viewportUpdated.subscribe(() => {
          this.syncLive();
        })
      );
      this.selected = gfx.selection.has(this.model.id);
    } else {
      this.disposables.add(
        this.std.selection.slots.changed.subscribe(() => {
          this.selected = this.std.selection
            .filter(BlockSelection)
            .some(selection => selection.blockId === this.model.id);
          this.syncLive();
          detach(this.syncSettingsPanel());
        })
      );
    }
  }

  override firstUpdated() {
    const observer = new IntersectionObserver(
      entries => {
        this.intersecting = entries.some(entry => entry.isIntersecting);
        this.syncLive();
      },
      { rootMargin: '200px' }
    );
    observer.observe(this);
    this.disposables.add(() => observer.disconnect());
    this.syncLive();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.model.props.focusMode) {
        this.toggleFocus();
      }
    };
    window.addEventListener('keydown', onKey);
    this.disposables.add(() => window.removeEventListener('keydown', onKey));
  }

  override updated() {
    this.syncLive();
    detach(this.syncSettingsPanel());
  }

  override disconnectedCallback() {
    this.disposeLive();
    whiteboardPerfPolicy.forget(this.model.id);
    whiteboardTelemetry.forgetWidget(this.model.id);
    this._panelRoot?.unmount();
    this._panelRoot = null;
    super.disconnectedCallback();
  }

  override renderBlock() {
    return html`${this.renderFrame(false)}${this.renderSettings()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wb-board': BoardBlockComponent;
  }
}
