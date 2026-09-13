import type { MosaicBoardHost } from './board';
import type {
  MosaicBound,
  MosaicFrameInfo,
  MosaicViewportState,
} from './types';

export type FakeBoardBlock = {
  flavour: string;
  parent: string;
  props: Record<string, unknown>;
};

export type FakeMosaicBoardHost = MosaicBoardHost & {
  blocks: Map<string, FakeBoardBlock>;
  elements: Map<string, Record<string, unknown>>;
  viewportState: MosaicViewportState;
  locked: boolean;
  emitViewport(): void;
  emitSelection(): void;
};

function parseXywh(xywh: unknown): MosaicBound | null {
  if (typeof xywh !== 'string') return null;
  try {
    const [x, y, w, h] = JSON.parse(xywh) as number[];
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return { x, y, w, h };
  } catch {
    return null;
  }
}

/** In-memory host for mosaic.board unit tests. Not part of the public SDK. */
export function createFakeHost(
  init?: Partial<MosaicViewportState>
): FakeMosaicBoardHost {
  const blocks = new Map<string, FakeBoardBlock>();
  const elements = new Map<string, Record<string, unknown>>();
  const viewportState: MosaicViewportState = {
    x: 0,
    y: 0,
    zoom: 1,
    width: 1440,
    height: 900,
    ...init,
  };
  let locked = false;
  let selection: string[] = [];
  let seq = 0;
  const viewportCbs = new Set<() => void>();
  const selectionCbs = new Set<() => void>();

  const host: FakeMosaicBoardHost = {
    blocks,
    elements,
    viewportState,
    get locked() {
      return locked;
    },
    readonly: false,
    rootId: 'page',
    surfaceId: 'surface',
    getViewport() {
      return { ...viewportState };
    },
    setViewport(zoom, center) {
      viewportState.zoom = zoom;
      viewportState.x = center[0] - viewportState.width / 2 / zoom;
      viewportState.y = center[1] - viewportState.height / 2 / zoom;
      host.emitViewport();
    },
    setViewportByBound(bound) {
      const zoom = Math.min(
        viewportState.width / bound.w,
        viewportState.height / bound.h
      );
      host.setViewport(
        zoom,
        [bound.x + bound.w / 2, bound.y + bound.h / 2],
        false
      );
    },
    fitToScreen() {
      viewportState.x = 0;
      viewportState.y = 0;
      viewportState.zoom = 1;
      host.emitViewport();
    },
    lockViewport(next) {
      locked = next;
    },
    onViewportChange(cb) {
      viewportCbs.add(cb);
      return () => viewportCbs.delete(cb);
    },
    getSelection() {
      return [...selection];
    },
    setSelection(ids) {
      selection = [...ids];
      host.emitSelection();
    },
    onSelectionChange(cb) {
      selectionCbs.add(cb);
      return () => selectionCbs.delete(cb);
    },
    viewportCenter() {
      return {
        x: viewportState.x + viewportState.width / 2 / viewportState.zoom,
        y: viewportState.y + viewportState.height / 2 / viewportState.zoom,
      };
    },
    addBlock(flavour, props, parentId) {
      const id = `b${++seq}`;
      blocks.set(id, { flavour, parent: parentId, props: { ...props } });
      return id;
    },
    addElement(type, props) {
      const id = `e${++seq}`;
      elements.set(id, { type, ...props });
      return id;
    },
    getProps(id) {
      return blocks.get(id)?.props ?? elements.get(id) ?? null;
    },
    setProps(id, props) {
      const block = blocks.get(id);
      if (block) {
        block.props = { ...block.props, ...props };
        return;
      }
      const element = elements.get(id);
      if (element) Object.assign(element, props);
    },
    getBound(id) {
      const props = host.getProps(id);
      return parseXywh(
        props && typeof props === 'object'
          ? (props as { xywh?: unknown }).xywh
          : null
      );
    },
    addToFrame(frameId, childIds) {
      const frame = blocks.get(frameId);
      if (!frame) return;
      const existing = frame.props.childElementIds as
        | Record<string, boolean>
        | undefined;
      const childElementIds = { ...existing };
      for (const childId of childIds) childElementIds[childId] = true;
      frame.props.childElementIds = childElementIds;
    },
    listFrames(): MosaicFrameInfo[] {
      return [...blocks.entries()]
        .filter(([, block]) => block.flavour === 'affine:frame')
        .map(([id, block]) => ({
          id,
          title: String(block.props.title ?? ''),
        }));
    },
    emitViewport() {
      for (const cb of viewportCbs) cb();
    },
    emitSelection() {
      for (const cb of selectionCbs) cb();
    },
  };

  return host;
}
