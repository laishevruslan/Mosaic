import { describe, expect, it } from 'vitest';

import { mapClonedCellValue } from './clone-cells';

describe('clone board cells', () => {
  it('remaps select option ids by value', () => {
    expect(
      mapClonedCellValue({
        srcType: 'select',
        destType: 'select',
        value: 'src-todo',
        srcOptions: [{ id: 'src-todo', value: 'To do' }],
        destOptions: [{ id: 'dst-todo', value: 'To do' }],
      })
    ).toBe('dst-todo');
  });

  it('copies number and text values as-is', () => {
    expect(
      mapClonedCellValue({
        srcType: 'number',
        destType: 'number',
        value: 8,
      })
    ).toBe(8);
    expect(
      mapClonedCellValue({
        srcType: 'text',
        destType: 'text',
        value: 'Hello',
      })
    ).toBe('Hello');
  });
});
