export type CloneSelectOption = { id: string; value: string };

/**
 * Select cells store option ids. Map by label so a cloned schema with new
 * ids still keeps the same status/priority.
 */
export function mapClonedCellValue(input: {
  srcType?: string;
  destType?: string;
  value: unknown;
  srcOptions?: CloneSelectOption[];
  destOptions?: CloneSelectOption[];
}): unknown {
  if (input.value == null) return;
  if (
    input.srcType === 'select' &&
    input.destType === 'select' &&
    typeof input.value === 'string'
  ) {
    const src = input.srcOptions?.find(option => option.id === input.value);
    if (!src) return;
    return input.destOptions?.find(option => option.value === src.value)?.id;
  }
  return input.value;
}
