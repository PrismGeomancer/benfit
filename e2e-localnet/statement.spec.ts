import { expect, test } from '@playwright/test';
import { installWallet, keypair } from './wallet';

// Holder 1 bought OVT, SHIFT and PENSION in the local story and was paid on payday.
test('a holder sees, signs and saves their statement', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await installWallet(page, keypair('holder1'));
  await page.goto('./#/statement');
  await expect(page.getByText('Connect a wallet to see its statement.')).toBeVisible();
  await page.locator('[data-body]').getByRole('button', { name: 'Connect wallet' }).click();
  await expect(page.getByText('Wallet connected')).toBeVisible();

  const slips = page.locator('.slip');
  await expect(slips.first()).toBeVisible({ timeout: 20_000 });
  expect(await slips.count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.slip').filter({ hasText: '$OVT' })).toContainText('Tenure');
  await expect(page.locator('.slip').filter({ hasText: '$PENSION' })).toContainText('Last payday received');
  // The 1% cap applied to holder 1's PENSION balance.
  await expect(page.locator('.slip').filter({ hasText: '$PENSION' })).toContainText('Wallet cap applied');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save payslip image' }).first().click();
  expect((await download).suggestedFilename()).toMatch(/^benfit-payslip-[0-9a-f]{12}\.png$/);

  await page.getByRole('button', { name: 'Sign this statement' }).first().click();
  await expect(page.getByText('Statement signed')).toBeVisible();
  expect(errors).toEqual([]);
});

test('payroll data renders: on payroll table, service book, coin page', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('button', { name: 'On payroll' }).click();
  await expect(page.locator('tr.row')).toHaveCount(4);
  await expect(page.locator('.tile').first()).toContainText('Paid to holders');

  await page.goto('./#/book');
  await expect(page.locator('table.data tbody tr')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'View on Solscan' }).first()).toBeVisible();

  await page.goto('./#/payroll');
  await expect(page.locator('section h2 a')).toHaveCount(4);
});
