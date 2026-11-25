import { expect, test } from '@playwright/test';

const WIDTHS = [320, 768, 1280];
const ROUTES = ['#/', '#/payroll', '#/statement', '#/book', '#/how', '#/launch'];
// Words that must never reach the UI (copy deck + Claude Code prompt).
const BANNED = /\b(demo|sample|lorem|placeholder|mock|test|yield|reward|apy|returns|profit|guaranteed|passive income|airdrop|giveaway|moon|100x)\b/i;

for (const width of WIDTHS) {
  test(`dashboard at ${width}px`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./#/');
    await expect(page.locator('h1')).toHaveText('Every coin pays its holders a benefit.');
    await page.waitForSelector('table.coins tbody tr.row', { timeout: 15_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: info.outputPath(`dashboard-${width}.png`), fullPage: true });

    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(scroll, 'horizontal scroll').toBe(0);
    expect(errors, 'console errors').toEqual([]);
    expect(await page.locator('body').innerText()).not.toMatch(BANNED);
  });
}

test('every route renders without banned words or console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const r of ROUTES) {
    await page.goto('./' + r);
    await page.waitForTimeout(700);
    expect(await page.locator('body').innerText(), r).not.toMatch(BANNED);
  }
  expect(errors).toEqual([]);
});

test('Current holders lists real wallets and switches coin', async ({ page }) => {
  await page.goto('./#/');
  await page.waitForSelector('tr.row');
  const rows = page.locator('.holders-t tbody tr');
  await expect(rows.first().locator('a')).toBeVisible({ timeout: 20_000 });
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  const first = await rows.first().locator('a').innerText();
  // Share of supply column, in percent, descending.
  const pcts = (await page.locator('.holders-t tbody tr td:last-child').allInnerTexts()).map((x) => parseFloat(x));
  expect(pcts.every((n) => n > 0 && n < 100)).toBe(true);
  expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
  await page.locator('.holders select').selectOption({ index: 2 });
  await expect(page.locator('.holders-t tbody tr').first().locator('a')).not.toHaveText(first, { timeout: 20_000 });
  await expect(page.locator('body')).not.toContainText('Worked example');
  await expect(page.getByRole('heading', { name: 'My statement' })).toBeVisible();
});

test('table sorts and expands with the keyboard', async ({ page }) => {
  await page.goto('./#/');
  await page.waitForSelector('tr.row');
  await page.locator('tr.row').first().focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('tr.detail')).toHaveCount(1);
  await expect(page.locator('tr.detail')).toContainText('Mint authority');
  await page.getByRole('button', { name: 'Sort by Price' }).click();
  await expect(page.locator('th[data-key=price]')).toHaveAttribute('aria-sort', 'descending');
});
