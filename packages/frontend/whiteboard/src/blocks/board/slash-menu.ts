import { I18n } from '@affine/i18n';
import { FeatureFlagService } from '@blocksuite/affine/shared/services';
import {
  type SlashMenuConfig,
  SlashMenuConfigExtension,
} from '@blocksuite/affine/widgets/slash-menu';
import { DatabaseKanbanViewIcon } from '@blocksuite/icons/lit';

import { WHITEBOARD_FLAVOURS } from '../../const';
import { findNearbyDatabaseId } from './hub';
import { insertBoardTemplate } from './insert-template';
import { BoardBlockSchema } from './model';
import { BOARD_TEMPLATE_CATALOG, quickBoardTemplates } from './templates';

const flavour = BoardBlockSchema.model.flavour;

const boardSlashMenuConfig: SlashMenuConfig = {
  items: ({ std, model }) => {
    const enabled =
      std.store.schema.flavourSchemaMap.has(flavour) &&
      std.get(FeatureFlagService).getFlag('enable_board_widget') &&
      !std.store.readonly;

    const quick = quickBoardTemplates().map((def, index) => ({
      name: I18n[def.titleKey](),
      description: I18n[def.descriptionKey](),
      icon: DatabaseKanbanViewIcon(),
      searchAlias: ['kanban', 'board', 'wb:board', 'канбан', 'доска', def.id],
      group: `4_Content & Media@${15 + index * 0.3}`,
      when: () => enabled,
      action: () => insertBoardTemplate(std, def.id),
    }));

    const extra = BOARD_TEMPLATE_CATALOG.filter(
      def => !quick.some(item => item.searchAlias.includes(def.id))
    ).map((def, index) => ({
      name: I18n[def.titleKey](),
      description: I18n[def.descriptionKey](),
      icon: DatabaseKanbanViewIcon(),
      searchAlias: ['kanban', 'template', def.id, 'шаблон'],
      group: `4_Content & Media@${16.5 + index * 0.05}`,
      when: () => enabled,
      action: () => insertBoardTemplate(std, def.id),
    }));

    return [
      ...quick,
      ...extra,
      {
        name: I18n['com.affine.whiteboard.board.from-table'](),
        description:
          I18n['com.affine.whiteboard.board.from-table-description'](),
        icon: DatabaseKanbanViewIcon(),
        searchAlias: ['board from table', 'канбан из таблицы'],
        group: '4_Content & Media@17',
        when: () => enabled && !!findNearbyDatabaseId(std.store, model.id),
        action: ({ std, model }) => {
          insertBoardTemplate(
            std,
            'todo',
            findNearbyDatabaseId(std.store, model.id)
          );
        },
      },
    ];
  },
};

export const BoardSlashMenuConfigExtension = SlashMenuConfigExtension(
  WHITEBOARD_FLAVOURS.board,
  boardSlashMenuConfig
);
