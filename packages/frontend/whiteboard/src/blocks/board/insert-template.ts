import { I18n } from '@affine/i18n';
import type { BlockStdScope } from '@blocksuite/affine/std';
import { Text } from '@blocksuite/affine/store';

import { BOARD_WIDGET_SIZE } from '../../const';
import { insertGfxWidget } from '../../insert-widget';
import { createBoardDatabase, ensureKanbanView } from './hub';
import { BoardBlockSchema } from './model';
import { boardTemplateDef } from './templates';
import type { BoardTemplate } from './types';

const flavour = BoardBlockSchema.model.flavour;

export function insertBoardTemplate(
  std: BlockStdScope,
  template: BoardTemplate,
  existingDatabaseId?: string
) {
  const def = boardTemplateDef(template);
  const title =
    I18n[def.titleKey]() || I18n['com.affine.whiteboard.board.title']();
  let blockId = existingDatabaseId;
  let viewId: string | undefined;
  if (blockId) {
    viewId = ensureKanbanView(std.store, blockId);
  } else {
    const created = createBoardDatabase(std.store, {
      title,
      template: def.id,
    });
    blockId = created?.databaseId;
    viewId = created?.viewId;
  }
  return insertGfxWidget(
    std,
    flavour,
    {
      title: new Text(title),
      linkedDocId: std.store.id,
      blockId,
      template: def.id,
      layout: def.layout === 'table' ? 'table' : 'kanban',
      viewId,
      syncMode: 'owned',
    },
    BOARD_WIDGET_SIZE
  );
}
