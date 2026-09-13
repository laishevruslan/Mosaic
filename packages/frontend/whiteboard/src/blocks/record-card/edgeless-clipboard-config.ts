import { EdgelessClipboardConfig } from '@blocksuite/affine/blocks/surface';
import type { BlockSnapshot } from '@blocksuite/affine/store';

import { RecordCardBlockSchema } from './model';

export class EdgelessClipboardRecordCardConfig extends EdgelessClipboardConfig {
  static override readonly key = RecordCardBlockSchema.model.flavour;

  override createBlock(block: BlockSnapshot): string | null {
    if (!this.surface) return null;
    const {
      xywh,
      rotate,
      scale,
      databaseDocId,
      databaseId,
      rowId,
      compact,
      tags,
      mosaicMeta,
    } = block.props;
    return this.crud.addBlock(
      RecordCardBlockSchema.model.flavour,
      {
        xywh,
        rotate,
        scale,
        databaseDocId,
        databaseId,
        rowId,
        compact,
        tags,
        mosaicMeta,
      },
      this.surface.model.id
    );
  }
}
