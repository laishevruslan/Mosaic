import { I18n } from '@affine/i18n';
import { DatabaseBlockDataSource } from '@blocksuite/affine/blocks/database';
import {
  type DatabaseBlockModel,
  NoteDisplayMode,
} from '@blocksuite/affine/model';
import { nanoid, type Store, Text } from '@blocksuite/affine/store';

import { mapClonedCellValue } from './clone-cells';
import {
  BOARD_CHECKLIST_COLUMN,
  isChecklistItem,
  nextChecklistCell,
} from './semantics';
import { boardTemplateDef } from './templates';
import type { BoardTemplateDef } from './templates/schema';
import {
  type BoardColumnSeed,
  type BoardLayout,
  type BoardStatusOption,
  type BoardTemplate,
  type BoardViewData,
} from './types';
import { hiddenFieldColumns,hideGroupProperties } from './view-meta';

export const BOARD_HUB_NOTE_FLAG = 'wb-board-data-hub';

export type CreatedBoardDatabase = {
  noteId: string;
  databaseId: string;
  viewId?: string;
  tableViewId?: string;
};

type SelectOption = {
  id: string;
  value: string;
  color: string;
};

function localizeColumnName(name: string): string {
  const key = COLUMN_I18N[name];
  return key ? I18n[key]() : name;
}

const COLUMN_I18N: Record<string, string> = {
  Status: 'com.affine.whiteboard.board.column.status',
  Assignee: 'com.affine.whiteboard.board.column.assignee',
  Due: 'com.affine.whiteboard.board.column.due',
  Labels: 'com.affine.whiteboard.board.column.labels',
  Cover: 'com.affine.whiteboard.board.column.cover',
  'Time spent': 'com.affine.whiteboard.board.column.time-spent',
  Started: 'com.affine.whiteboard.board.column.started',
  Start: 'com.affine.whiteboard.board.column.start',
  End: 'com.affine.whiteboard.board.column.end',
  Files: 'com.affine.whiteboard.board.column.files',
  Description: 'com.affine.whiteboard.board.column.description',
  Estimation: 'com.affine.whiteboard.board.column.estimation',
  Priority: 'com.affine.whiteboard.board.column.priority',
  Goal: 'com.affine.whiteboard.board.column.goal',
  Metric: 'com.affine.whiteboard.board.column.metric',
  Severity: 'com.affine.whiteboard.board.column.severity',
  Component: 'com.affine.whiteboard.board.column.component',
  Repro: 'com.affine.whiteboard.board.column.repro',
  Channel: 'com.affine.whiteboard.board.column.channel',
  Persona: 'com.affine.whiteboard.board.column.persona',
  'Publish date': 'com.affine.whiteboard.board.column.publish-date',
  Role: 'com.affine.whiteboard.board.column.role',
  Candidate: 'com.affine.whiteboard.board.column.candidate',
  Amount: 'com.affine.whiteboard.board.column.amount',
  Effort: 'com.affine.whiteboard.board.column.effort',
  Value: 'com.affine.whiteboard.board.column.value',
  Epic: 'com.affine.whiteboard.board.column.epic',
  'Class of service': 'com.affine.whiteboard.board.column.class-of-service',
};

function localizeOptionValue(value: string): string {
  const key = OPTION_I18N[value];
  return key ? I18n[key]() : value;
}

