import type { MosaicBoard } from '../sdk/board';
import { viewportCenterFromTopLeft } from '../sdk/viewport';
import { MOSAIC_STICKY_HEIGHT, MOSAIC_STICKY_WIDTH } from './sticky-preset';
import {
  type MosaicTemplateId,
  mosaicTemplateLayout,
} from './templates-catalog';

export function selectedFrameId(board: MosaicBoard): string | undefined {
  const frames = new Set(board.listFrames().map(frame => frame.id));
  return board.getSelection().find(id => frames.has(id));
}

function packOrigin(
  board: MosaicBoard,
  width: number,
  height: number
): { x: number; y: number } {
  const { centerX, centerY } = viewportCenterFromTopLeft(board.viewport.get());
  return { x: centerX - width / 2, y: centerY - height / 2 };
}

function packWidth(stickies: readonly { x: number }[]): number {
  if (!stickies.length) return 0;
  return Math.max(...stickies.map(item => item.x)) + MOSAIC_STICKY_WIDTH;
}

function packHeight(stickies: readonly { y: number }[]): number {
  if (!stickies.length) return 0;
  return Math.max(...stickies.map(item => item.y)) + MOSAIC_STICKY_HEIGHT;
}

/**
 * Insert a Mosaic recipe at the viewport center, or into a selected frame.
 * Returns created block ids (frame first when one is created).
 */
export function insertMosaicTemplate(
  board: MosaicBoard,
  id: MosaicTemplateId
): string[] {
  const layout = mosaicTemplateLayout(id);
  const hostFrame = selectedFrameId(board);
  if (layout.widget) {
    const created = board.createWidget(layout.widget);
    if (created && hostFrame) board.addToFrame(hostFrame, [created]);
    return created ? [created] : [];
  }

  const created: string[] = [];
  let originX: number;
  let originY: number;
  let frameId = hostFrame;

  if (layout.frame && !hostFrame) {
    const origin = packOrigin(board, layout.frame.w, layout.frame.h);
    frameId = board.createFrame({
      title: layout.frame.title,
      width: layout.frame.w,
      height: layout.frame.h,
      x: origin.x,
      y: origin.y,
    });
    if (frameId) created.push(frameId);
    const bound = frameId ? board.getBound(frameId) : null;
    originX = bound?.x ?? origin.x;
    originY = bound?.y ?? origin.y;
  } else if (hostFrame) {
    const bound = board.getBound(hostFrame);
    originX = bound?.x ?? 0;
    originY = bound?.y ?? 0;
  } else {
    const origin = packOrigin(
      board,
      packWidth(layout.stickies),
      packHeight(layout.stickies)
    );
    originX = origin.x;
    originY = origin.y;
  }

  const stickyIds: string[] = [];
  for (const sticky of layout.stickies) {
    const noteId = board.createSticky({
      x: originX + sticky.x,
      y: originY + sticky.y,
      swatch: sticky.swatch,
    });
    if (noteId) {
      stickyIds.push(noteId);
      created.push(noteId);
    }
  }
  if (frameId && stickyIds.length) board.addToFrame(frameId, stickyIds);
  return created;
}
