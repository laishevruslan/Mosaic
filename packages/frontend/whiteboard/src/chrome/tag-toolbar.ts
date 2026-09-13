import { I18n } from '@affine/i18n';
import {
  BookmarkBlockModel,
  EmbedLinkedDocModel,
  FrameBlockModel,
  NoteBlockModel,
} from '@blocksuite/affine/model';
import {
  FeatureFlagService,
  type ToolbarModuleConfig,
} from '@blocksuite/affine/shared/services';
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

/**
 * Actions for the catch-all selection bar. Must be merged into AFFiNE's
 * existing `custom:affine:*` toolbar module — a second registration with
 * that id throws DuplicateServiceDefinitionError inside BlockStdScope.
 */
export const mosaicTagToolbarActions: NonNullable<
  ToolbarModuleConfig['actions']
> = [
  {
    id: 'c.mosaic-tags',
    when(ctx) {
      if (
        ctx.std.get(FeatureFlagService).getFlag('enable_workshop_chrome') !==
        true
      ) {
        return false;
      }
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
];

export function mergeMosaicTagToolbar(
  config: ToolbarModuleConfig
): ToolbarModuleConfig {
  return {
    ...config,
    actions: [...(config.actions ?? []), ...mosaicTagToolbarActions],
  };
}
