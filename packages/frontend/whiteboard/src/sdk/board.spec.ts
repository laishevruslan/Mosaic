import { describe, expect, it } from 'vitest';

import {
  MOSAIC_STICKY_KIND,
  MOSAIC_STICKY_WIDTH,
} from '../chrome/sticky-preset';
import { WHITEBOARD_FLAVOURS } from '../const';
import { createMosaicBoard } from './board';
import { createFakeHost } from './fake-host';
import { MOSAIC_META_MAX_BYTES } from './metadata';
import type { MosaicViewportState } from './types';

describe('mosaic board SDK', () => {
  it('creates sticky, frame, bookmark/record cards, and a curve connector', () => {
    const host = createFakeHost();
    const board = createMosaicBoard(host);

    const sticky = board.createSticky({ x: 10, y: 20 });
    expect(sticky).toBeTruthy();
    const stickyBlock = host.blocks.get(sticky as string);
    expect(stickyBlock?.flavour).toBe('affine:note');
    const edgeless = stickyBlock?.props.edgeless as
      | { kind?: string }
      | undefined;
    expect(edgeless?.kind).toBe(MOSAIC_STICKY_KIND);
    expect(stickyBlock?.props.xywh).toBe(`[10,20,${MOSAIC_STICKY_WIDTH},200]`);

    const frame = board.createFrame({ title: 'Retro', x: 0, y: 0 });
    const frameBlock = host.blocks.get(frame as string);
    expect(frameBlock?.flavour).toBe('affine:frame');
    board.addToFrame(frame as string, [sticky as string]);
    const childIds = frameBlock?.props.childElementIds as
      | Record<string, boolean>
      | undefined;
    expect(childIds?.[sticky as string]).toBe(true);

    const bookmark = board.createCard({ url: 'https://example.test' });
    expect(host.blocks.get(bookmark!)?.flavour).toBe('affine:bookmark');
    const record = board.createCard({
      databaseId: 'db',
      rowId: 'row',
    });
    expect(host.blocks.get(record!)?.flavour).toBe(
      WHITEBOARD_FLAVOURS.recordCard
    );
    const linked = board.createCard({ pageId: 'doc-1' });
    expect(host.blocks.get(linked!)?.flavour).toBe('affine:embed-linked-doc');
    const chart = board.createWidget('chart');
    expect(host.blocks.get(chart!)?.flavour).toBe(WHITEBOARD_FLAVOURS.chart);
    expect(board.getBound(chart as string)?.w).toBeGreaterThan(0);

    const connector = board.createConnector({
      source: { id: sticky! },
      target: { id: frame! },
    });
    expect(host.elements.get(connector!)?.mode).toBe(2);
    expect(host.elements.get(connector!)?.strokeWidth).toBe(2);
    expect(host.elements.get(connector!)?.rearEndpointStyle).toBe('Arrow');
  });

  it('sets viewport from top-left, zooms to a bound, and round-trips metadata', () => {
    const host = createFakeHost();
    const board = createMosaicBoard(host);
    const seen: MosaicViewportState[] = [];
    const stop = board.viewport.on('change', state => {
      seen.push(state);
    });

    board.viewport.set(100, 50, 2);
    expect(board.viewport.get().zoom).toBe(2);
    expect(board.viewport.get().x).toBeCloseTo(100);
    expect(board.viewport.get().y).toBeCloseTo(50);
    expect(seen.length).toBeGreaterThan(0);

    board.viewport.zoomTo({ x: 0, y: 0, w: 480, h: 320 });
    expect(board.viewport.get().zoom).toBeGreaterThan(1);
    board.viewport.lock(true);
    expect(host.locked).toBe(true);

    const sticky = board.createSticky()!;
    board.setMetadata(sticky, 'owner', 'ada');
    expect(board.getMetadata(sticky)).toEqual({ owner: 'ada' });
    board.setMetadata(sticky, 'owner', undefined);
    expect(board.getMetadata(sticky)).toEqual({});

    expect(() =>
      board.setMetadata(sticky, 'blob', 'x'.repeat(MOSAIC_META_MAX_BYTES))
    ).toThrow(/exceeds/);

    stop();
  });

  it('emits selection:change and opens/closes the dock panel', async () => {
    const host = createFakeHost();
    const board = createMosaicBoard(host);
    let selections = 0;
    const stop = board.on('selection:change', () => {
      selections += 1;
    });
    board.setSelection(['a']);
    expect(board.getSelection()).toEqual(['a']);
    expect(selections).toBe(1);

    board.ui.openPanel({ id: 'templates' });
    expect(board.ui.panelId()).toBe('templates');
    board.ui.closePanel();
    expect(board.ui.panelId()).toBeNull();

    const pending = board.ui.openModal({ title: 'Confirm' });
    expect(board.ui.modal()?.title).toBe('Confirm');
    board.ui.resolveModal(true);
    await expect(pending).resolves.toBe(true);
    stop();
  });
});
