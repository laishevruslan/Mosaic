import type { MosaicMeta, MosaicMetaValue } from './types';

/** Plan §5.8 — JSON-compatible item metadata, not ACL. */
export const MOSAIC_META_MAX_BYTES = 6 * 1024;

const MOSAIC_META_KEY = 'mosaicMeta';

export function isJsonCompatible(value: unknown): value is MosaicMetaValue {
  if (value === null) return true;
  const kind = typeof value;
  if (kind === 'string' || kind === 'boolean') return true;
  if (kind === 'number') return Number.isFinite(value as number);
  if (Array.isArray(value)) return value.every(isJsonCompatible);
  if (kind === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Object.values(value as Record<string, unknown>).every(
      isJsonCompatible
    );
  }
  return false;
}

export function mosaicMetaBytes(meta: MosaicMeta): number {
  return new TextEncoder().encode(JSON.stringify(meta)).length;
}

export function assertMosaicMetaSize(meta: MosaicMeta) {
  const bytes = mosaicMetaBytes(meta);
  if (bytes > MOSAIC_META_MAX_BYTES) {
    throw new Error(
      `mosaicMeta exceeds ${MOSAIC_META_MAX_BYTES} bytes (${bytes})`
    );
  }
}

export function readMosaicMeta(props: unknown): MosaicMeta {
  if (!props || typeof props !== 'object') return {};
  const raw = (props as { mosaicMeta?: unknown }).mosaicMeta;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: MosaicMeta = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isJsonCompatible(value)) result[key] = value;
  }
  return result;
}

export function mergeMosaicMeta(
  current: MosaicMeta,
  key: string,
  value: MosaicMetaValue | undefined
): MosaicMeta {
  const next = { ...current };
  if (value === undefined) {
    delete next[key];
  } else {
    if (!isJsonCompatible(value)) {
      throw new Error(`mosaicMeta.${key} is not JSON-compatible`);
    }
    next[key] = value;
  }
  assertMosaicMetaSize(next);
  return next;
}

export function mosaicMetaPropKey() {
  return MOSAIC_META_KEY;
}
