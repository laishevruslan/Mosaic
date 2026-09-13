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

const FLAG_STORAGE_KEY =
  'global-state:affine-flag:enable_whiteboard_facilitation';

async function openEdgelessBoard(page: Page) {
  await openHomePage(page);
  await waitForEditorLoad(page);
  await clickNewPageButton(page);
  await clickEdgelessModeButton(page);
  const container = locateEditorContainer(page);
  await container.click();
}

test.describe('whiteboard facilitation', () => {
  test('shows timer, laser, summon and vote when the flag is on', async ({
    page,
  }) => {
    await page.addInitScript(key => {
      localStorage.setItem(key, 'true');
    }, FLAG_STORAGE_KEY);
    await openEdgelessBoard(page);
    const bar = page.getByTestId('wb-facilitation');
    await expect(bar).toBeVisible();
    await expect(page.getByTestId('wb-timer')).toBeVisible();
    await expect(page.getByTestId('wb-laser')).toBeVisible();
    await expect(page.getByTestId('wb-summon')).toBeVisible();
    await expect(page.getByTestId('wb-vote')).toBeVisible();
  });
});
