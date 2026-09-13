export type RecordCardFace = {
  title: string;
  status?: string;
  deleted: boolean;
  pending: boolean;
};

export function recordCardFace(input: {
  rowId?: string;
  title?: string;
  status?: string;
  rowExists: boolean;
}): RecordCardFace {
  if (!input.rowId) {
    return { title: '', deleted: false, pending: true };
  }
  if (!input.rowExists) {
    return { title: input.title ?? '', status: input.status, deleted: true, pending: false };
  }
  return {
    title: input.title ?? '',
    status: input.status,
    deleted: false,
    pending: false,
  };
}

export function applyRecordTitle(
  current: string,
  next: string
): string | undefined {
  const trimmed = next.trim();
  if (!trimmed || trimmed === current) return;
  return trimmed;
}
