import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { installWallet, keypair } from './wallet';

// Launches $PENSION through the real launch page: form, validation, upload, DBC transaction,
// wallet signature, confirmation. Skips if PENSION already exists in the registry.
test('launch a coin from the site', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => ['warning', 'error'].includes(m.type()) && console.log(`[page ${m.type()}]`, m.text()));
  await installWallet(page, keypair('creator'));
  await page.goto('./#/launch');
  await expect(page.locator('h1')).toHaveText('Launch a coin');

  // Validation first.
  await page.getByRole('button', { name: 'Launch coin' }).click();
  await expect(page.getByText('Name is required.')).toBeVisible();
  await expect(page.getByText('Ticker must be 2 to 10 letters or numbers.')).toBeVisible();
  await expect(page.getByText('Image must be PNG, JPG or GIF under 2 MB.')).toBeVisible();

  // The cost line shows the measured number.
  await expect(page.getByText(/Cost: about 0\.\d+ SOL in network fees and rent/)).toBeVisible();

  await page.getByLabel('Name').fill('Pension Pot');
  await page.getByLabel('Ticker').fill('PENSION');
  await page.getByLabel('Image').setInputFiles(resolve(import.meta.dirname, '..', 'scripts/fixtures/pension.png'));
  await page.getByLabel('Description').fill('Pension Pot. Launched on BENFIT, local test chain.');
  await page.getByLabel('First buy in SOL (optional)').fill('1');

  // First click connects the wallet, second click launches.
  await page.getByRole('button', { name: 'Launch coin' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Launch coin' }).click();

  await expect(page.getByText('Coin launched. Open its page.')).toBeVisible({ timeout: 60_000 });
  const href = await page.getByRole('link', { name: 'Open coin page' }).getAttribute('href');
  expect(href).toMatch(/^#\/coin\/[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  console.log(`launched via UI: ${href}`);
  expect(errors).toEqual([]);
});
