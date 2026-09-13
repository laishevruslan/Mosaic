import { QuickToolExtension } from '@blocksuite/affine/widgets/edgeless-toolbar';
import { html } from 'lit';

export const stickyQuickTool = QuickToolExtension(
  'mosaic-sticky',
  ({ block }) => {
    return {
      type: 'mosaic:sticky',
      content: html`<wb-sticky-tool-button
        .edgeless=${block}
      ></wb-sticky-tool-button>`,
      enable: !block.store.readonly,
      priority: 95,
    };
  }
);