const OPTION_I18N: Record<string, string> = {
  'To do': 'com.affine.whiteboard.board.status.todo',
  'In progress': 'com.affine.whiteboard.board.status.in-progress',
  Done: 'com.affine.whiteboard.board.status.done',
  Backlog: 'com.affine.whiteboard.board.status.backlog',
  Review: 'com.affine.whiteboard.board.status.review',
  'Not started': 'com.affine.whiteboard.board.status.not-started',
  New: 'com.affine.whiteboard.board.status.new',
  Triaged: 'com.affine.whiteboard.board.status.triaged',
  'In fix': 'com.affine.whiteboard.board.status.in-fix',
  QA: 'com.affine.whiteboard.board.status.qa',
  Closed: 'com.affine.whiteboard.board.status.closed',
  Idea: 'com.affine.whiteboard.board.status.idea',
  Writing: 'com.affine.whiteboard.board.status.writing',
  Scheduled: 'com.affine.whiteboard.board.status.scheduled',
  Published: 'com.affine.whiteboard.board.status.published',
  Applied: 'com.affine.whiteboard.board.status.applied',
  Screen: 'com.affine.whiteboard.board.status.screen',
  Interview: 'com.affine.whiteboard.board.status.interview',
  Offer: 'com.affine.whiteboard.board.status.offer',
  Hired: 'com.affine.whiteboard.board.status.hired',
  Lead: 'com.affine.whiteboard.board.status.lead',
  Qualified: 'com.affine.whiteboard.board.status.qualified',
  Proposal: 'com.affine.whiteboard.board.status.proposal',
  Negotiation: 'com.affine.whiteboard.board.status.negotiation',
  Won: 'com.affine.whiteboard.board.status.won',
  Lost: 'com.affine.whiteboard.board.status.lost',
  Icebox: 'com.affine.whiteboard.board.status.icebox',
  Ready: 'com.affine.whiteboard.board.status.ready',
  'In sprint': 'com.affine.whiteboard.board.status.in-sprint',
  Now: 'com.affine.whiteboard.board.status.now',
  Next: 'com.affine.whiteboard.board.status.next',
  Later: 'com.affine.whiteboard.board.status.later',
  Yesterday: 'com.affine.whiteboard.board.status.yesterday',
  Today: 'com.affine.whiteboard.board.status.today',
  Blocked: 'com.affine.whiteboard.board.status.blocked',
  'Urgent-Important': 'com.affine.whiteboard.board.status.urgent-important',
  'Urgent-Not important':
    'com.affine.whiteboard.board.status.urgent-not-important',
  'Not urgent-Important':
    'com.affine.whiteboard.board.status.not-urgent-important',
  Neither: 'com.affine.whiteboard.board.status.neither',
  Bug: 'com.affine.whiteboard.board.label.bug',
  Feature: 'com.affine.whiteboard.board.label.feature',
  Docs: 'com.affine.whiteboard.board.label.docs',
  High: 'com.affine.whiteboard.board.priority.high',
  Medium: 'com.affine.whiteboard.board.priority.medium',
  Low: 'com.affine.whiteboard.board.priority.low',
  Critical: 'com.affine.whiteboard.board.severity.critical',
  Major: 'com.affine.whiteboard.board.severity.major',
  Minor: 'com.affine.whiteboard.board.severity.minor',
  Expedite: 'com.affine.whiteboard.board.class.expedite',
  Standard: 'com.affine.whiteboard.board.class.standard',
  Intangible: 'com.affine.whiteboard.board.class.intangible',
  Blog: 'com.affine.whiteboard.board.channel.blog',
  Social: 'com.affine.whiteboard.board.channel.social',
  Email: 'com.affine.whiteboard.board.channel.email',
  Platform: 'com.affine.whiteboard.board.epic.platform',
  Growth: 'com.affine.whiteboard.board.epic.growth',
};

function addSelectOptions(
  datasource: DatabaseBlockDataSource,
  propertyId: string,
  options: BoardStatusOption[]
) {
  if (!options.length) return;
  datasource.propertyDataSet(propertyId, {
    options: options.map(option => ({
      id: nanoid(),
      value: localizeOptionValue(option.value),
      color: option.color,
    })),
  });
}

function seedColumns(
  datasource: DatabaseBlockDataSource,
  columns: BoardColumnSeed[]
) {
  for (const column of columns) {
    const id = datasource.propertyAdd('end', {
      type: column.type,
      name: localizeColumnName(column.name),
    });
    if (id && column.options) {
      addSelectOptions(datasource, id, column.options);
    }
  }
}

function firstPropertyOfType(
  datasource: DatabaseBlockDataSource,
  type: string
) {
  return datasource.properties$.value.find(
    id => datasource.propertyTypeGet(id) === type
  );
}

