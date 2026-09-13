import { describe, expect, it } from 'vitest';

import { mosaicTemplateLayout, templatesInGroup } from './templates-catalog';

describe('mosaic template catalog', () => {
  it('groups frames, sticker packs, and widget inserts', () => {
    expect(templatesInGroup('frames').map(item => item.id)).toEqual([
      'empty-frame',
      'retro',
      'two-by-two',
      'agenda',
    ]);
    expect(templatesInGroup('stickers').map(item => item.id)).toEqual([
      'sticky',
      'pastel-pack',
    ]);
    expect(templatesInGroup('widgets').map(item => item.id)).toEqual([
      'widget-chart',
      'widget-board',
      'widget-sketch',
    ]);
  });

  it('lays out retro 3-up, 2×2, agenda, and a 6-swatch pastel pack', () => {
    const retro = mosaicTemplateLayout('retro');
    expect(retro.frame?.title).toBe('Retro');
    expect(retro.stickies).toHaveLength(3);

    const matrix = mosaicTemplateLayout('two-by-two');
    expect(matrix.stickies).toHaveLength(4);
    expect(matrix.frame?.w).toBeGreaterThan(400);

    const agenda = mosaicTemplateLayout('agenda');
    expect(agenda.stickies).toHaveLength(3);
    expect(agenda.stickies[2].y).toBeGreaterThan(agenda.stickies[0].y);

    const pack = mosaicTemplateLayout('pastel-pack');
    expect(pack.stickies).toHaveLength(6);
    expect(new Set(pack.stickies.map(item => item.swatch)).size).toBe(6);

    expect(mosaicTemplateLayout('widget-chart').widget).toBe('chart');
  });
});
