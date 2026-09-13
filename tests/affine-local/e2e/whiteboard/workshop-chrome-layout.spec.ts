import { test } from '@affine-test/kit/playwright';
import {
  clickEdgelessModeButton,
  locateEditorContainer,
} from '@affine-test/kit/utils/editor';
import { openHomePage } from '@affine-test/kit/utils/load-page';
import {
  clickNewPageButton,
  waitForEditorLoad,
} from '@affine-test/kit/utils/page-logic';
import { expect, type Page } from '@playwright/test';

const FLAG_STORAGE_KEY = 'global-state:affine-flag:enable_workshop_chrome';

async function openEdgelessBoard(page: Page) {
  await openHomePage(page);
  await waitForEditorLoad(page);
  await clickNewPageButton(page);
  await clickEdgelessModeButton(page);
  const container = locateEditorContainer(page);
  await container.click();
}

async function collapseSidebar(page: Page) {
  const collapse = page.locator(
    '[data-testid=app-sidebar-arrow-button-collapse][data-show=true]'
  );
  if (await collapse.isVisible().catch(() => false)) {
    await collapse.click();
  }
}

async function assertBottomToolbar(page: Page) {
  await expect(page.locator('wb-workshop-chrome')).toHaveCount(0);
  const viewport = page.locator('.affine-edgeless-viewport');
  await expect(viewport).not.toHaveAttribute(
    'data-mosaic-workshop-chrome',
    'rail'
  );
  const toolbar = page.locator('edgeless-toolbar-widget');
  await expect(toolbar).toBeVisible();
  await expect(toolbar).not.toHaveAttribute('data-mosaic-layout', 'rail');
  const viewportBox = await viewport.boundingBox();
  const toolbarBox = await toolbar.boundingBox();
  expect(viewportBox).toBeTruthy();
  expect(toolbarBox).toBeTruthy();
  expect(
    viewportBox!.y + viewportBox!.height - (toolbarBox!.y + toolbarBox!.height)
  ).toBeLessThan(24);
}

async function assertRailLayout(page: Page) {
  const chrome = page.getByTestId('mosaic-workshop-chrome');
  await expect(chrome).toHaveAttribute('data-mode', 'rail');
  const viewport = page.locator('.affine-edgeless-viewport');
  await expect(viewport).toHaveAttribute('data-mosaic-workshop-chrome', 'rail');
  const toolbar = page.locator('edgeless-toolbar-widget');
  await expect(toolbar).toHaveAttribute('data-mosaic-layout', 'rail');
  await expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
  const zoom = page.locator('affine-edgeless-zoom-toolbar-widget');
  await expect(zoom).toBeVisible();

  const viewportBox = await viewport.boundingBox();
  const toolbarBox = await toolbar.boundingBox();
  const zoomBox = await zoom.boundingBox();
  expect(viewportBox && toolbarBox && zoomBox).toBeTruthy();

  expect(toolbarBox!.x - viewportBox!.x).toBeGreaterThanOrEqual(0);
  expect(toolbarBox!.x - viewportBox!.x).toBeLessThan(48);

  const toolbarMidY = toolbarBox!.y + toolbarBox!.height / 2;
  const viewportMidY = viewportBox!.y + viewportBox!.height / 2;
  expect(Math.abs(toolbarMidY - viewportMidY)).toBeLessThan(
    viewportBox!.height / 3
  );

  expect(zoomBox!.x - viewportBox!.x).toBeLessThan(48);
  expect(
    viewportBox!.y + viewportBox!.height - (zoomBox!.y + zoomBox!.height)
  ).toBeLessThan(48);

  const separated =
    toolbarBox!.y + toolbarBox!.height <= zoomBox!.y ||
    zoomBox!.y + zoomBox!.height <= toolbarBox!.y ||
    toolbarBox!.x + toolbarBox!.width <= zoomBox!.x ||
    zoomBox!.x + zoomBox!.width <= toolbarBox!.x;
  expect(separated).toBe(true);
}

test.describe('workshop chrome fallback', () => {
  test('flag off keeps the bottom toolbar at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEdgelessBoard(page);
    await collapseSidebar(page);
    await assertBottomToolbar(page);
  });
});

test.describe('workshop chrome rail', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(key => {
      window.localStorage.setItem(key, 'true');
    }, FLAG_STORAGE_KEY);
  });

  test('rail left and zoom bottom-left at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEdgelessBoard(page);
    await collapseSidebar(page);
    await assertRailLayout(page);
    await expect(page.locator('.affine-edgeless-viewport')).toHaveScreenshot(
      'workshop-chrome-layout-1440.png'
    );
  });

  test('rail left and zoom bottom-left at 1280', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEdgelessBoard(page);
    await collapseSidebar(page);
    await assertRailLayout(page);
    await expect(page.locator('.affine-edgeless-viewport')).toHaveScreenshot(
      'workshop-chrome-layout-1280.png'
    );
  });
});
