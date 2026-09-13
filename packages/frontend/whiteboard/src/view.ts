import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine/ext-loader';
import { z } from 'zod';

import { WhiteboardExploreLayerExtension } from './a11y/explore-layer';
import { boardWidget } from './blocks/board';
import { chartWidget } from './blocks/chart';
import { helloWidget } from './blocks/hello';
import { recordCardWidget } from './blocks/record-card';
import { sketchWidget } from './blocks/sketch';
import { boardInspectorWidget } from './chrome/inspector-host';
import { boardPanelWidget } from './chrome/panel-host';
import { stickyQuickTool } from './chrome/sticky-quick-tool';
import { StickyTool } from './chrome/sticky-tool';
import { stickyToolbarExtension } from './chrome/sticky-toolbar';
import { tagChipsWidget } from './chrome/tag-chips-layer';
import { workshopChromeWidget } from './chrome/workshop-chrome';
import { WhiteboardCollabLayerExtension } from './collab/collab-layer';
import { effects } from './effects';
import { WhiteboardL0LayerExtension } from './perf/l0-layer';
import { WhiteboardLayoutHandlerExtensions } from './perf/layout-handler';
import { WhiteboardPerfPolicyExtension } from './perf/policy-extension';
import {
  type WhiteboardReactToLit,
  WhiteboardReactToLitExtension,
} from './react-to-lit';
import {
  collectViewExtensions,
  type GfxWidgetRegistration,
} from './register-gfx-widget';

const optionsSchema = z.object({
  enableHello: z.boolean().optional(),
  enableChart: z.boolean().optional(),
  enableSketch: z.boolean().optional(),
  enableBoard: z.boolean().optional(),
  enablePerfHud: z.boolean().optional(),
  enableL0Layer: z.boolean().optional(),
  enableCollab: z.boolean().optional(),
  enableFacilitation: z.boolean().optional(),
  enableWorkshopChrome: z.boolean().optional(),
  reactToLit: z.custom<WhiteboardReactToLit>().optional(),
});

export type WhiteboardViewOptions = z.infer<typeof optionsSchema>;

export class WhiteboardViewExtension extends ViewExtensionProvider<WhiteboardViewOptions> {
  override name = 'affine-whiteboard-view';

  override schema = optionsSchema;

  override effect() {
    super.effect();
    effects();
  }

  override setup(
    context: ViewExtensionContext,
    options?: WhiteboardViewOptions
  ) {
    super.setup(context, options);

    if (options?.reactToLit) {
      context.register(
        WhiteboardReactToLitExtension(
          options.reactToLit as WhiteboardReactToLit
        )
      );
    }

    const widgets: GfxWidgetRegistration[] = [];
    if (options?.enableHello !== false) {
      widgets.push(helloWidget);
    }
    if (options?.enableChart) {
      widgets.push(chartWidget);
    }
    if (options?.enableSketch) {
      widgets.push(sketchWidget);
    }
    if (options?.enableBoard) {
      widgets.push(boardWidget);
    }
    widgets.push(recordCardWidget);

    const extensions = collectViewExtensions(
      widgets,
      this.isPreview(context.scope),
      this.isEdgeless(context.scope)
    );
    if (this.isEdgeless(context.scope) && !this.isPreview(context.scope)) {
      context.register(WhiteboardLayoutHandlerExtensions);
      context.register(WhiteboardPerfPolicyExtension);
      context.register(WhiteboardExploreLayerExtension);
      if (options?.enableL0Layer) {
        context.register(WhiteboardL0LayerExtension);
      }
      if (options?.enableCollab || options?.enableFacilitation) {
        context.register(WhiteboardCollabLayerExtension);
      }
      if (options?.enableWorkshopChrome) {
        context.register(workshopChromeWidget);
        context.register(StickyTool);
        context.register(stickyQuickTool);
        context.register(stickyToolbarExtension);
        context.register(tagChipsWidget);
        context.register(boardPanelWidget);
        context.register(boardInspectorWidget);
      }
      if (options?.enablePerfHud && typeof document !== 'undefined') {
        queueMicrotask(() => {
          if (!document.querySelector('wb-perf-hud')) {
            document.body.append(document.createElement('wb-perf-hud'));
          }
        });
      }
    }

    if (extensions.length) {
      context.register(extensions);
    }
  }
}
