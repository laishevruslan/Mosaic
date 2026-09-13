import { I18n } from '@affine/i18n';
import { NoteBlockModel } from '@blocksuite/affine/model';
import { ToolbarModuleExtension } from '@blocksuite/affine/shared/services';
import { isStickyNote } from '@blocksuite/affine/shared/utils';
import { BlockFlavourIdentifier } from '@blocksuite/affine/std';
import { html } from 'lit';

export const stickyToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:note'),
  config: {
    actions: [
      {
        id: 'c.mosaic-sticky-palette',
        when(ctx) {
          const notes = ctx.getSurfaceModelsByType(NoteBlockModel);
          return notes.length > 0 && notes.every(isStickyNote);
        },
        content(ctx) {
          const notes = ctx.getSurfaceModelsByType(NoteBlockModel);
          if (!notes.length) return null;
          return html`<wb-sticky-palette
            role="group"
            aria-label=${I18n['com.affine.whiteboard.chrome.sticky.palette']()}
            .notes=${notes}
            .std=${ctx.std}
          ></wb-sticky-palette>`;
        },
      },
    ],
  },
});
