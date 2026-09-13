// @vitest-environment happy-dom

import { getOrCreateI18n } from '@affine/i18n';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MosaicChromeLayoutFixture } from './layout-fixture';

describe('mosaic chrome layout fixture', () => {
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

  it('renders rail, zoom, and selection at 1440 and 1280 plus a fallback board', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(<MosaicChromeLayoutFixture />);
    });

    expect(
      host.querySelector('[data-testid="mosaic-chrome-layout-fixture"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-chrome-rail-rail-1440"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-chrome-zoom-rail-1280"]')
    ).not.toBeNull();
    expect(
      host.querySelector(
        '[data-testid="mosaic-chrome-selection-fallback-1100"]'
      )
    ).not.toBeNull();
  });
});
