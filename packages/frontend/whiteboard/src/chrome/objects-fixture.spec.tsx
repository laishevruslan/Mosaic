// @vitest-environment happy-dom

import { getOrCreateI18n } from '@affine/i18n';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MosaicChromeObjectsFixture } from './objects-fixture';

describe('mosaic chrome objects fixture', () => {
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

  it('renders empty frame, app card, record-card chrome, and tag chips', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(<MosaicChromeObjectsFixture />);
    });

    expect(
      host.querySelector('[data-testid="mosaic-frame-empty"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-frame-title"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-app-card"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-record-card-preview"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-tag-chip"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mosaic-tag-overflow"]')
    ).not.toBeNull();
  });
});
