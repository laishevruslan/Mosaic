import type { BoardColumnSeed, BoardStatusOption } from '../types';
import {
  type BoardTemplateDef,
  type BoardTemplateId,
  type BoardTemplateKey,
  DEFAULT_STATUS_TODO,
  LEGACY_BOARD_TEMPLATE_ALIASES,
  type LegacyBoardTemplate,
  withDefaultFields,
} from './schema';

const PROJECT_STATUS: BoardStatusOption[] = [
  { value: 'Backlog', color: 'var(--affine-tag-gray)' },
  { value: 'In progress', color: 'var(--affine-tag-blue)' },
  { value: 'Review', color: 'var(--affine-tag-purple)' },
  { value: 'Done', color: 'var(--affine-tag-green)' },
];

const ACTION_STATUS: BoardStatusOption[] = [
  { value: 'Not started', color: 'var(--affine-tag-gray)' },
  { value: 'In progress', color: 'var(--affine-tag-blue)' },
  { value: 'Done', color: 'var(--affine-tag-green)' },
];

const BUG_STATUS: BoardStatusOption[] = [
  { value: 'New', color: 'var(--affine-tag-orange)' },
  { value: 'Triaged', color: 'var(--affine-tag-yellow)' },
  { value: 'In fix', color: 'var(--affine-tag-blue)' },
  { value: 'QA', color: 'var(--affine-tag-purple)' },
  { value: 'Closed', color: 'var(--affine-tag-green)' },
];

const CONTENT_STATUS: BoardStatusOption[] = [
  { value: 'Idea', color: 'var(--affine-tag-gray)' },
  { value: 'Writing', color: 'var(--affine-tag-blue)' },
  { value: 'Review', color: 'var(--affine-tag-purple)' },
  { value: 'Scheduled', color: 'var(--affine-tag-teal)' },
  { value: 'Published', color: 'var(--affine-tag-green)' },
];

const HIRING_STATUS: BoardStatusOption[] = [
  { value: 'Applied', color: 'var(--affine-tag-gray)' },
  { value: 'Screen', color: 'var(--affine-tag-blue)' },
  { value: 'Interview', color: 'var(--affine-tag-purple)' },
  { value: 'Offer', color: 'var(--affine-tag-orange)' },
  { value: 'Hired', color: 'var(--affine-tag-green)' },
];

const SALES_STATUS: BoardStatusOption[] = [
  { value: 'Lead', color: 'var(--affine-tag-gray)' },
  { value: 'Qualified', color: 'var(--affine-tag-blue)' },
  { value: 'Proposal', color: 'var(--affine-tag-purple)' },
  { value: 'Negotiation', color: 'var(--affine-tag-orange)' },
  { value: 'Won', color: 'var(--affine-tag-green)' },
  { value: 'Lost', color: 'var(--affine-tag-red)' },
];

const BACKLOG_STATUS: BoardStatusOption[] = [
  { value: 'Icebox', color: 'var(--affine-tag-gray)' },
  { value: 'Ready', color: 'var(--affine-tag-blue)' },
  { value: 'In sprint', color: 'var(--affine-tag-purple)' },
  { value: 'Done', color: 'var(--affine-tag-green)' },
];

const PORTFOLIO_STATUS: BoardStatusOption[] = [
  { value: 'Now', color: 'var(--affine-tag-red)' },
  { value: 'Next', color: 'var(--affine-tag-orange)' },
  { value: 'Later', color: 'var(--affine-tag-gray)' },
];

const STANDUP_STATUS: BoardStatusOption[] = [
  { value: 'Yesterday', color: 'var(--affine-tag-gray)' },
  { value: 'Today', color: 'var(--affine-tag-blue)' },
  { value: 'Blocked', color: 'var(--affine-tag-red)' },
  { value: 'Done', color: 'var(--affine-tag-green)' },
];

