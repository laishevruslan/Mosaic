import { I18n } from '@affine/i18n';
import { GfxExtension } from '@blocksuite/affine/std/gfx';

import { isL0HostFlavour, parseXywhRect } from '../perf/l0-scene';
import { nextInReadingOrder, readingOrder, type ExploreItem } from './explore-order';

const STYLE_ID = 'wb-a11y-explore-style';
const STYLE = `
.wb-a11y-live {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function titleOf(model: {
  flavour?: string;
  props?: { title?: { toString?: () => string } | string };
}): string {
  const title = model.props?.title;
  if (typeof title === 'string' && title.trim()) return title;
  if (title && typeof title === 'object' && typeof title.toString === 'function') {
    const text = title.toString().trim();
    if (text) return text;
  }
  return model.flavour ?? 'object';
}

/**
 * Keyboard explore for top-level gfx (plan §5.8).
 * Tab/Shift-Tab always cycle; arrows apply in explore mode or when nothing is selected.
 * Does not patch EdgelessPageKeyboardManager.
 */
export class WhiteboardExploreLayerExtension extends GfxExtension {
  static override key = 'whiteboardExploreLayer';

  private explore = false;
  private live: HTMLDivElement | null = null;
  private mount: Element | null = null;
  private readonly unsubs: Array<() => void> = [];

  private readonly onKeyDown = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) {
      return;
    }
    if (isTypingTarget(event.target)) return;
    const selection = this.gfx.selection as { editing?: boolean; selectedSet: Set<string> };
    if (selection.editing) return;

    if (event.key === 'Escape' && this.explore) {
      this.explore = false;
      event.preventDefault();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.explore = true;
      this.cycle(event.shiftKey ? -1 : 1);
      return;
    }

    const arrows =
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp';
    if (!arrows) return;
    const empty = selection.selectedSet.size === 0;
    if (!this.explore && !empty) return;
    event.preventDefault();
    this.explore = true;
    const dir: 1 | -1 =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    this.cycle(dir);
  };

  override mounted() {
    ensureStyle();
    this.live = document.createElement('div');
    this.live.className = 'wb-a11y-live';
    this.live.dataset.testid = 'wb-a11y-live';
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('aria-atomic', 'true');
    this.mount =
      document.querySelector('.affine-edgeless-viewport') ?? this.std.host;
    this.mount.append(this.live);

    const attach = (element: EventTarget) => {
      element.addEventListener('keydown', this.onKeyDown, true);
    };
    if (this.gfx.viewport.element) {
      attach(this.gfx.viewport.element);
    }
    const ready = this.gfx.viewport.elementReady.subscribe(element => {
      attach(element);
    });
    this.unsubs.push(() => ready.unsubscribe());
  }

  override unmounted() {
    this.gfx.viewport.element?.removeEventListener(
      'keydown',
      this.onKeyDown,
      true
    );
    for (const unsub of this.unsubs.splice(0)) unsub();
    this.live?.remove();
    this.live = null;
    this.mount = null;
    this.explore = false;
  }

  private items(): ExploreItem[] {
    const items: ExploreItem[] = [];
    for (const model of this.gfx.layer.blocks) {
      if (!model.flavour || !isL0HostFlavour(model.flavour)) continue;
      const rect = parseXywhRect(
        (model as { xywh?: string }).xywh ??
          (model as { props?: { xywh?: string } }).props?.xywh
      );
      if (!rect) continue;
      items.push({
        id: model.id,
        x: rect.x,
        y: rect.y,
        flavour: model.flavour,
        title: titleOf(model),
      });
    }
    return items;
  }

  private cycle(dir: 1 | -1) {
    const items = this.items();
    const selected = this.gfx.selection.selectedSet;
    const current = selected.size === 1 ? ([...selected][0] ?? null) : null;
    const ordered = readingOrder(items);
    const next = nextInReadingOrder(ordered, current, dir);
    if (!next) return;
    this.gfx.selection.set({ elements: [next.id], editing: false });
    const index = ordered.findIndex(item => item.id === next.id);
    if (this.live) {
      this.live.textContent = I18n.t(
        'com.affine.whiteboard.a11y.explore.announce',
        {
          title: next.title ?? next.flavour ?? next.id,
          index: String(index + 1),
          total: String(ordered.length),
        }
      );
    }
  }
}
