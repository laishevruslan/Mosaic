/**
 * WC5 Mosaic template gallery. Recipes are local; Affine edgeless/sticker
 * snapshots stay on EdgelessTemplatePanel (registered by core).
 */

import { MOSAIC_STICKY_HEIGHT, MOSAIC_STICKY_WIDTH } from './sticky-preset';
import { MOSAIC_STICKY_SWATCH_IDS, type MosaicStickySwatchId } from './tokens';

export type MosaicTemplateGroup = 'frames' | 'stickers' | 'widgets';

export type MosaicTemplateId =
  | 'empty-frame'
  | 'retro'
  | 'two-by-two'
  | 'agenda'
  | 'pastel-pack'
  | 'sticky'
  | 'widget-chart'
  | 'widget-board'
  | 'widget-sketch';

export type MosaicTemplateSpec = {
  id: MosaicTemplateId;
  group: MosaicTemplateGroup;
  nameKey: string;
};

export type MosaicTemplateSticky = {
  x: number;
  y: number;
  swatch: MosaicStickySwatchId;
};

export type MosaicTemplateLayout = {
  frame?: { title: string; w: number; h: number };
  stickies: MosaicTemplateSticky[];
  widget?: 'chart' | 'board' | 'sketch';
};

export const MOSAIC_TEMPLATE_GAP = 16;
export const MOSAIC_TEMPLATE_PAD = 24;

export const MOSAIC_TEMPLATES: readonly MosaicTemplateSpec[] = [
  {
    id: 'empty-frame',
    group: 'frames',
    nameKey: 'com.affine.whiteboard.chrome.panel.templates.empty-frame',
  },
  {
    id: 'retro',
    group: 'frames',
    nameKey: 'com.affine.whiteboard.chrome.templates.retro',
  },
  {
    id: 'two-by-two',
    group: 'frames',
    nameKey: 'com.affine.whiteboard.chrome.templates.two-by-two',
  },
  {
    id: 'agenda',
    group: 'frames',
    nameKey: 'com.affine.whiteboard.chrome.templates.agenda',
  },
  {
    id: 'sticky',
    group: 'stickers',
    nameKey: 'com.affine.whiteboard.chrome.panel.templates.sticky',
  },
  {
    id: 'pastel-pack',
    group: 'stickers',
    nameKey: 'com.affine.whiteboard.chrome.templates.pastel-pack',
  },
  {
    id: 'widget-chart',
    group: 'widgets',
    nameKey: 'com.affine.whiteboard.chrome.templates.widget-chart',
  },
  {
    id: 'widget-board',
    group: 'widgets',
    nameKey: 'com.affine.whiteboard.chrome.templates.widget-board',
  },
  {
    id: 'widget-sketch',
    group: 'widgets',
    nameKey: 'com.affine.whiteboard.chrome.templates.widget-sketch',
  },
] as const;

export const MOSAIC_TEMPLATE_GROUPS: readonly MosaicTemplateGroup[] = [
  'frames',
  'stickers',
  'widgets',
];

export function templatesInGroup(
  group: MosaicTemplateGroup
): MosaicTemplateSpec[] {
  return MOSAIC_TEMPLATES.filter(item => item.group === group);
}

function gridStickies(
  columns: number,
  rows: number,
  swatches: readonly MosaicStickySwatchId[]
): {
  stickies: MosaicTemplateSticky[];
  w: number;
  h: number;
} {
  const stickies: MosaicTemplateSticky[] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      stickies.push({
        x:
          MOSAIC_TEMPLATE_PAD +
          col * (MOSAIC_STICKY_WIDTH + MOSAIC_TEMPLATE_GAP),
        y:
          MOSAIC_TEMPLATE_PAD +
          row * (MOSAIC_STICKY_HEIGHT + MOSAIC_TEMPLATE_GAP),
        swatch: swatches[index % swatches.length],
      });
      index += 1;
    }
  }
  const w =
    MOSAIC_TEMPLATE_PAD * 2 +
    columns * MOSAIC_STICKY_WIDTH +
    (columns - 1) * MOSAIC_TEMPLATE_GAP;
  const h =
    MOSAIC_TEMPLATE_PAD * 2 +
    rows * MOSAIC_STICKY_HEIGHT +
    (rows - 1) * MOSAIC_TEMPLATE_GAP;
  return { stickies, w, h };
}

export function mosaicTemplateLayout(
  id: MosaicTemplateId
): MosaicTemplateLayout {
  if (id === 'empty-frame') {
    return {
      frame: { title: 'Frame', w: 480, h: 320 },
      stickies: [],
    };
  }
  if (id === 'sticky') {
    return { stickies: [{ x: 0, y: 0, swatch: 'butter' }] };
  }
  if (id === 'retro') {
    const { stickies, w, h } = gridStickies(3, 1, ['mint', 'peach', 'lilac']);
    return { frame: { title: 'Retro', w, h }, stickies };
  }
  if (id === 'two-by-two') {
    const { stickies, w, h } = gridStickies(2, 2, [
      'butter',
      'peach',
      'blush',
      'mint',
    ]);
    return { frame: { title: '2×2', w, h }, stickies };
  }
  if (id === 'agenda') {
    const { stickies, w, h } = gridStickies(1, 3, ['fog', 'butter', 'lilac']);
    return { frame: { title: 'Agenda', w, h }, stickies };
  }
  if (id === 'pastel-pack') {
    const { stickies, w, h } = gridStickies(3, 2, MOSAIC_STICKY_SWATCH_IDS);
    return { frame: { title: 'Pastels', w, h }, stickies };
  }
  if (id === 'widget-chart') return { stickies: [], widget: 'chart' };
  if (id === 'widget-board') return { stickies: [], widget: 'board' };
  return { stickies: [], widget: 'sketch' };
}