const EISENHOWER_STATUS: BoardStatusOption[] = [
  { value: 'Urgent-Important', color: 'var(--affine-tag-red)' },
  { value: 'Urgent-Not important', color: 'var(--affine-tag-orange)' },
  { value: 'Not urgent-Important', color: 'var(--affine-tag-blue)' },
  { value: 'Neither', color: 'var(--affine-tag-gray)' },
];

const SEVERITY: BoardStatusOption[] = [
  { value: 'Critical', color: 'var(--affine-tag-red)' },
  { value: 'Major', color: 'var(--affine-tag-orange)' },
  { value: 'Minor', color: 'var(--affine-tag-yellow)' },
];

const CLASS_OF_SERVICE: BoardStatusOption[] = [
  { value: 'Expedite', color: 'var(--affine-tag-red)' },
  { value: 'Standard', color: 'var(--affine-tag-blue)' },
  { value: 'Intangible', color: 'var(--affine-tag-gray)' },
];

const LABELS: BoardStatusOption[] = [
  { value: 'Bug', color: 'var(--affine-tag-red)' },
  { value: 'Feature', color: 'var(--affine-tag-blue)' },
  { value: 'Docs', color: 'var(--affine-tag-teal)' },
];

function status(options: BoardStatusOption[]): BoardColumnSeed {
  return { type: 'select', name: 'Status', options };
}

function titleKey(id: BoardTemplateId) {
  return `com.affine.whiteboard.board.template.${id}.title`;
}

function descriptionKey(id: BoardTemplateId) {
  return `com.affine.whiteboard.board.template.${id}.description`;
}

function seed(id: string, statusValue: string, extra?: Record<string, string | number>) {
  return {
    titleKey: `com.affine.whiteboard.board.seed.${id}`,
    cells: { Status: statusValue, ...extra },
  };
}

