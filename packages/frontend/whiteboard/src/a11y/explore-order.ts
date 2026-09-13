export type ExploreItem = {
  id: string;
  x: number;
  y: number;
  flavour?: string;
  title?: string;
};

export function readingOrder<T extends ExploreItem>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
  );
}

export function nextInReadingOrder<T extends ExploreItem>(
  items: readonly T[],
  currentId: string | null,
  dir: 1 | -1
): T | null {
  const ordered = readingOrder(items);
  if (ordered.length === 0) {
    return null;
  }
  if (!currentId) {
    return dir === 1 ? ordered[0]! : ordered[ordered.length - 1]!;
  }
  const idx = ordered.findIndex(item => item.id === currentId);
  if (idx < 0) {
    return dir === 1 ? ordered[0]! : ordered[ordered.length - 1]!;
  }
  const next = idx + dir;
  if (next < 0 || next >= ordered.length) {
    return ordered[idx]!;
  }
  return ordered[next]!;
}
