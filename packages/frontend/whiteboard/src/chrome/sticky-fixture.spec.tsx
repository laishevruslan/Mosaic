// @vitest-environment happy-dom

import { getOrCreateI18n } from '@affine/i18n';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MosaicChromeStickyFixture } from './sticky-fixture';
import { MOSAIC_STICKY_KIND } from './sticky-preset';
import { MOSAIC_STICKY_SWATCH_IDS } from './tokens';

describe('mosaic chrome sticky fixture', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let host: HTMLDivElement | undefined;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    getOrCreateI18n();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it('renders a sticky preview and Mosaic palette swatches', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(<MosaicChromeStickyFixture />);
    });

    const note = host.querySelector('[data-testid="mosaic-sticky-preview"]');
    expect(note).not.toBeNull();
    expect(note?.dataset.noteKind).toBe(MOSAIC_STICKY_KIND);
    expect(
      host.querySelector('[data-testid="mosaic-sticky-palette"]')
    ).not.toBeNull();
    for (const id of MOSAIC_STICKY_SWATCH_IDS) {
      expect(
        host.querySelector(`[data-testid="mosaic-sticky-swatch-${id}"]`)
      ).not.toBeNull();
    }
  });
});
