import { I18n } from '@affine/i18n';
import { FeatureFlagService } from '@blocksuite/affine/shared/services';
import {
  type SlashMenuConfig,
  SlashMenuConfigExtension,
} from '@blocksuite/affine/widgets/slash-menu';
import { PageIcon } from '@blocksuite/icons/lit';

import { RECORD_CARD_WIDGET_SIZE, WHITEBOARD_FLAVOURS } from '../../const';
import { insertGfxWidget } from '../../insert-widget';
import { RecordCardBlockSchema } from './model';

const flavour = RecordCardBlockSchema.model.flavour;

const recordCardSlashMenuConfig: SlashMenuConfig = {
  items: () => [
    {
      name: I18n['com.affine.whiteboard.chrome.record-card.slash-name'](),
      description:
        I18n['com.affine.whiteboard.chrome.record-card.slash-description'](),
      icon: PageIcon(),
      searchAlias: ['record', 'card', 'kanban', 'wb:record-card', 'карточка'],
      group: '4_Content & Media@13',
      when: ({ std }) =>
        std.store.schema.flavourSchemaMap.has(flavour) &&
        (std.get(FeatureFlagService).getFlag('enable_workshop_chrome') ||
          std.get(FeatureFlagService).getFlag('enable_board_widget')) &&
        !std.store.readonly,
      action: ({ std }) => {
        insertGfxWidget(std, flavour, {}, RECORD_CARD_WIDGET_SIZE);
      },
    },
  ],
};

export const RecordCardSlashMenuConfigExtension = SlashMenuConfigExtension(
  WHITEBOARD_FLAVOURS.recordCard,
  recordCardSlashMenuConfig
);
