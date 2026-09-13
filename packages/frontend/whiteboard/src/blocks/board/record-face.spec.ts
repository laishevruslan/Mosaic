import { describe, expect, it } from 'vitest';

import { applyRecordTitle, recordCardFace } from './record-face';

describe('synced record-card face', () => {
  it('shows pending, live, and deleted states', () => {
    expect(
      recordCardFace({ rowExists: false })
    ).toMatchObject({
      pending: true,
      deleted: false,
    });
    expect(
      recordCardFace({ rowId: 'r1', title: 'Hello', rowExists: true })
    ).toEqual({
      title: 'Hello',
      status: undefined,
      deleted: false,
      pending: false,
    });
    expect(
      recordCardFace({ rowId: 'r1', title: 'Gone', rowExists: false })
    ).toMatchObject({ deleted: true, pending: false });
  });

  it('writes a trimmed title back to the row', () => {
    expect(applyRecordTitle('Hello', 'Hello')).toBeUndefined();
    expect(applyRecordTitle('Hello', '  World  ')).toBe('World');
  });
});
