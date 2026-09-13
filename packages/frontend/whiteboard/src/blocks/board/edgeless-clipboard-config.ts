import { EdgelessClipboardConfig } from '@blocksuite/affine/blocks/surface';
import type { BlockSnapshot } from '@blocksuite/affine/store';

import { cloneBoardDatabase } from './hub';
import { BoardBlockSchema } from './model';

export class EdgelessClipboardBoardConfig extends EdgelessClipboardConfig {
  static override readonly key = BoardBlockSchema.model.flavour;

  override createBlock(block: BlockSnapshot): string | null {
    if (!this.surface) return null;
    const {
      xywh,
      rotate,
      scale,
      title,
      linkedDocId,
      blockId,
      template,
      layout,
      viewId,
      syncMode,
      snapshotBlobId,
      liveBudgetExempt,
    } = block.props;
    let nextBlockId = blockId as string | undefined;
    let nextViewId = viewId as string | undefined;
    const nextSync = syncMode === 'projection' ? 'projection' : 'owned';
    if (
      nextSync === 'owned' &&
      typeof blockId === 'string' &&
      this.std?.store
    ) {
      const cloned = cloneBoardDatabase(
        this.std.store,
        blockId,
        typeof title === 'string' ? title : 'Board',
        typeof template === 'string' ? template : 'todo'
      );
      nextBlockId = cloned?.databaseId ?? blockId;
      nextViewId = cloned?.viewId;
    }
    return this.crud.addBlock(
      BoardBlockSchema.model.flavour,
      {
        xywh,
        rotate,
        scale,
        title,
        linkedDocId,
        blockId: nextBlockId,
        template,
        layout,
        viewId: nextViewId,
        syncMode: nextSync,
        focusMode: false,
        snapshotBlobId,
        liveBudgetExempt,
      },
      this.surface.model.id
    );
  }
}
