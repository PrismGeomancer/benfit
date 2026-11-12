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

test('Try the rule reproduces the worked example', async ({ page }) => {
  await page.goto('./#/');
  const cells = page.locator('.rule-card tbody tr td:last-child');
  await expect(cells).toHaveText(['10.91 SOL', '5.45 SOL', '3.64 SOL']);
  await page.fill('input[name=tokens]', '10');
  await page.fill('input[name=days]', '30');
  await expect(page.locator('.rule-card .result')).toContainText('300M points');
  await expect(page.locator('.slip-line.total')).toBeVisible();
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
