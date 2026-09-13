import { describe, expect, it } from 'vitest';

import { WHITEBOARD_FLAVOURS } from '../const';
import { createMosaicBoard } from '../sdk/board';
import { createFakeHost } from '../sdk/fake-host';
import { insertMosaicTemplate } from './templates-insert';

describe('mosaic template insert', () => {
  it('creates a retro frame with three stickies grouped into it', () => {
    const host = createFakeHost();
    const board = createMosaicBoard(host);
    const ids = insertMosaicTemplate(board, 'retro');
    const frame = host.blocks.get(ids[0]);
    expect(frame?.flavour).toBe('affine:frame');
    expect(frame?.props.title).toBe('Retro');
    const stickies = ids.slice(1);
    expect(stickies).toHaveLength(3);
    const children = frame?.props.childElementIds as Record<string, boolean>;
    for (const id of stickies) {
      expect(host.blocks.get(id)?.flavour).toBe('affine:note');
      expect(children[id]).toBe(true);
    }
  });

  it('drops stickies into a selected frame instead of creating another', () => {
    const host = createFakeHost();
    const board = createMosaicBoard(host);
    const frameId = board.createFrame({
      title: 'Host',
      x: 10,
      y: 20,
    }) as string;
    board.setSelection([frameId]);
    const ids = insertMosaicTemplate(board, 'two-by-two');
    expect(ids).not.toContain(frameId);
    expect(ids).toHaveLength(4);
    const children = host.blocks.get(frameId)?.props.childElementIds as Record<
      string,
      boolean
    >;
    expect(Object.keys(children)).toHaveLength(4);
  });

  it('inserts a chart widget and can parent it to the selected frame', () => {
    const host = createFakeHost();
    const board = createMosaicBoard(host);
    const frameId = board.createFrame({ x: 0, y: 0 }) as string;
    board.setSelection([frameId]);
    const [chart] = insertMosaicTemplate(board, 'widget-chart');
    expect(host.blocks.get(chart)?.flavour).toBe(WHITEBOARD_FLAVOURS.chart);
    const children = host.blocks.get(frameId)?.props.childElementIds as
      | Record<string, boolean>
      | undefined;
    expect(children?.[chart]).toBe(true);
  });
});