function selectOptions(
  datasource: DatabaseBlockDataSource,
  propertyId: string
): SelectOption[] {
  const data = datasource.propertyDataGet(propertyId) as {
    options?: SelectOption[];
  };
  return data.options ?? [];
}

function seedChecklist(store: Store, rowId: string) {
  store.addBlock(
    'affine:list',
    {
      type: 'todo',
      text: new Text(I18n['com.affine.whiteboard.board.seed.checklist']()),
      checked: false,
    },
    rowId
  );
}

function propertyByEnglishName(
  datasource: DatabaseBlockDataSource,
  englishName: string
) {
  const localized = localizeColumnName(englishName);
  return datasource.properties$.value.find(id => {
    return datasource.propertyNameGet(id) === localized;
  });
}

function optionByEnglishValue(
  datasource: DatabaseBlockDataSource,
  propertyId: string,
  english: string
) {
  const localized = localizeOptionValue(english).toLowerCase();
  return selectOptions(datasource, propertyId).find(
    option => option.value.toLowerCase() === localized
  );
}

function seedTemplateRows(
  store: Store,
  datasource: DatabaseBlockDataSource,
  def: BoardTemplateDef
) {
  const withChecklist = def.id !== 'kanban-framework';
  for (const row of def.seedRows) {
    const rowId = datasource.rowAdd('end');
    const model = store.getBlock(rowId)?.model;
    const text = (model?.props as { text?: Text } | undefined)?.text;
    const title = I18n[row.titleKey]();
    if (text && title) {
      text.insert(title, 0);
    }
    for (const [field, value] of Object.entries(row.cells ?? {})) {
      const propertyId = propertyByEnglishName(datasource, field);
      if (!propertyId) continue;
      const type = datasource.propertyTypeGet(propertyId);
      if (type === 'select' && typeof value === 'string') {
        const option = optionByEnglishValue(datasource, propertyId, value);
        if (option) datasource.cellValueChange(rowId, propertyId, option.id);
      } else if (type === 'number' && typeof value === 'number') {
        datasource.cellValueChange(rowId, propertyId, value);
      } else if (typeof value === 'string') {
        datasource.cellValueChange(rowId, propertyId, value);
      }
    }
    if (withChecklist) {
      seedChecklist(store, rowId);
    }
  }
}

function applyBoardSemantics(
  datasource: DatabaseBlockDataSource,
  viewId: string | undefined,
  def: BoardTemplateDef
) {
  if (!viewId) return;
  const xId = propertyByEnglishName(datasource, def.groupBy.x);
  const yId = def.groupBy.y
    ? propertyByEnglishName(datasource, def.groupBy.y)
    : undefined;
  const wipLimits: Record<string, number> = {};
  if (def.wipLimits && xId) {
    for (const [name, limit] of Object.entries(def.wipLimits)) {
      const option = optionByEnglishValue(datasource, xId, name);
      if (option) wipLimits[option.id] = limit;
    }
  }

  datasource.viewDataUpdate<BoardViewData>(viewId, () => ({
    groupByY: yId ? { columnId: yId } : undefined,
    groupByAxes: {
      x: xId,
      y: yId,
    },
    wipLimits,
  }));
}

function applyCoverColumn(
  datasource: DatabaseBlockDataSource,
  viewId: string | undefined
) {
  const coverId = firstPropertyOfType(datasource, 'image');
  if (!coverId || !viewId) return;
  datasource.viewDataUpdate<BoardViewData>(viewId, old => ({
    header: { ...old.header, coverColumn: coverId },
  }));
}

function asDatabase(
  model: { flavour: string } | undefined
): DatabaseBlockModel | undefined {
  if (!model || model.flavour !== 'affine:database') return;
  return model as DatabaseBlockModel;
}

export function findViewId(
  datasource: DatabaseBlockDataSource,
  type: string
) {
  return datasource.viewManager.views$.value.find(id => {
    return datasource.viewManager.viewGet(id)?.type === type;
  });
}

export function findKanbanViewId(datasource: DatabaseBlockDataSource) {
  return findViewId(datasource, 'kanban');
}

