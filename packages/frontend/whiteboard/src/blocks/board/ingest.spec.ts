import { describe, expect, it } from 'vitest';

import {
  flavourToIngestKind,
  hitTestBoardColumn,
  ingestSourceToRow,
  isIngestGesture,
  shouldSkipRecordCardIngest,
} from './ingest';

describe('board canvas ingest', () => {
  it('maps sticky text to a title row', () => {
    expect(
      ingestSourceToRow({
        kind: 'sticky',
        title: '  Ship landing page  ',
        tags: ['idea'],
      })
    ).toEqual({ title: 'Ship landing page', labels: ['idea'] });
    expect(ingestSourceToRow({ kind: 'note', title: '   ' })).toBeNull();
  });

  it('skips a record-card from the same store and copies a foreign one', () => {
    expect(
      shouldSkipRecordCardIngest(
        { kind: 'record-card', title: 'A', databaseId: 'db1', rowId: 'r1' },
        'db1'
      )
    ).toBe(true);
    expect(
      ingestSourceToRow({
        kind: 'record-card',
        title: 'Copied',
        databaseId: 'other',
        cells: { Status: 'todo' },
      })
    ).toEqual({
      title: 'Copied',
      cells: { Status: 'todo' },
      labels: undefined,
    });
  });

  it('hit-tests columns left to right', () => {
    expect(hitTestBoardColumn(10, 300, 3)).toBe(0);
    expect(hitTestBoardColumn(150, 300, 3)).toBe(1);
    expect(hitTestBoardColumn(290, 300, 3)).toBe(2);
    expect(flavourToIngestKind('affine:note', true)).toBe('sticky');
    expect(flavourToIngestKind('wb:record-card')).toBe('record-card');
  });

  it('ignores clicks and accepts a drag onto the widget', () => {
    expect(isIngestGesture({ x: 0, y: 0 }, { x: 4, y: 3 })).toBe(false);
    expect(isIngestGesture({ x: 0, y: 0 }, { x: 20, y: 0 })).toBe(true);
    expect(isIngestGesture(null, { x: 40, y: 40 })).toBe(false);
  });
});
