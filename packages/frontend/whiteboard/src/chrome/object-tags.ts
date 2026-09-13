/**
 * Object tags for sticky / frame / card (WC3).
 * Ids live on the block; the catalog is workspace `meta.properties.tags.options`.
 */

export const MOSAIC_TAG_CHIP_MAX = 3;

/** Affine tag tokens — not competing-product dress. */
export const MOSAIC_TAG_COLORS = [
  'var(--affine-tag-blue)',
  'var(--affine-tag-teal)',
  'var(--affine-tag-green)',
  'var(--affine-tag-purple)',
  'var(--affine-tag-orange)',
  'var(--affine-tag-pink)',
  'var(--affine-tag-yellow)',
  'var(--affine-tag-gray)',
] as const;

export const MOSAIC_TAGGABLE_FLAVOURS = [
  'affine:note',
  'affine:frame',
  'affine:bookmark',
  'affine:embed-linked-doc',
  'wb:record-card',
] as const;

export type MosaicTagOption = {
  id: string;
  value: string;
  color: string;
};

export type MosaicTagChipOverflow = {
  shown: string[];
  extra: number;
};

export function readTagIds(props: unknown): string[] {
  if (!props || typeof props !== 'object') return [];
  const tags = (props as { tags?: unknown }).tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((id): id is string => typeof id === 'string' && id !== '');
}

export function toggleTagId(ids: readonly string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter(current => current !== id)
    : [...ids, id];
}

export function chipOverflow(
  ids: readonly string[],
  max = MOSAIC_TAG_CHIP_MAX
): MosaicTagChipOverflow {
  const unique = [...new Set(ids)];
  return {
    shown: unique.slice(0, max),
    extra: Math.max(0, unique.length - max),
  };
}

export function resolveTagOption(
  id: string,
  options: readonly MosaicTagOption[]
): MosaicTagOption {
  return (
    options.find(option => option.id === id) ?? {
      id,
      value: id,
      color: MOSAIC_TAG_COLORS[0],
    }
  );
}

export function nextTagColor(existing: number): string {
  return MOSAIC_TAG_COLORS[existing % MOSAIC_TAG_COLORS.length];
}

export function readWorkspaceTagOptions(workspace: unknown): MosaicTagOption[] {
  const meta = (workspace as { meta?: { properties?: unknown } } | null)?.meta;
  const properties = meta?.properties as
    | { tags?: { options?: unknown } }
    | undefined;
  const options = properties?.tags?.options;
  if (!Array.isArray(options)) return [];
  return options.filter(isTagOption);
}

function isTagOption(value: unknown): value is MosaicTagOption {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.value === 'string' &&
    typeof record.color === 'string'
  );
}

export function isTaggableFlavour(flavour: string, isStickyNote?: boolean) {
  if (flavour === 'affine:note') return isStickyNote === true;
  return (MOSAIC_TAGGABLE_FLAVOURS as readonly string[]).includes(flavour);
}
