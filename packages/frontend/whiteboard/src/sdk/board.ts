/**
 * Mosaic board SDK layer 1. Thin wrappers over a host (BlockSuite in from-std.ts).
 * No `window.miro`, no competing WebSDK packages.
 */

import {
  createStickyNoteProps,
  MOSAIC_STICKY_HEIGHT,
  MOSAIC_STICKY_WIDTH,
} from '../chrome/sticky-preset';
import {
  BOARD_WIDGET_SIZE,
  CHART_WIDGET_SIZE,
  RECORD_CARD_WIDGET_SIZE,
  SKETCH_WIDGET_SIZE,
  WHITEBOARD_FLAVOURS,
} from '../const';
import { mergeMosaicMeta, mosaicMetaPropKey, readMosaicMeta } from './metadata';
import {
  MOSAIC_BOOKMARK_CARD_HEIGHT,
  MOSAIC_BOOKMARK_CARD_WIDTH,
  MOSAIC_CONNECTOR_FRONT,
  MOSAIC_CONNECTOR_MODE,
  MOSAIC_CONNECTOR_REAR,
  MOSAIC_CONNECTOR_STROKE_WIDTH,
  MOSAIC_FRAME_DEFAULT_HEIGHT,
  MOSAIC_FRAME_DEFAULT_WIDTH,
  type MosaicBoardEvent,
  type MosaicBound,
  type MosaicCreateCardProps,
  type MosaicCreateConnectorProps,
  type MosaicCreateFrameProps,
  type MosaicCreateStickyProps,
  type MosaicFrameInfo,
  type MosaicMeta,
  type MosaicMetaValue,
  type MosaicOpenModalOptions,
  type MosaicOpenPanelOptions,
  type MosaicPanelId,
  type MosaicViewportSetOptions,
  type MosaicViewportState,
  type MosaicWidgetKind,
} from './types';
import { applyViewportSet, isMosaicBound, unionBounds } from './viewport';

export type MosaicBoardHost = {
  readonly: boolean;
  getViewport(): MosaicViewportState;
  setViewport(zoom: number, center: [number, number], smooth: boolean): void;
  setViewportByBound(bound: MosaicBound, smooth: boolean): void;
  fitToScreen(smooth?: boolean): void;
  lockViewport(locked: boolean): void;
  onViewportChange(cb: () => void): () => void;
  getSelection(): string[];
  setSelection(ids: string[]): void;
  onSelectionChange(cb: () => void): () => void;
  viewportCenter(): { x: number; y: number };
  rootId: string | null;
  surfaceId: string | null;
  addBlock(
    flavour: string,
    props: Record<string, unknown>,
    parentId: string
  ): string;
  addElement(type: string, props: Record<string, unknown>): string | undefined;
  getProps(id: string): unknown;
  setProps(id: string, props: Record<string, unknown>): void;
  getBound(id: string): MosaicBound | null;
  addToFrame(frameId: string, childIds: string[]): void;
  listFrames(): MosaicFrameInfo[];
};

export type MosaicBoard = {
  createSticky(props?: MosaicCreateStickyProps): string | undefined;
  createFrame(props?: MosaicCreateFrameProps): string | undefined;
  createCard(props: MosaicCreateCardProps): string | undefined;
  createConnector(props: MosaicCreateConnectorProps): string | undefined;
  createWidget(
    kind: MosaicWidgetKind,
    props?: { x?: number; y?: number }
  ): string | undefined;
  addToFrame(frameId: string, childIds: string[]): void;
  getBound(id: string): MosaicBound | null;
  getSelection(): string[];
  setSelection(ids: string[]): void;
  viewport: {
    get(): MosaicViewportState;
    set(
      x: number,
      y: number,
      zoom: number,
      options?: MosaicViewportSetOptions
    ): void;
    zoomTo(
      target: MosaicBound | string[],
      options?: MosaicViewportSetOptions
    ): void;
    fitToScreen(options?: MosaicViewportSetOptions): void;
    lock(locked: boolean): void;
    on(event: 'change', cb: (state: MosaicViewportState) => void): () => void;
  };
  ui: {
    openPanel(options: MosaicOpenPanelOptions): void;
    closePanel(): void;
    panelId(): MosaicPanelId | null;
    onPanelChange(cb: (id: MosaicPanelId | null) => void): () => void;
    openModal(options: MosaicOpenModalOptions): Promise<boolean>;
    resolveModal(confirmed: boolean): void;
    modal(): MosaicOpenModalOptions | null;
    onModalChange(cb: () => void): () => void;
  };
  getMetadata(id: string): MosaicMeta;
  setMetadata(
    id: string,
    key: string,
    value: MosaicMetaValue | undefined
  ): void;
  on(event: MosaicBoardEvent, cb: () => void): () => void;
  listFrames(): MosaicFrameInfo[];
};

