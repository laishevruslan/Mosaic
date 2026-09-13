export const WHITEBOARD_AWARENESS_KEY = 'wbCollab';

export const POINTER_THROTTLE_MS = 40;
export const VIEWPORT_THROTTLE_MS = 80;
export const ATTENTION_TTL_MS = 5000;
export const LASER_TTL_MS = 800;
export const SUMMON_TTL_MS = 4000;

export type WbPointer = { x: number; y: number };
export type WbViewport = { x: number; y: number; zoom: number };
export type WbAttention = {
  x: number;
  y: number;
  w: number;
  h: number;
  until: number;
};
export type WbEditing = { flavour: string; blockId: string };

/** Shared countdown. `paused` keeps `remainingMs` instead of chasing `endsAt`. */
export type WbTimer = {
  endsAt: number;
  durationMs: number;
  paused?: boolean;
  remainingMs?: number;
  ownerClientId?: number;
};

export type WbLaser = { x: number; y: number; until: number };

/** One-shot camera teleport; recipients apply each `id` at most once. */
export type WbSummon = {
  id: string;
  x: number;
  y: number;
  zoom: number;
  until: number;
};

export type WbPresentation = {
  frameId: string | null;
  index: number;
};

export type WhiteboardAwarenessPayload = {
  pointer?: WbPointer;
  followClientId?: number | null;
  viewport?: WbViewport;
  attention?: WbAttention;
  editing?: WbEditing;
  color?: string;
  timer?: WbTimer;
  laser?: WbLaser;
  summon?: WbSummon;
  privateMode?: boolean;
  facilitatorLock?: boolean;
  presentation?: WbPresentation;
};

export type WhiteboardPeer = {
  clientId: number;
  name: string;
  color: string;
  pointer?: WbPointer;
  viewport?: WbViewport;
  attention?: WbAttention;
  editing?: WbEditing;
  followClientId?: number | null;
  laser?: WbLaser;
  timer?: WbTimer;
  summon?: WbSummon;
  privateMode?: boolean;
  facilitatorLock?: boolean;
  presentation?: WbPresentation;
};

export type AwarenessLikeState = {
  user?: { name?: string };
  color?: string;
  [WHITEBOARD_AWARENESS_KEY]?: WhiteboardAwarenessPayload;
};

const PEER_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
];

export function colorForPeer(clientId: number) {
  return PEER_COLORS[Math.abs(clientId) % PEER_COLORS.length] ?? '#2563eb';
}

export function isAttentionActive(
  attention: WbAttention | undefined,
  now = Date.now()
) {
  return (
    !!attention && attention.until > now && attention.w > 0 && attention.h > 0
  );
}

export function isLaserActive(laser: WbLaser | undefined, now = Date.now()) {
  return !!laser && laser.until > now;
}

export function isSummonActive(
  summon: WbSummon | undefined,
  now = Date.now()
) {
  return !!summon && summon.until > now && !!summon.id;
}

export function makeLaser(
  point: WbPointer,
  now = Date.now(),
  ttl = LASER_TTL_MS
): WbLaser {
  return { ...point, until: now + ttl };
}

export function makeSummon(
  viewport: WbViewport,
  now = Date.now(),
  ttl = SUMMON_TTL_MS,
  id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
): WbSummon {
  return { id, ...viewport, until: now + ttl };
}

export function makeAttention(
  bound: { x: number; y: number; w: number; h: number },
  now = Date.now(),
  ttl = ATTENTION_TTL_MS
): WbAttention {
  return { ...bound, until: now + ttl };
}

export function shouldPublish(lastMs: number, now: number, minMs: number) {
  return now - lastMs >= minMs;
}

/**
 * An explicit `undefined` (or `null` for `followClientId`) clears the field so
 * it is dropped from the awareness payload rather than published as empty.
 */
export function mergePayload(
  current: WhiteboardAwarenessPayload | undefined,
  patch: Partial<WhiteboardAwarenessPayload>
): WhiteboardAwarenessPayload {
  const next: WhiteboardAwarenessPayload = { ...current, ...patch };
  for (const key of Object.keys(patch) as Array<
    keyof WhiteboardAwarenessPayload
  >) {
    const value = patch[key];
    if (value === undefined || (key === 'followClientId' && value === null)) {
      delete next[key];
    }
  }
  return next;
}

/**
 * Following someone who already follows us would make both viewports chase
 * each other, so the request is refused.
 */
export function canFollow(
  states: Map<number, AwarenessLikeState>,
  targetClientId: number,
  localClientId?: number
) {
  if (targetClientId === localClientId) return false;
  const target = states.get(targetClientId)?.[WHITEBOARD_AWARENESS_KEY];
  return target?.followClientId !== localClientId;
}

export function readPeers(
  states: Map<number, AwarenessLikeState>,
  localClientId?: number,
  now = Date.now()
): WhiteboardPeer[] {
  const peers: WhiteboardPeer[] = [];
  states.forEach((state, clientId) => {
    if (clientId === localClientId) return;
    const payload = state[WHITEBOARD_AWARENESS_KEY];
    peers.push({
      clientId,
      name: state.user?.name || `#${clientId}`,
      color: payload?.color || state.color || colorForPeer(clientId),
      pointer: payload?.pointer,
      viewport: payload?.viewport,
      attention: isAttentionActive(payload?.attention, now)
        ? payload?.attention
        : undefined,
      editing: payload?.editing,
      followClientId: payload?.followClientId ?? null,
      laser: isLaserActive(payload?.laser, now) ? payload?.laser : undefined,
      timer: payload?.timer,
      summon: isSummonActive(payload?.summon, now)
        ? payload?.summon
        : undefined,
      privateMode: payload?.privateMode,
      facilitatorLock: payload?.facilitatorLock,
      presentation: payload?.presentation,
    });
  });
  return peers;
}

export function followViewport(
  states: Map<number, AwarenessLikeState>,
  followClientId: number | null | undefined
) {
  if (followClientId == null) return;
  return states.get(followClientId)?.[WHITEBOARD_AWARENESS_KEY]?.viewport;
}

export function isRemoteEditing(
  states: Map<number, AwarenessLikeState>,
  blockId: string,
  localClientId?: number
) {
  for (const [clientId, state] of states) {
    if (clientId === localClientId) continue;
    if (state[WHITEBOARD_AWARENESS_KEY]?.editing?.blockId === blockId) {
      return true;
    }
  }
  return false;
}

export function remoteEditors(
  states: Map<number, AwarenessLikeState>,
  blockId: string,
  localClientId?: number
) {
  const names: string[] = [];
  states.forEach((state, clientId) => {
    if (clientId === localClientId) return;
    if (state[WHITEBOARD_AWARENESS_KEY]?.editing?.blockId === blockId) {
      names.push(state.user?.name || `#${clientId}`);
    }
  });
  return names;
}
