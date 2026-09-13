import type { DomRenderer } from '@blocksuite/affine-block-surface';
import { DomElementRendererExtension } from '@blocksuite/affine-block-surface';
import { DefaultTheme, type TextElementModel } from '@blocksuite/affine-model';

import { getFontString } from './utils.js';

export const textDomRenderer = (
  model: TextElementModel,
  element: HTMLElement,
  renderer: DomRenderer
) => {
  const { zoom } = renderer.viewport;
  const [, , w, h] = model.deserializedXYWH;
  const color = renderer.getColorValue(
    model.color,
    DefaultTheme.textColor,
    true
  );
  const font = getFontString({
    fontStyle: model.fontStyle,
    fontWeight: model.fontWeight,
    fontSize: model.fontSize * zoom,
    fontFamily: model.fontFamily,
  });

  element.style.width = `${Math.max(1, w * zoom)}px`;
  element.style.height = `${Math.max(1, h * zoom)}px`;
  element.style.font = font;
  element.style.color = color;
  element.style.textAlign = model.textAlign;
  element.style.whiteSpace = 'pre-wrap';
  element.style.overflow = 'hidden';
  element.style.pointerEvents = 'none';
  element.style.lineHeight = '1.2';
  element.style.transformOrigin = 'center center';
  element.style.transform = model.rotate ? `rotate(${model.rotate}deg)` : '';

  const next = model.text.toString();
  if (element.textContent !== next) {
    element.textContent = next;
  }
};

export const TextDomRendererExtension = DomElementRendererExtension(
  'text',
  textDomRenderer
);