export function findTableViewId(datasource: DatabaseBlockDataSource) {
  return findViewId(datasource, 'table');
}

export function ensureKanbanView(store: Store, databaseId: string) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const existing = findKanbanViewId(datasource);
  if (existing) {
    datasource.viewManager.setCurrentView(existing);
    return existing;
  }
  try {
    return datasource.viewManager.viewAdd('kanban');
  } catch {
    return;
  }
}

export function ensureTableView(store: Store, databaseId: string) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const existing = findTableViewId(datasource);
  if (existing) {
    datasource.viewManager.setCurrentView(existing);
    return existing;
  }
  try {
    return datasource.viewManager.viewAdd('table');
  } catch {
    return;
  }
}

function addView(
  datasource: DatabaseBlockDataSource,
  type: 'kanban' | 'table'
) {
  try {
    return datasource.viewManager.viewAdd(type);
  } catch {
    return;
  }
}

export function createBoardDatabase(
  store: Store,
  options: {
    title: string;
    template: BoardTemplate;
  }
): CreatedBoardDatabase | undefined {
  const root = store.root;
  if (!root) return;

  const def = boardTemplateDef(options.template);
  store.captureSync();

  const noteId = store.addBlock(
    'affine:note',
    {
      displayMode: NoteDisplayMode.DocOnly,
      xywh: '[0,0,0,0]',
      comments: { [BOARD_HUB_NOTE_FLAG]: true },
    },
    root
  );

  const databaseId = store.addBlock(
    'affine:database',
    {
      title: new Text(options.title),
      columns: [],
      cells: {},
    },
    noteId
  );

  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) {
    return { noteId, databaseId };
  }

  const datasource = new DatabaseBlockDataSource(database);
  seedColumns(datasource, def.columns);

  const viewId = addView(datasource, 'kanban');
  const tableViewId = addView(datasource, 'table');
  applyCoverColumn(datasource, viewId);
  applyBoardSemantics(datasource, viewId, def);
  if (viewId) {
    datasource.viewManager.setCurrentView(viewId);
  }
  seedTemplateRows(store, datasource, def);

  return { noteId, databaseId, viewId, tableViewId };
}

export function setBoardLayout(
  store: Store,
  databaseId: string,
  layout: BoardLayout
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const type = layout === 'table' ? 'table' : 'kanban';
  const existing = findViewId(datasource, type);
  const viewId = existing ?? addView(datasource, type);
  if (viewId) datasource.viewManager.setCurrentView(viewId);
  return viewId;
}

export function hideBoardGroup(
  store: Store,
  databaseId: string,
  groupKey: string,
  hide: boolean
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const viewId = findKanbanViewId(datasource);
  if (!viewId) return;
  store.captureSync();
  datasource.viewDataUpdate<BoardViewData>(viewId, old => ({
    groupProperties: hideGroupProperties(old.groupProperties, groupKey, hide),
  }));
}

export function hideBoardField(
  store: Store,
  databaseId: string,
  fieldId: string,
  hide: boolean
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const viewId = findKanbanViewId(datasource);
  if (!viewId) return;
  store.captureSync();
  datasource.viewDataUpdate<BoardViewData>(viewId, old => ({
    columns: hiddenFieldColumns(old.columns, fieldId, hide),
  }));
}

export function ingestRowTitle(
  store: Store,
  databaseId: string,
  title: string,
  patch?: {
    xPropertyId?: string;
    xValue?: string;
    labels?: string[];
    cells?: Record<string, unknown>;
  }
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database || !title.trim()) return;
  store.captureSync();
  const datasource = new DatabaseBlockDataSource(database);
  const rowId = datasource.rowAdd('end');
  const model = store.getBlock(rowId)?.model;
  const text = (model?.props as { text?: Text } | undefined)?.text;
  if (text) text.insert(title.trim(), 0);
  if (patch?.xPropertyId && patch.xValue) {
    datasource.cellValueChange(rowId, patch.xPropertyId, patch.xValue);
  }
  if (patch?.labels?.length) {
    const labelsId = propertyByEnglishName(datasource, 'Labels');
    if (labelsId) {
      datasource.cellValueChange(rowId, labelsId, patch.labels);
    }
  }
  for (const [field, value] of Object.entries(patch?.cells ?? {})) {
    const propertyId = propertyByEnglishName(datasource, field);
    if (!propertyId || value == null) continue;
    datasource.cellValueChange(rowId, propertyId, value);
  }
  return rowId;
}

