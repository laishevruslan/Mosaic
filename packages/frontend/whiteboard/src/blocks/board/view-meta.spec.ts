import { describe, expect, it } from 'vitest';

import { hiddenFieldColumns, hideGroupProperties, recordsToCsv } from './view-meta';

describe('board view meta', () => {
  it('hides a column without dropping the option', () => {
    const hidden = hideGroupProperties(
      [{ key: 'todo', hide: false, manuallyCardSort: ['r1'] }],
      'done',
      true
    );
    expect(hidden.find(item => item.key === 'todo')?.manuallyCardSort).toEqual([
      'r1',
    ]);
    expect(hidden.find(item => item.key === 'done')?.hide).toBe(true);
  });

  it('toggles card-face fields', () => {
    expect(hiddenFieldColumns([{ id: 'desc' }], 'desc', true)).toEqual([
      { id: 'desc', hide: true },
    ]);
  });

  it('exports titles and status as CSV', () => {
    expect(
      recordsToCsv(
        [
          { title: 'Ship, now', cells: { Status: 'To do' } },
          { title: 'Done', cells: { Status: 'Done' } },
        ],
        ['Status']
      )
    ).toBe('Title,Status\n"Ship, now",To do\nDone,Done');
  });
});