function xywhAt(
  host: MosaicBoardHost,
  x: number | undefined,
  y: number | undefined,
  width: number,
  height: number
) {
  const center = host.viewportCenter();
  const left = x ?? center.x - width / 2;
  const top = y ?? center.y - height / 2;
  return `[${left},${top},${width},${height}]`;
}

function isRecordCard(
  props: MosaicCreateCardProps
): props is Extract<
  MosaicCreateCardProps,
  { databaseId: string; rowId: string }
> {
  return 'databaseId' in props && 'rowId' in props;
}

function isLinkedDoc(
  props: MosaicCreateCardProps
): props is Extract<MosaicCreateCardProps, { pageId: string }> {
  return 'pageId' in props;
}

export function createMosaicBoard(host: MosaicBoardHost): MosaicBoard {
  const viewportListeners = new Set<(state: MosaicViewportState) => void>();
  const boardListeners = new Set<{ event: MosaicBoardEvent; cb: () => void }>();
  const panelListeners = new Set<(id: MosaicPanelId | null) => void>();
  const modalListeners = new Set<() => void>();

  let panelId: MosaicPanelId | null = null;
  let modal: MosaicOpenModalOptions | null = null;
  let modalResolve: ((value: boolean) => void) | null = null;

  const stopViewport = host.onViewportChange(() => {
    const state = host.getViewport();
    for (const cb of viewportListeners) cb(state);
    for (const entry of boardListeners) {
      if (entry.event === 'viewport:change') entry.cb();
    }
  });
  const stopSelection = host.onSelectionChange(() => {
    for (const entry of boardListeners) {
      if (entry.event === 'selection:change') entry.cb();
    }
  });
  void stopViewport;
  void stopSelection;

  const viewport = {
    get() {
      return host.getViewport();
    },
    set(
      x: number,
      y: number,
      zoom: number,
      options?: MosaicViewportSetOptions
    ) {
      const next = applyViewportSet(host.getViewport(), x, y, zoom, options);
      host.setViewport(
        next.zoom,
        [next.centerX, next.centerY],
        !!options?.smooth
      );
    },
    zoomTo(target: MosaicBound | string[], options?: MosaicViewportSetOptions) {
      const bound = Array.isArray(target)
        ? unionBounds(
            target
              .map(id => host.getBound(id))
              .filter((item): item is MosaicBound => item !== null)
          )
        : isMosaicBound(target)
          ? target
          : null;
      if (!bound) return;
      host.setViewportByBound(bound, !!options?.smooth);
    },
    fitToScreen(options?: MosaicViewportSetOptions) {
      host.fitToScreen(!!options?.smooth);
    },
    lock(locked: boolean) {
      host.lockViewport(locked);
    },
    on(event: 'change', cb: (state: MosaicViewportState) => void) {
      if (event !== 'change') return () => {};
      viewportListeners.add(cb);
      return () => {
        viewportListeners.delete(cb);
      };
    },
  };

  return {
    createSticky(props = {}) {
      if (host.readonly || !host.rootId) return;
      const width = props.width ?? MOSAIC_STICKY_WIDTH;
      const height = props.height ?? MOSAIC_STICKY_HEIGHT;
      const center = host.viewportCenter();
      const x = props.x ?? center.x - width / 2;
      const y = props.y ?? center.y - height / 2;
      const noteProps = {
        ...createStickyNoteProps({ x, y, width, height, swatch: props.swatch }),
        tags: props.tags,
      };
      const id = host.addBlock('affine:note', noteProps, host.rootId);
      host.addBlock('affine:paragraph', { type: 'text' }, id);
      host.setSelection([id]);
      return id;
    },
    createFrame(props = {}) {
      if (host.readonly || !host.surfaceId) return;
      const width = props.width ?? MOSAIC_FRAME_DEFAULT_WIDTH;
      const height = props.height ?? MOSAIC_FRAME_DEFAULT_HEIGHT;
      const id = host.addBlock(
        'affine:frame',
        {
          title: props.title ?? 'Frame',
          xywh: xywhAt(host, props.x, props.y, width, height),
          tags: props.tags,
        },
        host.surfaceId
      );
      host.setSelection([id]);
      return id;
    },
    createCard(props) {
      if (host.readonly || !host.surfaceId) return;
      let id: string | undefined;
      if (isRecordCard(props)) {
        const width = props.width ?? RECORD_CARD_WIDGET_SIZE.width;
        const height = props.height ?? RECORD_CARD_WIDGET_SIZE.height;
        id = host.addBlock(
          WHITEBOARD_FLAVOURS.recordCard,
          {
            xywh: xywhAt(host, props.x, props.y, width, height),
            databaseDocId: props.databaseDocId ?? '',
            databaseId: props.databaseId,
            rowId: props.rowId,
            compact: props.compact ?? false,
            tags: props.tags,
          },
          host.surfaceId
        );
      } else if (isLinkedDoc(props)) {
        const width = props.width ?? MOSAIC_BOOKMARK_CARD_WIDTH;
        const height = props.height ?? MOSAIC_BOOKMARK_CARD_HEIGHT;
        id = host.addBlock(
          'affine:embed-linked-doc',
          {
            pageId: props.pageId,
            xywh: xywhAt(host, props.x, props.y, width, height),
            tags: props.tags,
          },
          host.surfaceId
        );
      } else {
        const width = props.width ?? MOSAIC_BOOKMARK_CARD_WIDTH;
        const height = props.height ?? MOSAIC_BOOKMARK_CARD_HEIGHT;
        id = host.addBlock(
          'affine:bookmark',
          {
            url: props.url,
            title: props.title ?? null,
            xywh: xywhAt(host, props.x, props.y, width, height),
            tags: props.tags,
          },
          host.surfaceId
        );
      }
      if (id) host.setSelection([id]);
      return id;
    },
    createWidget(kind, props = {}) {
      if (host.readonly || !host.surfaceId) return;
      const size =
        kind === 'chart'
          ? CHART_WIDGET_SIZE
          : kind === 'board'
            ? BOARD_WIDGET_SIZE
            : SKETCH_WIDGET_SIZE;
      const flavour =
        kind === 'chart'
          ? WHITEBOARD_FLAVOURS.chart
          : kind === 'board'
            ? WHITEBOARD_FLAVOURS.board
            : WHITEBOARD_FLAVOURS.sketch;
      const id = host.addBlock(
        flavour,
        {
          xywh: xywhAt(host, props.x, props.y, size.width, size.height),
        },
        host.surfaceId
      );
      host.setSelection([id]);
      return id;
    },
    createConnector(props) {
      if (host.readonly) return;
      return host.addElement('connector', {
        mode: MOSAIC_CONNECTOR_MODE[props.mode ?? 'curve'],
        strokeWidth: MOSAIC_CONNECTOR_STROKE_WIDTH,
        frontEndpointStyle: MOSAIC_CONNECTOR_FRONT,
        rearEndpointStyle: MOSAIC_CONNECTOR_REAR,
        source: props.source,
        target: props.target,
        controllers: [],
      });
    },
    addToFrame(frameId, childIds) {
      if (host.readonly) return;
      host.addToFrame(frameId, childIds);
    },
    getBound(id) {
      return host.getBound(id);
    },
    getSelection() {
      return host.getSelection();
    },
    setSelection(ids) {
      host.setSelection(ids);
    },
    viewport,
    ui: {
      openPanel(options) {
        panelId = options.id;
        for (const cb of panelListeners) cb(panelId);
      },
      closePanel() {
        panelId = null;
        for (const cb of panelListeners) cb(null);
      },
      panelId() {
        return panelId;
      },
      onPanelChange(cb) {
        panelListeners.add(cb);
        return () => {
          panelListeners.delete(cb);
        };
      },
      openModal(options) {
        modalResolve?.(false);
        modal = options;
        return new Promise<boolean>(resolve => {
          modalResolve = resolve;
          for (const cb of modalListeners) cb();
        });
      },
      resolveModal(confirmed) {
        const resolve = modalResolve;
        modal = null;
        modalResolve = null;
        for (const cb of modalListeners) cb();
        resolve?.(confirmed);
      },
      modal() {
        return modal;
      },
      onModalChange(cb) {
        modalListeners.add(cb);
        return () => {
          modalListeners.delete(cb);
        };
      },
    },
    getMetadata(id) {
      return readMosaicMeta(host.getProps(id));
    },
    setMetadata(id, key, value) {
      if (host.readonly) return;
      const next = mergeMosaicMeta(
        readMosaicMeta(host.getProps(id)),
        key,
        value
      );
      host.setProps(id, { [mosaicMetaPropKey()]: next });
    },
    on(event, cb) {
      const entry = { event, cb };
      boardListeners.add(entry);
      return () => {
        boardListeners.delete(entry);
      };
    },
    listFrames() {
      return host.listFrames();
    },
  };
}