export const BOARD_TEMPLATE_CATALOG: readonly BoardTemplateDef[] = [
  {
    id: 'kanban-framework',
    family: 'basic',
    titleKey: titleKey('kanban-framework'),
    descriptionKey: descriptionKey('kanban-framework'),
    layout: 'kanban',
    columns: withDefaultFields(status(DEFAULT_STATUS_TODO)),
    groupBy: { x: 'Status' },
    wipLimits: { 'In progress': 3 },
    seedRows: [
      seed('task-1', 'To do'),
      seed('task-2', 'In progress'),
      seed('task-3', 'Done'),
    ],
  },
  {
    id: 'project-tracking',
    family: 'multistage',
    titleKey: titleKey('project-tracking'),
    descriptionKey: descriptionKey('project-tracking'),
    layout: 'kanban',
    columns: withDefaultFields(status(PROJECT_STATUS), [
      { type: 'date', name: 'Due' },
      { type: 'multi-select', name: 'Labels', options: LABELS },
      { type: 'image', name: 'Cover' },
      { type: 'number', name: 'Time spent' },
      { type: 'attachment', name: 'Files' },
    ]),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('discovery', 'Backlog'),
      seed('build', 'In progress'),
      seed('review', 'Review'),
      seed('task-1', 'Done'),
    ],
  },
  {
    id: 'action-plan',
    family: 'basic',
    titleKey: titleKey('action-plan'),
    descriptionKey: descriptionKey('action-plan'),
    layout: 'kanban',
    columns: withDefaultFields(status(ACTION_STATUS), [
      { type: 'text', name: 'Goal' },
      { type: 'text', name: 'Metric' },
    ]),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('task-1', 'Not started', { Priority: 'High' }),
      seed('task-2', 'In progress', { Priority: 'Medium' }),
      seed('task-3', 'Done', { Priority: 'Low' }),
    ],
  },
  {
    id: 'swimlane-by-assignee',
    family: 'swimlane',
    titleKey: titleKey('swimlane-by-assignee'),
    descriptionKey: descriptionKey('swimlane-by-assignee'),
    layout: 'kanban',
    columns: withDefaultFields(status(PROJECT_STATUS), [
      { type: 'multi-select', name: 'Labels', options: LABELS },
    ]),
    groupBy: { x: 'Status', y: 'Assignee' },
    wipLimits: { 'In progress': 3 },
    seedRows: [
      seed('discovery', 'Backlog'),
      seed('build', 'In progress'),
      seed('review', 'Review'),
    ],
  },
  {
    id: 'swimlane-by-priority',
    family: 'swimlane',
    titleKey: titleKey('swimlane-by-priority'),
    descriptionKey: descriptionKey('swimlane-by-priority'),
    layout: 'kanban',
    columns: withDefaultFields(status(DEFAULT_STATUS_TODO), [
      { type: 'select', name: 'Class of service', options: CLASS_OF_SERVICE },
    ]),
    groupBy: { x: 'Status', y: 'Class of service' },
    seedRows: [
      seed('task-1', 'To do', { 'Class of service': 'Expedite' }),
      seed('task-2', 'In progress', { 'Class of service': 'Standard' }),
      seed('task-3', 'Done', { 'Class of service': 'Intangible' }),
    ],
  },
  {
    id: 'bug-tracker',
    family: 'multistage',
    titleKey: titleKey('bug-tracker'),
    descriptionKey: descriptionKey('bug-tracker'),
    layout: 'kanban',
    columns: withDefaultFields(status(BUG_STATUS), [
      { type: 'select', name: 'Severity', options: SEVERITY },
      { type: 'text', name: 'Component' },
      { type: 'text', name: 'Repro' },
    ]),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('bug-1', 'New', { Severity: 'Critical' }),
      seed('bug-2', 'Triaged', { Severity: 'Major' }),
      seed('bug-3', 'In fix', { Severity: 'Minor' }),
      seed('bug-4', 'QA'),
    ],
  },
  {
    id: 'content-calendar',
    family: 'multistage',
    titleKey: titleKey('content-calendar'),
    descriptionKey: descriptionKey('content-calendar'),
    layout: 'kanban',
    columns: withDefaultFields(status(CONTENT_STATUS), [
      { type: 'select', name: 'Channel', options: [
        { value: 'Blog', color: 'var(--affine-tag-blue)' },
        { value: 'Social', color: 'var(--affine-tag-purple)' },
        { value: 'Email', color: 'var(--affine-tag-teal)' },
      ] },
      { type: 'text', name: 'Persona' },
      { type: 'date', name: 'Publish date' },
    ]),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('content-1', 'Idea'),
      seed('content-2', 'Writing'),
      seed('content-3', 'Review'),
      seed('content-4', 'Scheduled'),
    ],
  },
  {
    id: 'hiring-pipeline',
    family: 'multistage',
    titleKey: titleKey('hiring-pipeline'),
    descriptionKey: descriptionKey('hiring-pipeline'),
    layout: 'kanban',
    columns: withDefaultFields(status(HIRING_STATUS), [
      { type: 'text', name: 'Role' },
      { type: 'text', name: 'Candidate' },
    ]),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('hire-1', 'Applied'),
      seed('hire-2', 'Screen'),
      seed('hire-3', 'Interview'),
      seed('hire-4', 'Offer'),
    ],
  },
  {
    id: 'sales-pipeline',
    family: 'multistage',
    titleKey: titleKey('sales-pipeline'),
    descriptionKey: descriptionKey('sales-pipeline'),
    layout: 'kanban',
    columns: withDefaultFields(status(SALES_STATUS), [
      { type: 'number', name: 'Amount' },
    ]),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('sale-1', 'Lead', { Amount: 12000 }),
      seed('sale-2', 'Qualified', { Amount: 24000 }),
      seed('sale-3', 'Proposal', { Amount: 48000 }),
      seed('sale-4', 'Negotiation', { Amount: 36000 }),
    ],
  },
  {
    id: 'product-backlog',
    family: 'portfolio',
    titleKey: titleKey('product-backlog'),
    descriptionKey: descriptionKey('product-backlog'),
    layout: 'kanban',
    columns: withDefaultFields(status(BACKLOG_STATUS), [
      { type: 'number', name: 'Effort' },
      { type: 'number', name: 'Value' },
      { type: 'select', name: 'Epic', options: [
        { value: 'Platform', color: 'var(--affine-tag-blue)' },
        { value: 'Growth', color: 'var(--affine-tag-purple)' },
      ] },
    ]),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('backlog-1', 'Icebox'),
      seed('backlog-2', 'Ready'),
      seed('backlog-3', 'In sprint'),
      seed('backlog-4', 'Done'),
    ],
  },
  {
    id: 'now-next-later',
    family: 'portfolio',
    titleKey: titleKey('now-next-later'),
    descriptionKey: descriptionKey('now-next-later'),
    layout: 'kanban',
    columns: withDefaultFields(status(PORTFOLIO_STATUS)),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('now-1', 'Now'),
      seed('next-1', 'Next'),
      seed('later-1', 'Later'),
    ],
  },
  {
    id: 'weekly-standup',
    family: 'ritual',
    titleKey: titleKey('weekly-standup'),
    descriptionKey: descriptionKey('weekly-standup'),
    layout: 'kanban',
    columns: withDefaultFields(status(STANDUP_STATUS)),
    groupBy: { x: 'Status', y: 'Assignee' },
    canvasExtras: 'standup-notes',
    seedRows: [
      seed('standup-1', 'Yesterday'),
      seed('standup-2', 'Today'),
      seed('standup-3', 'Blocked'),
      seed('standup-4', 'Done'),
    ],
  },
  {
    id: 'eisenhower',
    family: 'basic',
    titleKey: titleKey('eisenhower'),
    descriptionKey: descriptionKey('eisenhower'),
    layout: 'kanban',
    columns: withDefaultFields(status(EISENHOWER_STATUS)),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('eisen-1', 'Urgent-Important'),
      seed('eisen-2', 'Urgent-Not important'),
      seed('eisen-3', 'Not urgent-Important'),
      seed('eisen-4', 'Neither'),
    ],
  },
  {
    id: 'release-train',
    family: 'portfolio',
    titleKey: titleKey('release-train'),
    descriptionKey: descriptionKey('release-train'),
    // Timeline lands in E4; v1 is a Now/Next/Later kanban.
    layout: 'kanban',
    columns: withDefaultFields(status(PORTFOLIO_STATUS)),
    groupBy: { x: 'Status' },
    seedRows: [
      seed('release-1', 'Now'),
      seed('release-2', 'Next'),
      seed('release-3', 'Later'),
    ],
  },
];

