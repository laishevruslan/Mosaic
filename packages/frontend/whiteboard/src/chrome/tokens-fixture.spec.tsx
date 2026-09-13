// @vitest-environment happy-dom

import { getOrCreateI18n } from '@affine/i18n';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MOSAIC_STICKY_SWATCH_IDS } from './tokens';
import { MosaicChromeTokensFixture } from './tokens-fixture';

describe('mosaic chrome tokens fixture', () => {
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

  it('renders panel, 32/36 icon buttons, and sticky swatches in light and dark', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(<MosaicChromeTokensFixture />);
    });

    expect(
      host.querySelector('[data-testid="mosaic-chrome-tokens-fixture"]')
    ).not.toBeNull();

    for (const theme of ['light', 'dark'] as const) {
      expect(
        host.querySelector(`[data-testid="mosaic-chrome-panel-${theme}"]`)
      ).not.toBeNull();
      expect(
        host.querySelector(`[data-testid="mosaic-chrome-icon-32-${theme}"]`)
      ).not.toBeNull();
      expect(
        host.querySelector(`[data-testid="mosaic-chrome-icon-36-${theme}"]`)
      ).not.toBeNull();
      for (const id of MOSAIC_STICKY_SWATCH_IDS) {
        expect(
          host.querySelector(`[data-testid="mosaic-sticky-${id}-${theme}"]`)
        ).not.toBeNull();
      }
    }
  });
});
