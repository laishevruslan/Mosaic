import { Bound, clamp } from '@blocksuite/affine/global/gfx';
import { toGfxBlockComponent } from '@blocksuite/affine/std';
import { GfxViewInteractionExtension } from '@blocksuite/affine/std/gfx';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { RecordCardBlockSchema } from './model';
import { RecordCardBlockComponent } from './record-card-block';

export class RecordCardEdgelessBlockComponent extends toGfxBlockComponent(
  RecordCardBlockComponent
) {
  override renderGfxBlock() {
    const bound = Bound.deserialize(this.model.props.xywh$.value);
    const scale = this.model.props.scale$.value;
    const width = bound.w / scale;
    const height = bound.h / scale;

    return html`
      <div
        class="edgeless-wb-record-card"
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
          transformOrigin: '0 0',
          transform: `scale(${scale})`,
        })}
      >
        ${this.renderContent(false)}
      </div>
    `;
  }
}

export const RecordCardBlockInteraction =
  GfxViewInteractionExtension<RecordCardEdgelessBlockComponent>(
    RecordCardBlockSchema.model.flavour,
    {
      resizeConstraint: {
        minWidth: 200,
        minHeight: 96,
        maxWidth: 480,
        maxHeight: 320,
      },
      handleRotate() {
        return {
          beforeRotate(context) {
            context.set({ rotatable: false });
          },
        };
      },
      handleResize({ model }) {
        const initialScale = model.props.scale$.peek();

        return {
          onResizeStart(context) {
            context.default(context);
            model.stash('scale');
          },
          onResizeMove(context) {
            const { newBound, originalBound, lockRatio, constraint } = context;
            const { minWidth, maxWidth, minHeight, maxHeight } = constraint;
            let scale = initialScale;
            const originalRealWidth = originalBound.w / scale;

            if (lockRatio) {
              scale = newBound.w / originalRealWidth;
            }

            const newRealWidth = clamp(newBound.w / scale, minWidth, maxWidth);
            const newRealHeight = clamp(
              newBound.h / scale,
              minHeight,
              maxHeight
            );

            newBound.w = newRealWidth * scale;
            newBound.h = newRealHeight * scale;
            model.props.xywh = newBound.serialize();
            if (scale !== initialScale) {
              model.props.scale = scale;
            }
          },
          onResizeEnd(context) {
            context.default(context);
            model.pop('scale');
          },
        };
      },
    }
  );

declare global {
  interface HTMLElementTagNameMap {
    'wb-record-card-edgeless': RecordCardEdgelessBlockComponent;
  }
}
