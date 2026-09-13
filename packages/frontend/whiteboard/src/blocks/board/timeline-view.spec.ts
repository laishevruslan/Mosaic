import { describe, expect, it } from 'vitest';

import {
  barPercent,
  isInvalidRange,
  parseTimelineDate,
  timelineWindow,
} from './timeline-view';

describe('wb:board timeline layout', () => {
  it('parses dates, flags inverted ranges, and lays out bars', () => {
    expect(parseTimelineDate('2026-09-01')?.toISOString().startsWith('2026-09-01')).toBe(
      true
    );
    expect(isInvalidRange('2026-09-10', '2026-09-01')).toBe(true);
    expect(isInvalidRange('2026-09-01', '2026-09-10')).toBe(false);

    const window = timelineWindow(
      [
        { id: 'a', title: 'Ship', startAt: '2026-09-01', endAt: '2026-09-08' },
        { id: 'b', title: 'Review', startAt: '2026-09-10', endAt: '2026-09-12' },
      ],
      'day',
      new Date('2026-09-01T00:00:00.000Z')
    );
    expect(window.ticks.length).toBeGreaterThan(1);
    const bar = barPercent(
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-08T00:00:00.000Z'),
      window.start,
      window.end
    );
    expect(bar).toBeTruthy();
    expect(bar!.width).toBeGreaterThan(0);
    expect(barPercent(null, null, window.start, window.end)).toBeNull();
  });
});
