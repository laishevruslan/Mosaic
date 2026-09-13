import { DefaultTool } from '@blocksuite/affine/blocks/surface';
import { Point } from '@blocksuite/affine/global/gfx';
import { NoteBlockModel } from '@blocksuite/affine/model';
import { focusTextModel } from '@blocksuite/affine/rich-text';
import { TelemetryProvider } from '@blocksuite/affine/shared/services';
import { handleNativeRangeAtPoint } from '@blocksuite/affine/shared/utils';
import type { PointerEventState } from '@blocksuite/affine/std';
import { BaseTool, GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';

import { createStickyNoteProps, MOSAIC_STICKY_TOOL } from './sticky-preset';

export class StickyTool extends BaseTool {
  static override toolName = MOSAIC_STICKY_TOOL;

  override click(e: PointerEventState): void {
    addSticky(this.std, new Point(e.point.x, e.point.y));
  }
}

export function addSticky(
  std: StickyTool['std'],
  point: Point,
  swatch?: Parameters<typeof createStickyNoteProps>[0]['swatch']
): string | undefined {
  const gfx = std.get(GfxControllerIdentifier);
  const parentId = gfx.doc.root?.id;
  if (!parentId) return;

  const [x, y] = gfx.viewport.toModelCoord(point.x, point.y);
  const props = createStickyNoteProps({ x, y, swatch });
  const noteId = std.store.addBlock('affine:note', props, parentId);
  const blockId = std.store.addBlock(
    'affine:paragraph',
    { type: 'text' },
    noteId
  );

  std.getOptional(TelemetryProvider)?.track('CanvasElementAdded', {
    control: 'canvas:draw',
    page: 'whiteboard editor',
    module: 'toolbar',
    segment: 'toolbar',
    type: 'sticky',
  });

  gfx.tool.setTool(DefaultTool);

  requestAnimationFrame(() => {
    const note = std.store.getModelById(noteId);
    if (!(note instanceof NoteBlockModel) || !note.isSticky()) return;
    gfx.selection.set({
      elements: [noteId],
      editing: true,
    });
    if (blockId) {
      focusTextModel(gfx.std, blockId);
    } else {
      handleNativeRangeAtPoint(point.x, point.y);
    }
  });

  return noteId;
}
