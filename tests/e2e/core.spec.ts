import { expect, test } from '@playwright/test';

test('adds a place with direct coordinates and finds it in the list', async ({ page }) => {
  const placeName = `Playwright Lookout ${Date.now()}`;
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('MapMe').first()).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.getByRole('button', { name: /add place/i }).click();
  await page.getByLabel('Name').fill(placeName);
  await page.getByLabel('Latitude').fill('42.3601');
  await page.getByLabel('Longitude').fill('-71.0589');
  await page.getByRole('button', { name: 'Save place' }).click();
  await expect(page.getByText(placeName, { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('follows the browser light and dark color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  const light = await page.locator('.topbar').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    text: getComputedStyle(document.body).color,
    tileFilter: getComputedStyle(document.querySelector('.leaflet-tile-pane')!).filter
  }));

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(() =>
      page.locator('.topbar').evaluate((element) => getComputedStyle(element).backgroundColor)
    )
    .not.toBe(light.background);
  const dark = await page.locator('.topbar').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    text: getComputedStyle(document.body).color,
    tileFilter: getComputedStyle(document.querySelector('.leaflet-tile-pane')!).filter
  }));

  expect(dark.background).not.toBe(light.background);
  expect(dark.text).not.toBe(light.text);
  expect(light.tileFilter).toBe('none');
  expect(dark.tileFilter).not.toBe('none');
});
