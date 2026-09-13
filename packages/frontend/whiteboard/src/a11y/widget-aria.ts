import { I18n } from '@affine/i18n';

export type WidgetA11yKind = 'chart' | 'board' | 'sketch';
export type WidgetLodLevel = 'l0' | 'l1' | 'l2';

export function widgetAriaLabel(
  kind: WidgetA11yKind,
  level: WidgetLodLevel,
  title: string
): string {
  return I18n.t(`com.affine.whiteboard.${kind}.a11y.${level}`, { title });
}

export function snapshotAlt(kind: WidgetA11yKind, title: string): string {
  return I18n.t(`com.affine.whiteboard.${kind}.snapshot-alt`, { title });
}

export function applyWidgetAria(
  el: HTMLElement,
  opts: { role: string; label: string }
): void {
  el.setAttribute('role', opts.role);
  el.setAttribute('aria-label', opts.label);
}
