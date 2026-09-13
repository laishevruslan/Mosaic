import { Bound } from '@blocksuite/affine/global/gfx';
import {
  BookmarkBlockModel,
  EmbedLinkedDocModel,
  FrameBlockModel,
  NoteBlockModel,
  type RootBlockModel,
} from '@blocksuite/affine/model';
import { WidgetComponent, WidgetViewExtension } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { css, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { RecordCardBlockModel } from '../blocks/record-card/model';
import {
  isTaggableFlavour,
  readTagIds,
  readWorkspaceTagOptions,
} from './object-tags';

export const WB_TAG_CHIPS_WIDGET = 'wb-tag-chips-layer';

export class MosaicTagChipsLayer extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: visible;
      z-index: 2;
    }
  `;
  private get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(
      this.gfx.viewport.viewportUpdated.subscribe(() => this.requestUpdate())
    );
    this.disposables.add(
      this.std.store.slots.blockUpdated.subscribe(() => this.requestUpdate())
    );
    this.disposables.add(
      this.std.store.workspace.meta.docMetaUpdated.subscribe(() =>
        this.requestUpdate()
      )
    );
  }

  override render() {
    const options = readWorkspaceTagOptions(this.std.store.workspace);
    const chips = this.std.store.getAllModels().flatMap(model => {
      const sticky = model instanceof NoteBlockModel ? model.isSticky() : false;
      if (!isTaggableFlavour(model.flavour, sticky)) return [];
      if (
        !(
          model instanceof NoteBlockModel ||
          model instanceof FrameBlockModel ||
          model instanceof BookmarkBlockModel ||
          model instanceof EmbedLinkedDocModel ||
          model instanceof RecordCardBlockModel
        )
      ) {
        return [];
      }
      const ids = readTagIds(model.props);
      if (!ids.length) return [];
      const bound = Bound.deserialize(model.xywh);
      const [x, y] = this.gfx.viewport.toViewCoord(bound.x, bound.y);
      return [
        html`<wb-tag-chips
          data-testid="mosaic-tag-chips-anchor"
          style=${styleMap({
            position: 'absolute',
            left: `${x}px`,
            top: `${y - 22}px`,
            transformOrigin: 'left bottom',
            pointerEvents: 'none',
            zIndex: '2',
          })}
          .tagIds=${ids}
          .options=${options}
        ></wb-tag-chips>`,
      ];
    });

    if (!chips.length) return nothing;
    return html`${chips}`;
  }
}

export const tagChipsWidget = WidgetViewExtension(
  'affine:page',
  WB_TAG_CHIPS_WIDGET,
  literal`${unsafeStatic(WB_TAG_CHIPS_WIDGET)}`
);

declare global {
  interface HTMLElementTagNameMap {
    'wb-tag-chips-layer': MosaicTagChipsLayer;
  }
}
