import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

const FORBIDDEN = [
  '#4262ff',
  '#ffd02f',
  '#ff9999',
  'roobert',
  'mirotone',
  '@mirohq',
] as const;

describe('mosaic board SDK legal checklist', () => {
  it('does not mention competing-product dress or packages', () => {
    const files = ['README.md', 'board.ts', 'types.ts', 'from-std.ts'];
    const haystack = files
      .map(name => readFileSync(join(ROOT, name), 'utf8'))
      .join('\n')
      .toLowerCase();
    for (const needle of FORBIDDEN) {
      expect(haystack, needle).not.toContain(needle);
    }
  });
});
