import type { BoardColumnSeed, BoardLayout, BoardStatusOption } from '../types';

export const BOARD_TEMPLATE_FAMILIES = [
  'basic',
  'multistage',
  'swimlane',
  'portfolio',
  'ritual',
  'integration',
] as const;

export type BoardTemplateFamily = (typeof BOARD_TEMPLATE_FAMILIES)[number];

export const BOARD_TEMPLATE_IDS = [
  'kanban-framework',
  'project-tracking',
  'action-plan',
  'swimlane-by-assignee',
  'swimlane-by-priority',
  'bug-tracker',
  'content-calendar',
  'hiring-pipeline',
  'sales-pipeline',
  'product-backlog',
  'now-next-later',
  'weekly-standup',
  'eisenhower',
  'release-train',
] as const;

export type BoardTemplateId = (typeof BOARD_TEMPLATE_IDS)[number];

export const LEGACY_BOARD_TEMPLATE_ALIASES = {
  todo: 'kanban-framework',
  project: 'project-tracking',
  swimlane: 'swimlane-by-assignee',
} as const;

export type LegacyBoardTemplate = keyof typeof LEGACY_BOARD_TEMPLATE_ALIASES;

export type BoardTemplateKey = BoardTemplateId | LegacyBoardTemplate;

export type BoardSeedCell = string | number;

export type BoardSeedRow = {
  titleKey: string;
  cells?: Record<string, BoardSeedCell>;
};

export type BoardTemplateDef = {
  id: BoardTemplateId;
  family: BoardTemplateFamily;
  titleKey: string;
  descriptionKey: string;
  layout: BoardLayout;
  columns: BoardColumnSeed[];
  groupBy: { x: string; y?: string };
  wipLimits?: Record<string, number>;
  hiddenFields?: string[];
  seedRows: BoardSeedRow[];
  canvasExtras?: 'none' | 'legend' | 'standup-notes';
};

export const PRIORITY_OPTIONS: BoardStatusOption[] = [
  { value: 'High', color: 'var(--affine-tag-red)' },
  { value: 'Medium', color: 'var(--affine-tag-orange)' },
  { value: 'Low', color: 'var(--affine-tag-gray)' },
];

export const DEFAULT_STATUS_TODO: BoardStatusOption[] = [
  { value: 'To do', color: 'var(--affine-tag-orange)' },
  { value: 'In progress', color: 'var(--affine-tag-blue)' },
  { value: 'Done', color: 'var(--affine-tag-green)' },
];

export const DEFAULT_BOARD_FIELDS: BoardColumnSeed[] = [
  { type: 'text', name: 'Description' },
  { type: 'member', name: 'Assignee' },
  { type: 'date', name: 'Start' },
  { type: 'date', name: 'End' },
  { type: 'number', name: 'Estimation' },
  { type: 'select', name: 'Priority', options: PRIORITY_OPTIONS },
];

export function withDefaultFields(
  status: BoardColumnSeed,
  extra: BoardColumnSeed[] = []
): BoardColumnSeed[] {
  const names = new Set<string>([status.name, ...extra.map(column => column.name)]);
  const defaults = DEFAULT_BOARD_FIELDS.filter(column => !names.has(column.name));
  return [status, ...extra, ...defaults];
}
