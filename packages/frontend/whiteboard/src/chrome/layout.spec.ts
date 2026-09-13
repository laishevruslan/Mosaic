import { describe, expect, it } from 'vitest';

import {
  centeredRailRect,
  MOSAIC_CHROME_INSET,
  MOSAIC_RAIL_WIDTH,
  MOSAIC_WORKSHOP_BREAKPOINT,
  railOverlapsZoom,
  shouldUseRailLayout,
  workshopChromeMode,
  zoomClusterRect,
} from './layout';
import {
  MOSAIC_FRAME_TITLE_CSS,
  MOSAIC_SELECTION_PANEL_CSS,
  MOSAIC_TOOLBAR_RAIL_CSS,
  MOSAIC_ZOOM_INNER_PANEL_CSS,
  MOSAIC_ZOOM_PANEL_CSS,
} from './layout-styles';

const FORBIDDEN = [
  '#4262ff',
  '#ffd02f',
  '#ff9999',
  'roobert',
  'mirotone',
  '@mirohq',
] as const;

describe('mosaic workshop chrome layout', () => {
  it('uses a left rail only when the flag is on, desktop, and not presenting', () => {
    expect(
      shouldUseRailLayout({
        flag: true,
        isMobile: false,
        presentMode: false,
        viewportWidth: 1440,
      })
    ).toBe(true);
    expect(
      workshopChromeMode({
        flag: true,
        isMobile: false,
        presentMode: false,
        viewportWidth: 1280,
      })
    ).toBe('rail');
    expect(
      shouldUseRailLayout({
        flag: false,
        isMobile: false,
        presentMode: false,
        viewportWidth: 1440,
      })
    ).toBe(false);
    expect(
      shouldUseRailLayout({
        flag: true,
        isMobile: true,
        presentMode: false,
        viewportWidth: 1440,
      })
    ).toBe(false);
    expect(
      shouldUseRailLayout({
        flag: true,
        isMobile: false,
        presentMode: true,
        viewportWidth: 1440,
      })
    ).toBe(false);
    expect(
      workshopChromeMode({
        flag: true,
        isMobile: false,
        presentMode: false,
        viewportWidth: MOSAIC_WORKSHOP_BREAKPOINT,
      })
    ).toBe('fallback');
  });

  it.each([1440, 1280] as const)(
    'does not overlap rail and zoom at %s×900',
    width => {
      void width;
      const viewportHeight = 900;
      const rail = centeredRailRect(viewportHeight, 220);
      const zoom = zoomClusterRect(viewportHeight);

      expect(rail.x).toBe(MOSAIC_CHROME_INSET);
      expect(rail.w).toBe(MOSAIC_RAIL_WIDTH);
      expect(zoom.x).toBe(MOSAIC_CHROME_INSET);
      expect(zoom.y).toBeGreaterThan(rail.y + rail.h);
      expect(railOverlapsZoom({ viewportHeight, railHeight: 220 })).toBe(false);
    }
  );

  it('keeps Mosaic teal accent and panel tokens in overlay CSS', () => {
    expect(MOSAIC_TOOLBAR_RAIL_CSS).toContain('left: 12px');
    expect(MOSAIC_TOOLBAR_RAIL_CSS).toContain('translateY(-50%)');
    expect(MOSAIC_TOOLBAR_RAIL_CSS).toContain('translateX(-72px)');
    expect(MOSAIC_TOOLBAR_RAIL_CSS).toContain('var(--mosaic-accent)');
    expect(MOSAIC_ZOOM_PANEL_CSS).toContain('bottom: 12px');
    expect(MOSAIC_ZOOM_INNER_PANEL_CSS).toContain('var(--mosaic-paper)');
    expect(MOSAIC_SELECTION_PANEL_CSS).toContain('var(--mosaic-chrome-radius)');
    expect(MOSAIC_FRAME_TITLE_CSS).toContain('24px');
    expect(MOSAIC_FRAME_TITLE_CSS).toContain('var(--mosaic-accent)');

    const haystack = [
      MOSAIC_TOOLBAR_RAIL_CSS,
      MOSAIC_ZOOM_PANEL_CSS,
      MOSAIC_ZOOM_INNER_PANEL_CSS,
      MOSAIC_SELECTION_PANEL_CSS,
      MOSAIC_FRAME_TITLE_CSS,
    ]
      .join('\n')
      .toLowerCase();
    for (const needle of FORBIDDEN) {
      expect(haystack, needle).not.toContain(needle);
    }
  });
});
