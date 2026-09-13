import { I18n } from '@affine/i18n';
import { IS_MOBILE } from '@blocksuite/affine/global/env';
import type { RootBlockModel } from '@blocksuite/affine/model';
import { WidgetComponent, WidgetViewExtension } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { effect } from '@preact/signals-core';
import { css, nothing } from 'lit';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { adoptStyleSheet, dropStyleSheet } from './adopt';
import {
  MOSAIC_WORKSHOP_CHROME_ATTR,
  MOSAIC_WORKSHOP_LAYOUT_ATTR,
  type MosaicWorkshopChromeMode,
  workshopChromeMode,
} from './layout';
import {
  MOSAIC_FRAME_TITLE_CSS,
  MOSAIC_SELECTION_PANEL_CSS,
  MOSAIC_TOOLBAR_RAIL_CSS,
  MOSAIC_ZOOM_INNER_PANEL_CSS,
  MOSAIC_ZOOM_PANEL_CSS,
} from './layout-styles';

export const WB_WORKSHOP_CHROME_WIDGET = 'wb-workshop-chrome';

const toolbarSheetKey = {};
const zoomHostSheetKey = {};
const zoomInnerSheetKey = {};
const selectionSheetKey = {};
const frameTitleSheetKey = {};

export class MosaicWorkshopChromeWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      display: none;
    }
  `;

  private resizeObserver: ResizeObserver | null = null;

  private mutationObserver: MutationObserver | null = null;

  private get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  private viewportEl(): HTMLElement | null {
    return (
      this.closest('.affine-edgeless-viewport') ??
      this.std.host.closest('.affine-edgeless-viewport')
    );
  }

  private presentMode() {
    return this.gfx.tool.currentToolName$.value === 'frameNavigator';
  }

  private viewportWidth() {
    const el = this.viewportEl() ?? this.gfx.viewport.element;
    return el?.clientWidth ?? 0;
  }

  private toolbarEl() {
    return this.viewportEl()?.querySelector('edgeless-toolbar-widget');
  }

  private zoomHostEl() {
    return this.viewportEl()?.querySelector(
      'affine-edgeless-zoom-toolbar-widget'
    );
  }

  private selectionHostEl() {
    return this.viewportEl()?.querySelector('affine-toolbar-widget');
  }

  private applyFrameTitleSkin(on: boolean) {
    const titles =
      this.viewportEl()?.querySelectorAll('affine-frame-title') ?? [];
    for (const title of titles) {
      if (on) {
        adoptStyleSheet(
          title.shadowRoot,
          MOSAIC_FRAME_TITLE_CSS,
          frameTitleSheetKey
        );
      } else {
        dropStyleSheet(title.shadowRoot, frameTitleSheetKey);
      }
    }
  }

  private applyMode(mode: MosaicWorkshopChromeMode) {
    const viewport = this.viewportEl();
    if (viewport) {
      viewport.setAttribute(MOSAIC_WORKSHOP_CHROME_ATTR, mode);
    }

    const toolbar = this.toolbarEl();
    const zoomHost = this.zoomHostEl();
    const zoomInner = zoomHost?.shadowRoot?.querySelector(
      'edgeless-zoom-toolbar'
    );
    const selectionHost = this.selectionHostEl();
    const selectionBar =
      selectionHost?.shadowRoot?.querySelector('editor-toolbar');

    if (mode === 'rail') {
      toolbar?.setAttribute(MOSAIC_WORKSHOP_LAYOUT_ATTR, 'rail');
      toolbar?.setAttribute('role', 'toolbar');
      toolbar?.setAttribute('aria-orientation', 'vertical');
      toolbar?.setAttribute(
        'aria-label',
        I18n['com.affine.whiteboard.chrome.rail.label']()
      );
      adoptStyleSheet(
        toolbar?.shadowRoot,
        MOSAIC_TOOLBAR_RAIL_CSS,
        toolbarSheetKey
      );
      adoptStyleSheet(
        zoomHost?.shadowRoot,
        MOSAIC_ZOOM_PANEL_CSS,
        zoomHostSheetKey
      );
      adoptStyleSheet(
        zoomInner?.shadowRoot,
        MOSAIC_ZOOM_INNER_PANEL_CSS,
        zoomInnerSheetKey
      );
      adoptStyleSheet(
        selectionBar?.shadowRoot,
        MOSAIC_SELECTION_PANEL_CSS,
        selectionSheetKey
      );
      this.applyFrameTitleSkin(true);
      return;
    }

    toolbar?.removeAttribute(MOSAIC_WORKSHOP_LAYOUT_ATTR);
    toolbar?.removeAttribute('role');
    toolbar?.removeAttribute('aria-orientation');
    toolbar?.removeAttribute('aria-label');
    dropStyleSheet(toolbar?.shadowRoot, toolbarSheetKey);
    dropStyleSheet(zoomHost?.shadowRoot, zoomHostSheetKey);
    dropStyleSheet(zoomInner?.shadowRoot, zoomInnerSheetKey);
    dropStyleSheet(selectionBar?.shadowRoot, selectionSheetKey);
    this.applyFrameTitleSkin(true);
  }

  private sync() {
    // Mounted only when AFFiNE `enableWorkshopChrome` is on (`view.ts`).
    // Do not re-read the BlockSuite flag here: FeatureFlagSyncer runs once
    // at store load and can stay stale after the AFFiNE toggle remounts views.
    const next = workshopChromeMode({
      flag: true,
      isMobile: IS_MOBILE,
      presentMode: this.presentMode(),
      viewportWidth: this.viewportWidth(),
    });
    this.dataset.mode = next;
    this.applyMode(next);
  }

  private clear() {
    const viewport = this.viewportEl();
    viewport?.removeAttribute(MOSAIC_WORKSHOP_CHROME_ATTR);
    this.applyMode('fallback');
    this.applyFrameTitleSkin(false);
    viewport?.removeAttribute(MOSAIC_WORKSHOP_CHROME_ATTR);
  }

  override connectedCallback() {
    super.connectedCallback();
    this.dataset.testid = 'mosaic-workshop-chrome';
    this.sync();
    this.disposables.add(
      effect(() => {
        const tool = this.gfx.tool.currentToolName$.value;
        void tool;
        this.sync();
      })
    );
  }

  override firstUpdated() {
    const viewport = this.viewportEl();
    if (viewport && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.sync());
      this.resizeObserver.observe(viewport);
    }
    if (viewport && typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver(() =>
        this.applyFrameTitleSkin(true)
      );
      this.mutationObserver.observe(viewport, {
        childList: true,
        subtree: true,
      });
    }
    this.sync();
    requestAnimationFrame(() => this.sync());
  }

  override disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.clear();
    super.disconnectedCallback();
  }

  override render() {
    return nothing;
  }
}

export const workshopChromeWidget = WidgetViewExtension(
  'affine:page',
  WB_WORKSHOP_CHROME_WIDGET,
  literal`${unsafeStatic(WB_WORKSHOP_CHROME_WIDGET)}`
);

declare global {
  interface HTMLElementTagNameMap {
    'wb-workshop-chrome': MosaicWorkshopChromeWidget;
  }
}
