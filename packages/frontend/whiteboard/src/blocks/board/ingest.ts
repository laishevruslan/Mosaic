export type IngestSourceKind =
  | 'note'
  | 'sticky'
  | 'text'
  | 'record-card'
  | 'unknown';

export type IngestSource = {
  kind: IngestSourceKind;
  title: string;
  color?: string;
  tags?: string[];
  cells?: Record<string, unknown>;
  databaseId?: string;
  rowId?: string;
};

export type BoardDropHit = {
  columnId?: string;
  columnIndex: number;
  laneId?: string;
};

/**
 * Map a canvas object onto a new kanban row. Sticky/note/text → Title.
 * Same-store record-card is a no-op (caller skips). Foreign record-card copies cells.
 */
export function ingestSourceToRow(source: IngestSource): {
  title: string;
  labels?: string[];
  cells?: Record<string, unknown>;
} | null {
  const title = source.title.trim();
  if (!title && source.kind !== 'record-card') return null;
  if (source.kind === 'record-card') {
    return {
      title: title || '',
      cells: source.cells,
      labels: source.tags,
    };
  }
  return {
    title,
    labels: source.tags,
  };
}

export function shouldSkipRecordCardIngest(
  source: IngestSource,
  targetDatabaseId: string | undefined
) {
  return (
    source.kind === 'record-card' &&
    !!source.databaseId &&
    source.databaseId === targetDatabaseId
  );
}

/** Column under a point inside the widget, left-to-right. */
export function hitTestBoardColumn(
  localX: number,
  width: number,
  columnCount: number
): number {
  if (columnCount <= 0 || width <= 0) return 0;
  const index = Math.floor((localX / width) * columnCount);
  return Math.min(columnCount - 1, Math.max(0, index));
}

export function hitTestBoardLane(
  localY: number,
  height: number,
  laneCount: number
): number {
  if (laneCount <= 0 || height <= 0) return 0;
  const index = Math.floor((localY / height) * laneCount);
  return Math.min(laneCount - 1, Math.max(0, index));
}

/** True when the pointer moved far enough to count as a canvas drop, not a click. */
export function isIngestGesture(
  start: { x: number; y: number } | null | undefined,
  end: { x: number; y: number },
  minPx = 12
) {
  if (!start) return false;
  return Math.hypot(end.x - start.x, end.y - start.y) >= minPx;
}

export function flavourToIngestKind(flavour: string, sticky?: boolean): IngestSourceKind {
  if (flavour === 'wb:record-card') return 'record-card';
  if (flavour === 'affine:note') return sticky ? 'sticky' : 'note';
  if (flavour === 'affine:edgeless-text' || flavour === 'affine:paragraph') {
    return 'text';
  }
  return 'unknown';
}
