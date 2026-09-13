import type { DataViewDataType } from '@blocksuite/affine/data-view';

export const BOARD_TEMPLATES = ['todo', 'project', 'swimlane'] as const;

/** Catalog id or a legacy alias (`todo` / `project` / `swimlane`). */
export type BoardTemplate = string;

export type BoardLayout = 'kanban' | 'table' | 'timeline' | 'calendar';

export type BoardSyncMode = 'owned' | 'projection';

/**
 * Whiteboard-owned additions to the kanban view data. `viewDataUpdate` is
 * generic over the view shape, so these can be written without casting.
 */
export type BoardViewData = DataViewDataType & {
  /** Second group-by axis (swimlanes); absent means a plain single-axis board. */
  groupByY?: { columnId: string };
  groupByAxes?: { x?: string; y?: string };
  /** Column option id -> max cards before the WIP limit is highlighted. */
  wipLimits?: Record<string, number>;
  /** Restricts the board to a single swimlane. */
  laneFilter?: string;
  header?: Record<string, unknown> & { coverColumn?: string };
  columns?: Array<{ id: string; hide?: boolean }>;
  groupProperties?: Array<{ key: string; hide?: boolean; manuallyCardSort?: string[] }>;
};

export type BoardStatusOption = {
  value: string;
  color: string;
};

export type BoardColumnSeed = {
  type: string;
  name: string;
  options?: BoardStatusOption[];
};

export const TODO_STATUS_OPTIONS: BoardStatusOption[] = [
  { value: 'To do', color: 'var(--affine-tag-orange)' },
  { value: 'In progress', color: 'var(--affine-tag-blue)' },
  { value: 'Done', color: 'var(--affine-tag-green)' },
];

export const PROJECT_STATUS_OPTIONS: BoardStatusOption[] = [
  { value: 'Backlog', color: 'var(--affine-tag-gray)' },
  { value: 'In progress', color: 'var(--affine-tag-blue)' },
  { value: 'Review', color: 'var(--affine-tag-purple)' },
  { value: 'Done', color: 'var(--affine-tag-green)' },
];
