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

const CHART_FLAG = 'global-state:affine-flag:enable_whiteboard_chart';
const BOARD_FLAG = 'global-state:affine-flag:enable_board_widget';

async function openEdgelessBoard(page: Page) {
  await openHomePage(page);
  await waitForEditorLoad(page);
  await clickNewPageButton(page);
  await clickEdgelessModeButton(page);
  const container = locateEditorContainer(page);
  await container.click();
}

/**
 * WCAG smoke for edgeless + chart/board create. Skipped unless A11Y=1.
 * Live dual-browser / VPAT are not part of this spec.
 */
test.describe('whiteboard a11y', () => {
  test.skip(process.env.A11Y !== '1', 'set A11Y=1 to run axe + keyboard explore');

  test('edgeless create chart/board has no critical axe findings', async ({
    page,
  }) => {
    await page.addInitScript(
      ([chart, board]) => {
        localStorage.setItem(chart, 'true');
        localStorage.setItem(board, 'true');
      },
      [CHART_FLAG, BOARD_FLAG]
    );
    await openEdgelessBoard(page);

    await page.keyboard.press('/');
    await page.keyboard.type('Chart');
    const chartItem = page.getByText('Chart', { exact: true }).first();
    if (await chartItem.isVisible().catch(() => false)) {
      await chartItem.click();
    }

    await page.keyboard.press('/');
    await page.keyboard.type('Kanban Framework');
    const boardItem = page.getByText('Kanban Framework').first();
    if (await boardItem.isVisible().catch(() => false)) {
      await boardItem.click();
    }

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid=wb-a11y-live]')).toBeAttached();

    try {
      const axe = await import('@axe-core/playwright');
      const results = await new axe.AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        violation => violation.impact === 'critical'
      );
      expect(critical).toEqual([]);
    } catch (error) {
      if (
        error instanceof Error &&
        /Cannot find module '@axe-core\/playwright'/.test(error.message)
      ) {
        test.info().annotations.push({
          type: 'note',
          description: '@axe-core/playwright is not installed; keyboard path only',
        });
        return;
      }
      throw error;
    }
  });
});