export function applyCardMove(
  store: Store,
  databaseId: string,
  rowId: string,
  patch: {
    xPropertyId: string;
    xValue: string;
    yPropertyId?: string;
    yValue?: string;
    yIsMember?: boolean;
  }
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  store.captureSync();
  const datasource = new DatabaseBlockDataSource(database);
  datasource.cellValueChange(rowId, patch.xPropertyId, patch.xValue || null);
  if (patch.yPropertyId) {
    datasource.cellValueChange(
      rowId,
      patch.yPropertyId,
      patch.yIsMember
        ? patch.yValue
          ? [patch.yValue]
          : []
        : patch.yValue || null
    );
  }
}

export function applyViewMeta(
  store: Store,
  databaseId: string,
  patch: {
    groupByAxes?: { x?: string; y?: string };
    wipLimits?: Record<string, number>;
    laneFilter?: string;
  }
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const viewId = findKanbanViewId(datasource);
  if (!viewId) return;
  store.captureSync();
  datasource.viewDataUpdate<BoardViewData>(viewId, old => ({
    ...patch,
    groupByY: patch.groupByAxes
      ? patch.groupByAxes.y
        ? { columnId: patch.groupByAxes.y }
        : undefined
      : old.groupByY,
  }));
}

export function applyTimeLog(
  store: Store,
  databaseId: string,
  rowId: string,
  minutes: number
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const timeId = firstPropertyOfType(datasource, 'number');
  if (!timeId) return;
  store.captureSync();
  const current = Number(datasource.cellValueGet(rowId, timeId));
  const next = (Number.isFinite(current) ? current : 0) + minutes;
  datasource.cellValueChange(rowId, timeId, next);
}

export function applyTimelineDates(
  store: Store,
  databaseId: string,
  rowId: string,
  startAt: string,
  endAt: string
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const startId =
    propertyByEnglishName(datasource, 'Start') ??
    firstPropertyOfType(datasource, 'date');
  const endId =
    propertyByEnglishName(datasource, 'End') ??
    propertyByEnglishName(datasource, 'Due') ??
    startId;
  if (!startId && !endId) return;
  store.captureSync();
  if (startId) datasource.cellValueChange(rowId, startId, startAt);
  if (endId) datasource.cellValueChange(rowId, endId, endAt);
}

function checklistItems(store: Store, rowId: string) {
  return (store.getBlock(rowId)?.model.children ?? []).filter(child => {
    const props = child.props as { type?: string; checked?: boolean };
    return isChecklistItem({
      flavour: child.flavour,
      type: props.type,
      checked: props.checked,
    });
  });
}

/**
 * Child `affine:list` blocks stay the source of truth where a card has them;
 * cards seeded with a `Checklist` cell fall back to the serialized value.
 */
export function applyChecklistToggle(
  store: Store,
  databaseId: string,
  rowId: string,
  index: number
) {
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;

  const item = checklistItems(store, rowId)[index];
  if (item) {
    const checked = (item.props as { checked?: boolean }).checked;
    store.captureSync();
    store.updateBlock(item, { checked: !checked });
    return;
  }

  const columnId = database.props.columns.find(
    column => column.name === BOARD_CHECKLIST_COLUMN
  )?.id;
  if (!columnId) return;
  const datasource = new DatabaseBlockDataSource(database);
  const next = nextChecklistCell(
    datasource.cellValueGet(rowId, columnId),
    index
  );
  if (next == null) return;
  store.captureSync();
  datasource.cellValueChange(rowId, columnId, next);
}

