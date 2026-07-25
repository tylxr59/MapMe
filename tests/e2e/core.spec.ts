import { expect, test } from '@playwright/test';

test('adds a place with direct coordinates and finds it in the list', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('MapMe').first()).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.getByRole('button', { name: /add place/i }).click();
  await page.getByLabel('Name').fill('Playwright Lookout');
  await page.getByLabel('Latitude').fill('42.3601');
  await page.getByLabel('Longitude').fill('-71.0589');
  await page.getByRole('button', { name: 'Save place' }).click();
  await expect(page.getByText('Playwright Lookout')).toBeVisible();
  expect(browserErrors).toEqual([]);
});
