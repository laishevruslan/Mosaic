import { I18n } from '@affine/i18n';
import { IS_MOBILE } from '@blocksuite/affine/global/env';
import type { RootBlockModel } from '@blocksuite/affine/model';
import { WidgetComponent, WidgetViewExtension } from '@blocksuite/affine/std';
import { css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { literal, unsafeStatic } from 'lit/static-html.js';
import { createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { BoardBlockComponent } from '../blocks/board/board-block';
import { BoardSettingsPanel } from '../blocks/board/board-settings-panel';
import { ChartBlockComponent } from '../blocks/chart/chart-block';
import { ChartSettingsPanel } from '../blocks/chart/chart-settings-panel';
import { WHITEBOARD_FLAVOURS } from '../const';
import { getMosaicBoard } from '../sdk/from-std';
import {
  isInspectorFlavour,
  type MosaicInspectorFlavour,
} from './inspector-flavours';
import {
  boardInspectorRight,
  MOSAIC_BOARD_INSPECTOR_WIDTH,
  MOSAIC_WORKSHOP_CHROME_ATTR,
  type MosaicWorkshopChromeMode,
} from './layout';

export const WB_BOARD_INSPECTOR_WIDGET = 'wb-board-inspector';

export class MosaicBoardInspectorHost extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      top: 12px;
      bottom: 12px;
      z-index: 3;
      pointer-events: none;
      font-family: var(--mosaic-font-ui);
    }
    .dock {
      pointer-events: auto;
      box-sizing: border-box;
      width: ${MOSAIC_BOARD_INSPECTOR_WIDTH}px;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 8px;
      gap: 8px;
      background: var(--mosaic-paper);
      border: var(--mosaic-chrome-border);
      box-shadow: var(--mosaic-chrome-shadow);
      border-radius: var(--mosaic-chrome-radius);
    }
    .title {
      font-size: 13px;
      font-weight: 600;
    }
    .hint {
      font-size: 12px;
      color: var(--affine-text-secondary-color);
    }
    .inspector-host p {
      font-size: 12px;
      color: var(--affine-text-secondary-color);
    }
    .inspector-host .wb-chart-settings,
    .inspector-host .wb-board-settings {
      position: static;
      top: auto;
      right: auto;
      width: auto;
      max-height: none;
      padding: 0;
      border: none;
      box-shadow: none;
      background: transparent;
    }
    .inspector-host label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
      font-size: 12px;
      color: var(--affine-text-secondary-color);
    }
    .inspector-host input,
    .inspector-host select,
    .inspector-host textarea {
      border: 1px solid var(--affine-border-color);
      background: var(--affine-background-primary-color);
      color: var(--affine-text-primary-color);
      border-radius: 8px;
      padding: 6px 8px;
      font: inherit;
    }
  `;

  @state()
  accessor flavour: MosaicInspectorFlavour | null = null;

  @state()
  accessor blockId: string | null = null;

  private unsub: Array<() => void> = [];

  private panelRoot: Root | null = null;

  private viewportEl(): HTMLElement | null {
    return (
      this.closest('.affine-edgeless-viewport') ??
      this.std.host.closest('.affine-edgeless-viewport')
    );
  }

  private railMode(): boolean {
    return (
      this.viewportEl()?.getAttribute(MOSAIC_WORKSHOP_CHROME_ATTR) ===
      ('rail' satisfies MosaicWorkshopChromeMode)
    );
  }

  private syncTarget() {
    const ids = getMosaicBoard(this.std).getSelection();
    if (ids.length !== 1) {
      this.flavour = null;
      this.blockId = null;
      return;
    }
    const flavour = this.std.store.getBlock(ids[0])?.model.flavour;
    if (!flavour || !isInspectorFlavour(flavour)) {
      this.flavour = null;
      this.blockId = null;
      return;
    }
    this.flavour = flavour;
    this.blockId = ids[0];
  }

  private heading(): string {
    if (this.flavour === WHITEBOARD_FLAVOURS.chart) {
      return I18n['com.affine.whiteboard.chrome.inspector.chart']();
    }
    if (this.flavour === WHITEBOARD_FLAVOURS.board) {
      return I18n['com.affine.whiteboard.chrome.inspector.board']();
    }
    return I18n['com.affine.whiteboard.chrome.inspector.sketch']();
  }

  private syncReactPanel() {
    const host = this.renderRoot.querySelector('.inspector-host');
    if (!host || !this.blockId || this.flavour === WHITEBOARD_FLAVOURS.sketch) {
      this.panelRoot?.unmount();
      this.panelRoot = null;
      return;
    }
    const view = this.std.view.getBlock(this.blockId);
    let node: ReactNode = null;
    if (view instanceof ChartBlockComponent) {
      node = createElement(ChartSettingsPanel, view.inspectorProps());
    } else if (view instanceof BoardBlockComponent) {
      const props = view.inspectorProps();
      node = props
        ? createElement(BoardSettingsPanel, props)
        : createElement(
            'p',
            { className: 'hint' },
            I18n['com.affine.whiteboard.chrome.inspector.board.empty']()
          );
    }
    if (!node) {
      this.panelRoot?.unmount();
      this.panelRoot = null;
      return;
    }
    this.panelRoot ??= createRoot(host);
    this.panelRoot.render(node);
  }

  override connectedCallback() {
    super.connectedCallback();
    this.dataset.testid = 'mosaic-board-inspector-host';
    this.style.right = `${boardInspectorRight()}px`;
    this.syncTarget();
    this.unsub.push(
      getMosaicBoard(this.std).on('selection:change', () => this.syncTarget())
    );
    const blockSub = this.std.store.slots.blockUpdated.subscribe(() => {
      if (this.blockId) this.requestUpdate();
    });
    this.unsub.push(() => blockSub.unsubscribe());
  }

  override updated() {
    this.syncReactPanel();
  }

  override disconnectedCallback() {
    this.panelRoot?.unmount();
    this.panelRoot = null;
    for (const stop of this.unsub) stop();
    this.unsub = [];
    super.disconnectedCallback();
  }

  override render() {
    if (IS_MOBILE || !this.railMode() || !this.flavour) return nothing;
    return html`
      <aside
        class="dock"
        data-testid="mosaic-board-inspector"
        aria-label=${I18n['com.affine.whiteboard.chrome.inspector.title']()}
      >
        <div class="title">${this.heading()}</div>
        ${
          this.flavour === WHITEBOARD_FLAVOURS.sketch
            ? html`<p class="hint">
                ${I18n['com.affine.whiteboard.chrome.inspector.sketch.hint']()}
              </p>`
            : html`<div class="inspector-host"></div>`
        }
      </aside>
    `;
  }
}

export const boardInspectorWidget = WidgetViewExtension(
  'affine:page',
  WB_BOARD_INSPECTOR_WIDGET,
  literal`${unsafeStatic(WB_BOARD_INSPECTOR_WIDGET)}`
);

declare global {
  interface HTMLElementTagNameMap {
    'wb-board-inspector': MosaicBoardInspectorHost;
  }
}