export function findNearbyDatabaseId(
  store: Store,
  modelId: string
): string | undefined {
  const model = store.getBlock(modelId)?.model;
  if (!model) return store.getModelsByFlavour('affine:database')[0]?.id;
  if (model.flavour === 'affine:database') return model.id;
  const parent = store.getParent(model);
  if (parent?.flavour === 'affine:database') return parent.id;
  return store.getModelsByFlavour('affine:database')[0]?.id;
}

export function resolveBoardDatabase(
  store: Store,
  blockId?: string,
  linkedDocId?: string
) {
  if (linkedDocId && linkedDocId !== store.id) {
    const doc = store.workspace.getDoc(linkedDocId);
    const linked = doc?.getStore({ id: linkedDocId }) ?? store;
    return linked.getBlock(blockId ?? '')?.model;
  }
  if (!blockId) return;
  return store.getBlock(blockId)?.model;
}

export function createProjectionView(
  store: Store,
  databaseId: string,
  layout: BoardLayout = 'kanban'
) {
  const type = layout === 'table' ? 'table' : 'kanban';
  const database = asDatabase(store.getBlock(databaseId)?.model);
  if (!database) return;
  const datasource = new DatabaseBlockDataSource(database);
  const viewId = addView(datasource, type);
  if (viewId) datasource.viewManager.setCurrentView(viewId);
  return viewId;
}

function copyDatabaseRecords(
  store: Store,
  source: DatabaseBlockModel,
  dest: DatabaseBlockModel
) {
  const srcDs = new DatabaseBlockDataSource(source);
  const destDs = new DatabaseBlockDataSource(dest);
  for (const child of Array.from(dest.children)) {
    store.deleteBlock(child);
  }
  for (const row of source.children) {
    const newId = destDs.rowAdd('end');
    const title = recordRowTitle(store, row.id);
    if (title) {
      const text = (store.getBlock(newId)?.model?.props as { text?: Text } | undefined)
        ?.text;
      if (text) text.insert(title, 0);
    }
    for (const column of source.props.columns) {
      const destColumn = dest.props.columns.find(
        item => item.name === column.name
      );
      if (!destColumn) continue;
      const mapped = mapClonedCellValue({
        srcType: srcDs.propertyTypeGet(column.id),
        destType: destDs.propertyTypeGet(destColumn.id),
        value: srcDs.cellValueGet(row.id, column.id),
        srcOptions: selectOptions(srcDs, column.id),
        destOptions: selectOptions(destDs, destColumn.id),
      });
      if (mapped != null) {
        destDs.cellValueChange(newId, destColumn.id, mapped);
      }
    }
    for (const child of row.children) {
      if (child.flavour !== 'affine:list') continue;
      const props = child.props as {
        type?: string;
        checked?: boolean;
        text?: { toString?: () => string };
      };
      store.addBlock(
        'affine:list',
        {
          type: props.type ?? 'todo',
          text: new Text(props.text?.toString?.() ?? ''),
          checked: !!props.checked,
        },
        newId
      );
    }
  }
}

export function cloneBoardDatabase(
  store: Store,
  sourceDatabaseId: string,
  title: string,
  template: BoardTemplate
) {
  const source = asDatabase(store.getBlock(sourceDatabaseId)?.model);
  const created = createBoardDatabase(store, { title, template });
  if (!source || !created) return created;
  const dest = asDatabase(store.getBlock(created.databaseId)?.model);
  if (!dest) return created;
  copyDatabaseRecords(store, source, dest);
  return created;
}

export function renameRecordRow(
  store: Store,
  rowId: string,
  title: string
) {
  const row = store.getBlock(rowId)?.model;
  const text = (row?.props as { text?: Text } | undefined)?.text;
  if (!text) return false;
  store.captureSync();
  const current = text.toString();
  if (current) text.delete(0, current.length);
  text.insert(title, 0);
  return true;
}

export function recordRowTitle(store: Store, rowId: string) {
  const row = store.getBlock(rowId)?.model;
  const text = (row?.props as { text?: { toString?: () => string } } | undefined)
    ?.text;
  return text?.toString?.() ?? '';
}
