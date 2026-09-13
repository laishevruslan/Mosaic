import { describe, expect, it } from 'vitest';

import { enterFocusMode, exitFocusMode } from './board-focus';

describe('board focus mode', () => {
  it('locks the viewport and marks the widget live-budget exempt', () => {
    const viewport = { locked: false };
    let focus = false;
    let exempt = false;
    const wasLocked = enterFocusMode({
      viewport,
      setFocus: on => {
        focus = on;
      },
      setExempt: on => {
        exempt = on;
      },
    });
    expect(wasLocked).toBe(false);
    expect(focus).toBe(true);
    expect(exempt).toBe(true);
    expect(viewport.locked).toBe(true);

    exitFocusMode(
      {
        viewport,
        setFocus: on => {
          focus = on;
        },
        setExempt: on => {
          exempt = on;
        },
      },
      wasLocked
    );
    expect(focus).toBe(false);
    expect(exempt).toBe(false);
    expect(viewport.locked).toBe(false);
  });
});
