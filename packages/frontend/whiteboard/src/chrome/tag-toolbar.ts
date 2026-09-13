import { I18n } from '@affine/i18n';
import {
  BookmarkBlockModel,
  EmbedLinkedDocModel,
  FrameBlockModel,
  NoteBlockModel,
} from '@blocksuite/affine/model';
import { ToolbarModuleExtension } from '@blocksuite/affine/shared/services';
import { BlockFlavourIdentifier } from '@blocksuite/affine/std';
import type { GfxModel } from '@blocksuite/affine/std/gfx';
import type { BlockModel } from '@blocksuite/affine/store';
import { html } from 'lit';

import { RecordCardBlockModel } from '../blocks/record-card/model';
import { isTaggableFlavour } from './object-tags';

function isTaggableModel(model: GfxModel): model is GfxModel & BlockModel {
  if (model instanceof NoteBlockModel) return model.isSticky();
  if (
    model instanceof FrameBlockModel ||
    model instanceof BookmarkBlockModel ||
    model instanceof EmbedLinkedDocModel ||
    model instanceof RecordCardBlockModel
  ) {
    return true;
  }
  return 'flavour' in model && isTaggableFlavour(model.flavour, false);
}

export const tagToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:*'),
  config: {
    actions: [
      {
        id: 'c.mosaic-tags',
        when(ctx) {
          const models = ctx.getSurfaceModels();
          return models.length > 0 && models.every(isTaggableModel);
        },
        content(ctx) {
          const models = ctx.getSurfaceModels().filter(isTaggableModel);
          if (!models.length) return null;
          return html`<wb-tag-picker
            role="group"
            aria-label=${I18n['com.affine.whiteboard.chrome.tag.picker']()}
            .models=${models}
            .std=${ctx.std}
          ></wb-tag-picker>`;
        },
      },
    ],
  },
});