const BY_ID = new Map(BOARD_TEMPLATE_CATALOG.map(item => [item.id, item]));

export function resolveBoardTemplateId(value: string | undefined): BoardTemplateId {
  if (value && value in LEGACY_BOARD_TEMPLATE_ALIASES) {
    return LEGACY_BOARD_TEMPLATE_ALIASES[value as LegacyBoardTemplate];
  }
  if (value && BY_ID.has(value as BoardTemplateId)) {
    return value as BoardTemplateId;
  }
  return 'kanban-framework';
}

export function boardTemplateDef(
  value: BoardTemplateKey | string | undefined
): BoardTemplateDef {
  const resolved = BY_ID.get(resolveBoardTemplateId(value));
  if (resolved) return resolved;
  const fallback = BY_ID.get('kanban-framework');
  if (fallback) return fallback;
  throw new Error('board template catalog is empty');
}

export function columnsForTemplate(template: BoardTemplateKey | string | undefined) {
  return boardTemplateDef(template).columns;
}

export function isBoardTemplate(value: unknown): value is BoardTemplateKey {
  return (
    typeof value === 'string' &&
    (value in LEGACY_BOARD_TEMPLATE_ALIASES || BY_ID.has(value as BoardTemplateId))
  );
}

export function quickBoardTemplates(): BoardTemplateDef[] {
  return [
    boardTemplateDef('kanban-framework'),
    boardTemplateDef('project-tracking'),
    boardTemplateDef('swimlane-by-assignee'),
  ];
}
