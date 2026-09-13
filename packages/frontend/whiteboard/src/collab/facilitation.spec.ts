import { describe, expect, it } from 'vitest';

import {
  consumeSummon,
  createdByOf,
  formatTimer,
  isFacilitatorLockedForPeer,
  isPrivateHidden,
  isTimerRunning,
  nextFrameIndex,
  pauseTimer,
  prevFrameIndex,
  remainingTimerMs,
  resumeTimer,
  startTimer,
} from './facilitation';
import {
  isLaserActive,
  LASER_TTL_MS,
  makeLaser,
  makeSummon,
  SUMMON_TTL_MS,
} from './protocol';

describe('facilitation timer', () => {
  it('counts down, pauses, and resumes from remaining', () => {
    const now = 1_000_000;
    const timer = startTimer(60_000, now, 1);
    expect(remainingTimerMs(timer, now + 10_000)).toBe(50_000);
    expect(isTimerRunning(timer, now + 10_000)).toBe(true);

    const paused = pauseTimer(timer, now + 10_000);
    expect(paused.paused).toBe(true);
    expect(remainingTimerMs(paused, now + 40_000)).toBe(50_000);

    const resumed = resumeTimer(paused, now + 40_000);
    expect(resumed.paused).toBeFalsy();
    expect(remainingTimerMs(resumed, now + 40_000)).toBe(50_000);
    expect(formatTimer(65_000)).toBe('1:05');
  });
});

describe('facilitation laser and summon', () => {
  it('expires the laser after ~800ms', () => {
    const now = 5_000;
    const laser = makeLaser({ x: 1, y: 2 }, now);
    expect(isLaserActive(laser, now + 100)).toBe(true);
    expect(isLaserActive(laser, now + LASER_TTL_MS + 1)).toBe(false);
  });

  it('applies a summon once per id', () => {
    const now = 8_000;
    const summon = makeSummon({ x: 10, y: 20, zoom: 0.5 }, now);
    expect(summon.until).toBe(now + SUMMON_TTL_MS);
    const applied = new Set<string>();
    const first = consumeSummon(
      [{ clientId: 2, name: 'Ada', color: '#000', summon }],
      applied,
      now + 10
    );
    expect(first?.id).toBe(summon.id);
    const second = consumeSummon(
      [{ clientId: 2, name: 'Ada', color: '#000', summon }],
      applied,
      now + 20
    );
    expect(second).toBeUndefined();
  });
});

describe('private mode and facilitator lock', () => {
  it('hides other authors only when both ids are known', () => {
    expect(isPrivateHidden('ada', 'bob', true)).toBe(true);
    expect(isPrivateHidden('ada', 'ada', true)).toBe(false);
    expect(isPrivateHidden(undefined, 'bob', true)).toBe(false);
    expect(isPrivateHidden('ada', 'bob', false)).toBe(false);
    expect(createdByOf({ props: { 'meta:createdBy': 'ada' } })).toBe('ada');
  });

  it('locks everyone except the lock owner', () => {
    expect(
      isFacilitatorLockedForPeer({ on: true, owner: 1 }, 2)
    ).toBe(true);
    expect(
      isFacilitatorLockedForPeer({ on: true, owner: 1 }, 1)
    ).toBe(false);
    expect(isFacilitatorLockedForPeer({ on: false }, 2)).toBe(false);
  });

  it('walks presentation frames in a loop', () => {
    expect(nextFrameIndex(0, 3)).toBe(1);
    expect(nextFrameIndex(2, 3)).toBe(0);
    expect(prevFrameIndex(0, 3)).toBe(2);
  });
});
