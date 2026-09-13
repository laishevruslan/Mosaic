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

test.describe('workshop chrome panel / SDK', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(key => {
      window.localStorage.setItem(key, 'true');
    }, FLAG_STORAGE_KEY);
  });

  test('opens the Mosaic templates dock from the handle', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEdgelessBoard(page);
    await collapseSidebar(page);

    await page.getByTestId('mosaic-board-panel-open').click();
    await expect(page.getByTestId('mosaic-board-panel-dock')).toBeVisible();
    await expect(
      page.getByTestId('mosaic-board-panel-tab-templates')
    ).toBeVisible();
    await expect(
      page.getByTestId('mosaic-board-panel-insert-frame')
    ).toBeVisible();
    await expect(page.getByTestId('mosaic-template-retro')).toBeVisible();
  });
});
