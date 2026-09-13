export function hideGroupProperties(
  existing: Array<{ key: string; hide?: boolean; manuallyCardSort?: string[] }> | undefined,
  groupKey: string,
  hide: boolean
) {
  const list = [...(existing ?? [])];
  const index = list.findIndex(item => item.key === groupKey);
  if (index >= 0) {
    list[index] = { ...list[index], hide };
    return list;
  }
  return [...list, { key: groupKey, hide }];
}

export function hiddenFieldColumns(
  existing: Array<{ id: string; hide?: boolean }> | undefined,
  fieldId: string,
  hide: boolean
) {
  const list = [...(existing ?? [])];
  const index = list.findIndex(item => item.id === fieldId);
  if (index >= 0) {
    list[index] = { ...list[index], hide };
    return list;
  }
  return [...list, { id: fieldId, hide }];
}

export function recordsToCsv(
  rows: Array<{ title: string; cells?: Record<string, string> }>,
  columns: string[]
) {
  const header = ['Title', ...columns];
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
    return value;
  };
  const lines = [
    header.map(escape).join(','),
    ...rows.map(row =>
      [row.title, ...columns.map(column => row.cells?.[column] ?? '')]
        .map(escape)
        .join(',')
    ),
  ];
  return lines.join('\n');
}
