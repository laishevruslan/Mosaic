import { I18n } from '@affine/i18n';
import { IS_MOBILE } from '@blocksuite/affine/global/env';
import type { RootBlockModel } from '@blocksuite/affine/model';
import { WidgetComponent, WidgetViewExtension } from '@blocksuite/affine/std';
import { css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { WHITEBOARD_FLAVOURS } from '../const';
import { getMosaicBoard } from '../sdk/from-std';
import type { MosaicFrameInfo, MosaicPanelId } from '../sdk/types';
import {
  boardPanelLeft,
  MOSAIC_BOARD_PANEL_WIDTH,
  MOSAIC_WORKSHOP_CHROME_ATTR,
  type MosaicWorkshopChromeMode,
} from './layout';
import {
  type AffineTemplateCategory,
  insertAffineTemplate,
  listAffineTemplateCategories,
} from './templates-affine';
import {
  type MosaicTemplateGroup,
  type MosaicTemplateSpec,
  templatesInGroup,
} from './templates-catalog';
import { insertMosaicTemplate } from './templates-insert';

export const WB_BOARD_PANEL_WIDGET = 'wb-board-panel';

export class MosaicBoardPanelHost extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      top: 12px;
      bottom: 12px;
      z-index: 3;
      pointer-events: none;
      font-family: var(--mosaic-font-ui);
    }
    .dock,
    .handle,
    .modal {
      pointer-events: auto;
    }
    .handle,
    .dock {
      box-sizing: border-box;
      background: var(--mosaic-paper);
      border: var(--mosaic-chrome-border);
      box-shadow: var(--mosaic-chrome-shadow);
      border-radius: var(--mosaic-chrome-radius);
    }
    .handle {
      width: var(--mosaic-hit-comfortable);
      height: var(--mosaic-hit-comfortable);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--affine-text-primary-color);
    }
    .handle:focus-visible {
      outline: 2px solid var(--mosaic-accent);
      outline-offset: 1px;
    }
    .dock {
      width: ${MOSAIC_BOARD_PANEL_WIDTH}px;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 8px;
      gap: 8px;
    }
    .header,
    .tabs {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }
    .header {
      justify-content: space-between;
    }
    .title {
      font-size: 13px;
      font-weight: 600;
    }
    button {
      height: 32px;
      padding: 0 8px;
      border-radius: 8px;
      border: 1px solid var(--affine-border-color);
      background: var(--mosaic-paper);
      font-family: var(--mosaic-font-ui);
      font-size: 12px;
      cursor: pointer;
      color: var(--affine-text-primary-color);
    }
    button[data-active='true'] {
      outline: 2px solid var(--mosaic-accent);
      outline-offset: 1px;
    }
    button:focus-visible {
      outline: 2px solid var(--mosaic-accent);
      outline-offset: 1px;
    }
    .body {
      flex: 1;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .hint {
      font-size: 12px;
      color: var(--affine-text-secondary-color);
    }
    .group {
      font-size: 11px;
      font-weight: 600;
      color: var(--affine-text-secondary-color);
    }
    .modal {
      position: absolute;
      inset: 24% 16px auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--mosaic-paper);
      border: var(--mosaic-chrome-border);
      border-radius: var(--mosaic-chrome-radius);
      box-shadow: var(--mosaic-chrome-shadow);
    }
    .modal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `;

  @state()
  accessor panelId: MosaicPanelId | null = null;

  @state()
  accessor frames: MosaicFrameInfo[] = [];

  @state()
  accessor affineCategories: AffineTemplateCategory[] = [];

  private unsub: Array<() => void> = [];
  private affineLoaded = false;

  private get board() {
    return getMosaicBoard(this.std);
  }

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

  private syncPosition() {
    this.style.left = `${boardPanelLeft(this.railMode())}px`;
  }

  private refreshFrames() {
    this.frames = this.board.listFrames();
  }

  private open(id: MosaicPanelId) {
    this.board.ui.openPanel({ id });
    if (id === 'templates') this.ensureAffine();
  }

  private catalogLabel(key: string) {
    const fn = (I18n as unknown as Record<string, () => string>)[key];
    return fn ? fn() : key;
  }

  private widgetAvailable(spec: MosaicTemplateSpec) {
    if (spec.group !== 'widgets') return true;
    const flavour =
      spec.id === 'widget-chart'
        ? WHITEBOARD_FLAVOURS.chart
        : spec.id === 'widget-board'
          ? WHITEBOARD_FLAVOURS.board
          : WHITEBOARD_FLAVOURS.sketch;
    return this.std.store.schema.flavourSchemaMap.has(flavour);
  }

  private async ensureAffine() {
    if (this.affineLoaded) return;
    this.affineLoaded = true;
    try {
      this.affineCategories = await listAffineTemplateCategories();
    } catch {
      this.affineCategories = [];
    }
  }

  private insertTestId(spec: MosaicTemplateSpec) {
    if (spec.id === 'empty-frame') return 'mosaic-board-panel-insert-frame';
    if (spec.id === 'sticky') return 'mosaic-board-panel-insert-sticky';
    return `mosaic-template-${spec.id}`;
  }

  private renderCatalogGroup(group: MosaicTemplateGroup) {
    const items = templatesInGroup(group).filter(spec =>
      this.widgetAvailable(spec)
    );
    if (!items.length) return nothing;
    const groupKey =
      group === 'frames'
        ? 'com.affine.whiteboard.chrome.templates.group.frames'
        : group === 'stickers'
          ? 'com.affine.whiteboard.chrome.templates.group.stickers'
          : 'com.affine.whiteboard.chrome.templates.group.widgets';
    return html`
      <div class="group">${this.catalogLabel(groupKey)}</div>
      ${items.map(
        spec => html`<button
          type="button"
          data-testid=${this.insertTestId(spec)}
          @click=${() => insertMosaicTemplate(this.board, spec.id)}
        >
          ${this.catalogLabel(spec.nameKey)}
        </button>`
      )}
    `;
  }

  private renderTemplates() {
    return html`
      <p class="hint">
        ${I18n['com.affine.whiteboard.chrome.panel.templates.hint']()}
      </p>
      ${this.renderCatalogGroup('frames')}
      ${this.renderCatalogGroup('stickers')}
      ${
        this.affineCategories.length
          ? html`<div class="group">
                ${I18n[
                  'com.affine.whiteboard.chrome.templates.group.edgeless'
                ]()}
              </div>
              ${this.affineCategories.map(
                category => html`
                  <div class="group">${category.name}</div>
                  ${category.items.map(
                    item => html`<button
                      type="button"
                      data-testid="mosaic-template-affine-${item.name}"
                      @click=${() => {
                        void insertAffineTemplate(this.std, item.template);
                      }}
                    >
                      ${item.name}
                    </button>`
                  )}
                `
              )}`
          : html`<p class="hint">
              ${I18n['com.affine.whiteboard.chrome.templates.affine.empty']()}
            </p>`
      }
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.dataset.testid = 'mosaic-board-panel';
    const board = this.board;
    this.panelId = board.ui.panelId();
    this.unsub.push(
      board.ui.onPanelChange(id => {
        this.panelId = id;
        if (id === 'frames') this.refreshFrames();
        if (id === 'templates') this.ensureAffine();
      })
    );
    this.unsub.push(board.ui.onModalChange(() => this.requestUpdate()));
    const blockSub = this.std.store.slots.blockUpdated.subscribe(() => {
      if (this.panelId === 'frames') this.refreshFrames();
    });
    this.unsub.push(() => blockSub.unsubscribe());
  }

  override firstUpdated() {
    this.syncPosition();
    const viewport = this.viewportEl();
    if (viewport && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        this.syncPosition();
        this.requestUpdate();
      });
      observer.observe(viewport, {
        attributes: true,
        attributeFilter: [MOSAIC_WORKSHOP_CHROME_ATTR],
      });
      this.unsub.push(() => observer.disconnect());
    }
  }

  override disconnectedCallback() {
    for (const stop of this.unsub) stop();
    this.unsub = [];
    super.disconnectedCallback();
  }

  override render() {
    if (IS_MOBILE || !this.railMode()) return nothing;
    const board = this.board;
    const modal = board.ui.modal();

    return html`
      ${
        this.panelId
          ? html`<aside
              class="dock"
              data-testid="mosaic-board-panel-dock"
              aria-label=${I18n['com.affine.whiteboard.chrome.panel.title']()}
            >
              <div class="header">
                <span class="title"
                  >${I18n['com.affine.whiteboard.chrome.panel.title']()}</span
                >
                <button
                  type="button"
                  data-testid="mosaic-board-panel-close"
                  aria-label=${I18n['com.affine.whiteboard.chrome.panel.close']()}
                  @click=${() => board.ui.closePanel()}
                >
                  ${I18n['com.affine.whiteboard.chrome.panel.close']()}
                </button>
              </div>
              <div class="tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  data-testid="mosaic-board-panel-tab-templates"
                  data-active=${String(this.panelId === 'templates')}
                  aria-selected=${String(this.panelId === 'templates')}
                  @click=${() => this.open('templates')}
                >
                  ${I18n['com.affine.whiteboard.chrome.panel.templates']()}
                </button>
                <button
                  type="button"
                  role="tab"
                  data-testid="mosaic-board-panel-tab-frames"
                  data-active=${String(this.panelId === 'frames')}
                  aria-selected=${String(this.panelId === 'frames')}
                  @click=${() => this.open('frames')}
                >
                  ${I18n['com.affine.whiteboard.chrome.panel.frames']()}
                </button>
                <button
                  type="button"
                  role="tab"
                  data-testid="mosaic-board-panel-tab-widgets"
                  data-active=${String(this.panelId === 'widgets')}
                  aria-selected=${String(this.panelId === 'widgets')}
                  @click=${() => this.open('widgets')}
                >
                  ${I18n['com.affine.whiteboard.chrome.panel.widgets']()}
                </button>
              </div>
              <div class="body">
                ${
                  this.panelId === 'templates'
                    ? this.renderTemplates()
                    : this.panelId === 'widgets'
                      ? this.renderCatalogGroup('widgets')
                      : this.frames.length
                        ? this.frames.map(
                            frame => html`<button
                              type="button"
                              data-testid="mosaic-board-panel-frame-${frame.id}"
                              @click=${() =>
                                board.viewport.zoomTo([frame.id], {
                                  smooth: true,
                                })}
                            >
                              ${
                                frame.title ||
                                I18n[
                                  'com.affine.whiteboard.chrome.frame.title'
                                ]()
                              }
                            </button>`
                          )
                        : html`<p class="hint">
                            ${I18n[
                              'com.affine.whiteboard.chrome.panel.frames.empty'
                            ]()}
                          </p>`
                }
              </div>
            </aside>`
          : html`<button
              class="handle"
              type="button"
              data-testid="mosaic-board-panel-open"
              aria-label=${I18n['com.affine.whiteboard.chrome.panel.open']()}
              @click=${() => this.open('templates')}
            >
              ${I18n['com.affine.whiteboard.chrome.panel.open']()}
            </button>`
      }
      ${
        modal
          ? html`<div
              class="modal"
              role="dialog"
              aria-modal="true"
              data-testid="mosaic-board-panel-modal"
            >
              <strong>${modal.title}</strong>
              ${modal.message ? html`<p class="hint">${modal.message}</p>` : nothing}
              <div class="modal-actions">
                <button
                  type="button"
                  data-testid="mosaic-board-panel-modal-cancel"
                  @click=${() => board.ui.resolveModal(false)}
                >
                  ${
                    modal.cancelLabel ??
                    I18n['com.affine.whiteboard.chrome.panel.modal.cancel']()
                  }
                </button>
                <button
                  type="button"
                  data-testid="mosaic-board-panel-modal-confirm"
                  @click=${() => board.ui.resolveModal(true)}
                >
                  ${
                    modal.confirmLabel ??
                    I18n['com.affine.whiteboard.chrome.panel.modal.confirm']()
                  }
                </button>
              </div>
            </div>`
          : nothing
      }
    `;
  }
}

export const boardPanelWidget = WidgetViewExtension(
  'affine:page',
  WB_BOARD_PANEL_WIDGET,
  literal`${unsafeStatic(WB_BOARD_PANEL_WIDGET)}`
);

declare global {
  interface HTMLElementTagNameMap {
    'wb-board-panel': MosaicBoardPanelHost;
  }
}
