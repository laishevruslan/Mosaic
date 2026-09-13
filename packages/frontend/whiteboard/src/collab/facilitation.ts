import {
  isLaserActive,
  isSummonActive,
  type WbSummon,
  type WbTimer,
  WHITEBOARD_AWARENESS_KEY,
  type WhiteboardAwarenessPayload,
  type WhiteboardPeer,
} from './protocol';

export type AwarenessLikeState = {
  user?: { name?: string; id?: string };
  [WHITEBOARD_AWARENESS_KEY]?: WhiteboardAwarenessPayload;
};

export function remainingTimerMs(
  timer: WbTimer | undefined,
  now = Date.now()
) {
  if (!timer) return 0;
  if (timer.paused) return Math.max(0, timer.remainingMs ?? 0);
  return Math.max(0, timer.endsAt - now);
}

export function isTimerRunning(timer: WbTimer | undefined, now = Date.now()) {
  return remainingTimerMs(timer, now) > 0;
}

export function startTimer(
  durationMs: number,
  now = Date.now(),
  ownerClientId?: number
): WbTimer {
  return {
    endsAt: now + durationMs,
    durationMs,
    ownerClientId,
  };
}

export function pauseTimer(timer: WbTimer, now = Date.now()): WbTimer {
  return {
    ...timer,
    paused: true,
    remainingMs: remainingTimerMs(timer, now),
  };
}

export function resumeTimer(timer: WbTimer, now = Date.now()): WbTimer {
  const remaining = timer.remainingMs ?? remainingTimerMs(timer, now);
  return {
    ...timer,
    paused: false,
    remainingMs: undefined,
    endsAt: now + remaining,
  };
}

export function formatTimer(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * UX-only filter: hide others' objects while private mode is on.
 * Missing author metadata stays visible (legacy blocks).
 */
export function isPrivateHidden(
  createdBy: string | undefined,
  localAuthorId: string | undefined,
  privateMode: boolean
) {
  if (!privateMode || !createdBy || !localAuthorId) return false;
  return createdBy !== localAuthorId;
}

export function createdByOf(model: {
  props?: Record<string, unknown>;
} & Record<string, unknown>) {
  const props = model.props ?? model;
  const value = props['meta:createdBy'];
  return typeof value === 'string' && value ? value : undefined;
}

export function localAuthorId(state: AwarenessLikeState | null | undefined) {
  return state?.user?.id || state?.user?.name;
}

export function readSharedTimer(
  states: Map<number, AwarenessLikeState>,
  local?: WhiteboardAwarenessPayload,
  now = Date.now()
) {
  if (isTimerRunning(local?.timer, now)) return local?.timer;
  for (const state of states.values()) {
    const timer = state[WHITEBOARD_AWARENESS_KEY]?.timer;
    if (isTimerRunning(timer, now)) return timer;
  }
  return local?.timer;
}

export function readFacilitatorLock(
  states: Map<number, AwarenessLikeState>,
  localClientId?: number,
  local?: WhiteboardAwarenessPayload
): { on: boolean; owner?: number } {
  if (local?.facilitatorLock) {
    return { on: true, owner: localClientId };
  }
  for (const [clientId, state] of states) {
    if (state[WHITEBOARD_AWARENESS_KEY]?.facilitatorLock) {
      return { on: true, owner: clientId };
    }
  }
  return { on: false };
}

export function isFacilitatorLockedForPeer(
  lock: { on: boolean; owner?: number },
  localClientId?: number
) {
  if (!lock.on || lock.owner == null || localClientId == null) return false;
  return lock.owner !== localClientId;
}

export function readPrivateMode(
  states: Map<number, AwarenessLikeState>,
  local?: WhiteboardAwarenessPayload
) {
  if (local?.privateMode) return true;
  for (const state of states.values()) {
    if (state[WHITEBOARD_AWARENESS_KEY]?.privateMode) return true;
  }
  return false;
}

export function consumeSummon(
  peers: WhiteboardPeer[],
  appliedIds: Set<string>,
  now = Date.now()
): WbSummon | undefined {
  for (const peer of peers) {
    const summon = peer.summon;
    if (!isSummonActive(summon, now) || !summon) continue;
    if (appliedIds.has(summon.id)) continue;
    appliedIds.add(summon.id);
    return summon;
  }
  return;
}

export function nextFrameIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return (index + 1) % count;
}

export function prevFrameIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return (index - 1 + count) % count;
}

export function activeLasers(peers: WhiteboardPeer[], now = Date.now()) {
  return peers
    .map(peer => peer.laser)
    .filter((laser): laser is NonNullable<typeof laser> =>
      isLaserActive(laser, now)
    );
}
