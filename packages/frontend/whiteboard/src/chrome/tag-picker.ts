import { I18n } from '@affine/i18n';
import type { BlockStdScope } from '@blocksuite/affine/std';
import type { BlockModel } from '@blocksuite/affine/store';
import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';

import {
  nextTagColor,
  readTagIds,
  readWorkspaceTagOptions,
  toggleTagId,
} from './object-tags';

export class MosaicTagPicker extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 280px;
      flex-wrap: wrap;
    }
    button {
      height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      border: 1px solid var(--affine-border-color);
      background: var(--mosaic-paper);
      font-family: var(--mosaic-font-ui);
      font-size: 12px;
      cursor: pointer;
    }
    button[data-active='true'] {
      outline: 2px solid var(--mosaic-accent);
      outline-offset: 1px;
    }
    button:focus-visible {
      outline: 2px solid var(--mosaic-accent);
      outline-offset: 1px;
    }
    input {
      width: 88px;
      height: 24px;
      padding: 0 8px;
      border-radius: 8px;
      border: 1px solid var(--affine-border-color);
      font-family: var(--mosaic-font-ui);
      font-size: 12px;
      background: var(--mosaic-paper);
    }
  `;

  private currentIds() {
    return readTagIds(this.models?.[0]?.props);
  }

  private options() {
    const std = this.std;
    return std ? readWorkspaceTagOptions(std.store.workspace) : [];
  }

  private apply(ids: string[]) {
    const models = this.models;
    const std = this.std;
    if (!models?.length || !std || std.store.readonly) return;
    std.store.captureSync();
    for (const model of models) {
      std.store.updateBlock(model, { tags: ids });
    }
    this.requestUpdate();
  }

  private toggle(id: string) {
    this.apply(toggleTagId(this.currentIds(), id));
  }

  private addFromInput(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value || !this.std) return;
    event.preventDefault();
    const catalog = this.options();
    const existing = catalog.find(
      option => option.value.toLowerCase() === value.toLowerCase()
    );
    const id = existing?.id ?? addWorkspaceTag(this.std, value, catalog.length);
    const ids = this.currentIds();
    this.apply(ids.includes(id) ? ids : [...ids, id]);
    input.value = '';
    this.draft = '';
  }

  override render() {
    const assigned = this.currentIds();
    const catalog = this.options();
    return html`
      ${catalog.map(option => {
        return html`<button
          type="button"
          data-testid="mosaic-tag-option-${option.id}"
          data-active=${String(assigned.includes(option.id))}
          aria-pressed=${String(assigned.includes(option.id))}
          title=${option.value}
          @click=${() => this.toggle(option.id)}
        >
          ${option.value}
        </button>`;
      })}
      <input
        data-testid="mosaic-tag-add"
        aria-label=${I18n['com.affine.whiteboard.chrome.tag.add']()}
        placeholder=${I18n['com.affine.whiteboard.chrome.tag.add']()}
        .value=${this.draft}
        @input=${(e: InputEvent) => {
          this.draft = (e.target as HTMLInputElement).value;
        }}
        @keydown=${(e: KeyboardEvent) => this.addFromInput(e)}
      />
    `;
  }

  @property({ attribute: false })
  accessor models: BlockModel[] | undefined;

  @property({ attribute: false })
  accessor std: BlockStdScope | undefined;

  @state()
  accessor draft = '';
}

export function addWorkspaceTag(
  std: BlockStdScope,
  value: string,
  existingCount: number
): string {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `tag-${Date.now().toString(36)}`;
  const workspace = std.store.workspace;
  const options = [
    ...readWorkspaceTagOptions(workspace),
    { id, value, color: nextTagColor(existingCount) },
  ];
  workspace.meta.setProperties({
    ...workspace.meta.properties,
    tags: { options },
  });
  return id;
}

declare global {
  interface HTMLElementTagNameMap {
    'wb-tag-picker': MosaicTagPicker;
  }
}
