import { EdgelessCRUDIdentifier } from '@blocksuite/affine/blocks/surface';
import { Bound } from '@blocksuite/affine/global/gfx';
import { FrameBlockModel } from '@blocksuite/affine/model';
import type { BlockStdScope } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { Text } from '@blocksuite/affine/store';

import { isBoardReadonly } from '../infra/permissions';
import {
  createMosaicBoard,
  type MosaicBoard,
  type MosaicBoardHost,
} from './board';
import type {
  MosaicBound,
  MosaicFrameInfo,
  MosaicViewportState,
} from './types';

const boards = new WeakMap<BlockStdScope, MosaicBoard>();

function viewportState(std: BlockStdScope): MosaicViewportState {
  const viewport = std.get(GfxControllerIdentifier).viewport;
  return {
    x: viewport.viewportX,
    y: viewport.viewportY,
    zoom: viewport.zoom,
    width: viewport.width,
    height: viewport.height,
  };
}

function createHost(std: BlockStdScope): MosaicBoardHost {
  const gfx = () => std.get(GfxControllerIdentifier);
  const crud = () => std.getOptional(EdgelessCRUDIdentifier);

  return {
    get readonly() {
      return isBoardReadonly(std.store);
    },
    get rootId() {
      return std.store.root?.id ?? null;
    },
    get surfaceId() {
      return gfx().surface?.id ?? null;
    },
    getViewport() {
      return viewportState(std);
    },
    setViewport(zoom, center, smooth) {
      gfx().viewport.setViewport(zoom, center, smooth);
    },
    setViewportByBound(bound, smooth) {
      gfx().viewport.setViewportByBound(
        new Bound(bound.x, bound.y, bound.w, bound.h),
        [0.08, 0.08, 0.08, 0.08],
        smooth
      );
    },
    fitToScreen(smooth) {
      gfx().fitToScreen({ smooth: !!smooth });
    },
    lockViewport(locked) {
      gfx().viewport.locked = locked;
    },
    onViewportChange(cb) {
      const sub = gfx().viewport.viewportUpdated.subscribe(() => cb());
      return () => sub.unsubscribe();
    },
    getSelection() {
      return [...gfx().selection.selectedIds];
    },
    setSelection(ids) {
      gfx().selection.set({ elements: ids, editing: false });
    },
    onSelectionChange(cb) {
      const sub = gfx().selection.slots.updated.subscribe(() => cb());
      return () => sub.unsubscribe();
    },
    viewportCenter() {
      const viewport = gfx().viewport;
      return { x: viewport.centerX, y: viewport.centerY };
    },
    addBlock(flavour, props, parentId) {
      const next =
        flavour === 'affine:frame' && typeof props.title === 'string'
          ? { ...props, title: new Text(props.title) }
          : props;
      const service = crud();
      if (service) return service.addBlock(flavour, next, parentId);
      return std.store.addBlock(flavour as never, next, parentId);
    },
    addElement(type, props) {
      return crud()?.addElement(type, props);
    },
    getProps(id) {
      const model = gfx().getElementById(id);
      if (!model) return null;
      if ('props' in model) return (model as { props: unknown }).props;
      if ('yMap' in model && model.yMap && 'toJSON' in model.yMap) {
        return (model.yMap as { toJSON: () => unknown }).toJSON();
      }
      return model;
    },
    setProps(id, props) {
      const service = crud();
      if (service) {
        service.updateElement(id, props);
        return;
      }
      gfx().updateElement(id, props);
    },
    getBound(id): MosaicBound | null {
      const model = gfx().getElementById(id);
      if (!model || !('elementBound' in model)) return null;
      const bound = model.elementBound;
      return { x: bound.x, y: bound.y, w: bound.w, h: bound.h };
    },
    addToFrame(frameId, childIds) {
      const frame = std.store.getBlock(frameId)?.model;
      if (!(frame instanceof FrameBlockModel)) return;
      const models = childIds
        .map(id => gfx().getElementById(id))
        .filter((item): item is NonNullable<typeof item> => item !== null);
      frame.addChildren(models);
    },
    listFrames(): MosaicFrameInfo[] {
      return std.store
        .getAllModels()
        .filter(
          (model): model is FrameBlockModel => model instanceof FrameBlockModel
        )
        .map(model => ({
          id: model.id,
          title: model.props.title.toString(),
        }));
    },
  };
}

/** Cached per editor. Summon/follow stay on the collab flag — this is camera + CRUD only. */
export function getMosaicBoard(std: BlockStdScope): MosaicBoard {
  let board = boards.get(std);
  if (!board) {
    board = createMosaicBoard(createHost(std));
    boards.set(std, board);
  }
  return board;
}
