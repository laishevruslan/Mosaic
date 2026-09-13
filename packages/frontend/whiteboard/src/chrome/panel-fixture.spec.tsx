// @vitest-environment happy-dom

import { getOrCreateI18n } from '@affine/i18n';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MosaicChromePanelFixture } from './panel-fixture';

describe('mosaic chrome panel fixture', () => {
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

  it('renders the dock, templates tab, and open handle', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(<MosaicChromePanelFixture />);
    });

    expect(
      host.querySelector('[data-testid="mosaic-board-panel-dock"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-board-panel-tab-templates"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-board-panel-tab-widgets"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-board-panel-open"]')
    ).not.toBeNull();
  });
});
