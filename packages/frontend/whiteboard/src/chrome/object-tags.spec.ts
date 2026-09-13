import { describe, expect, it } from 'vitest';

import { WHITEBOARD_FLAVOURS } from '../const';
import {
  chipOverflow,
  isTaggableFlavour,
  MOSAIC_TAG_CHIP_MAX,
  MOSAIC_TAG_COLORS,
  MOSAIC_TAGGABLE_FLAVOURS,
  nextTagColor,
  readTagIds,
  readWorkspaceTagOptions,
  resolveTagOption,
  toggleTagId,
} from './object-tags';

const FORBIDDEN = [
  '#4262ff',
  '#ffd02f',
  '#ff9999',
  'roobert',
  'mirotone',
  '@mirohq',
] as const;

describe('mosaic object tags', () => {
  it('reads string ids and toggles without duplicates in overflow', () => {
    expect(readTagIds({ tags: ['a', 'b', ''] })).toEqual(['a', 'b']);
    expect(readTagIds({})).toEqual([]);
    expect(toggleTagId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleTagId(['a', 'b'], 'a')).toEqual(['b']);
    expect(chipOverflow(['a', 'b', 'c', 'd']).shown).toHaveLength(
      MOSAIC_TAG_CHIP_MAX
    );
    expect(chipOverflow(['a', 'b', 'c', 'd']).extra).toBe(1);
  });

  it('resolves workspace catalog options and Affine tag colors', () => {
    expect(
      readWorkspaceTagOptions({
        meta: {
          properties: {
            tags: {
              options: [
                { id: '1', value: 'Idea', color: MOSAIC_TAG_COLORS[0] },
              ],
            },
          },
        },
      })
    ).toEqual([{ id: '1', value: 'Idea', color: MOSAIC_TAG_COLORS[0] }]);
    expect(
      resolveTagOption('1', [{ id: '1', value: 'Idea', color: 'x' }]).value
    ).toBe('Idea');
    expect(nextTagColor(0)).toBe(MOSAIC_TAG_COLORS[0]);
    expect(isTaggableFlavour('affine:note', true)).toBe(true);
    expect(isTaggableFlavour('affine:note', false)).toBe(false);
    expect(isTaggableFlavour('affine:frame')).toBe(true);
    expect(MOSAIC_TAGGABLE_FLAVOURS).toContain(WHITEBOARD_FLAVOURS.recordCard);
  });

  it('does not use competing-product tokens', () => {
    const blob = JSON.stringify({ MOSAIC_TAG_COLORS }).toLowerCase();
    for (const token of FORBIDDEN) {
      expect(blob).not.toContain(token);
    }
  });
});
