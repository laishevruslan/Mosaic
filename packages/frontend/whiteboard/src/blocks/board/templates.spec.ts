import { describe, expect, it } from 'vitest';

import {
  BOARD_TEMPLATE_CATALOG,
  BOARD_TEMPLATE_IDS,
  boardTemplateDef,
  isBoardTemplate,
  resolveBoardTemplateId,
} from './templates';
import { DEFAULT_BOARD_FIELDS } from './templates/schema';
import { TODO_STATUS_OPTIONS } from './types';

describe('wb:board templates', () => {
  it('ships 14 catalog workflows with default Miro fields', () => {
    expect(BOARD_TEMPLATE_IDS).toHaveLength(14);
    expect(BOARD_TEMPLATE_CATALOG).toHaveLength(14);
    const required = DEFAULT_BOARD_FIELDS.map(column => column.name);
    for (const def of BOARD_TEMPLATE_CATALOG) {
      const names = def.columns.map(column => column.name);
      expect(names).toContain('Status');
      for (const field of required) {
        expect(names).toContain(field);
      }
      expect(def.seedRows.length).toBeGreaterThanOrEqual(3);
      expect(def.groupBy.x).toBeTruthy();
      expect(def.layout === 'kanban' || def.layout === 'table').toBe(true);
    }
  });

  it('keeps legacy todo/project/swimlane aliases', () => {
    expect(resolveBoardTemplateId('todo')).toBe('kanban-framework');
    expect(resolveBoardTemplateId('project')).toBe('project-tracking');
    expect(resolveBoardTemplateId('swimlane')).toBe('swimlane-by-assignee');
    expect(isBoardTemplate('todo')).toBe(true);
    expect(isBoardTemplate('bug-tracker')).toBe(true);
    expect(isBoardTemplate('nope')).toBe(false);
  });

  it('seeds To do / In progress / Done with a WIP cap', () => {
    const framework = boardTemplateDef('todo');
    expect(framework.wipLimits?.['In progress']).toBe(3);
    expect(TODO_STATUS_OPTIONS.map(option => option.value)).toEqual([
      'To do',
      'In progress',
      'Done',
    ]);
    const status = framework.columns.find(column => column.name === 'Status');
    expect(status?.options?.map(option => option.value)).toEqual([
      'To do',
      'In progress',
      'Done',
    ]);
  });

  it('seeds project tracking with labels, cover and estimation', () => {
    const names = boardTemplateDef('project').columns.map(column => column.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Status',
        'Assignee',
        'Labels',
        'Cover',
        'Time spent',
        'Estimation',
        'Priority',
      ])
    );
  });

  it('uses swimlanes on assignee and class-of-service boards', () => {
    expect(boardTemplateDef('swimlane').groupBy).toEqual({
      x: 'Status',
      y: 'Assignee',
    });
    expect(boardTemplateDef('swimlane-by-priority').groupBy.y).toBe(
      'Class of service'
    );
    expect(boardTemplateDef('weekly-standup').groupBy.y).toBe('Assignee');
  });
});
