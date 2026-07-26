import { expect, test } from '@playwright/test';

test('completes first-run setup without container configuration', async ({ page }) => {
  const blocked = await page.request.post('/setup', {
    headers: { origin: 'https://untrusted.example' },
    form: {
      origin: 'http://127.0.0.1:4173',
      authMode: 'none'
    }
  });
  expect(blocked.status()).toBe(403);

  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole('heading', { name: 'Make MapMe yours' })).toBeVisible();
  await expect(page.getByLabel('Public address')).toHaveValue('http://127.0.0.1:4173');
  await page.getByText('No sign-in', { exact: true }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await expect(page.locator('.leaflet-container')).toBeVisible();
});

test('centers the initial map on the user location', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 42.3601, longitude: -71.0589 });
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = localStorage.getItem('mapme.viewport');
        return saved ? JSON.parse(saved) : null;
      })
    )
    .toMatchObject({
      center: [42.3601, -71.0589],
      zoom: 13
    });
});

test('routes tile requests through the same-origin proxy', async ({ page }) => {
  const tileReferrers: string[] = [];
  let directUpstreamRequests = 0;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/tiles/')) {
      tileReferrers.push(request.headers().referer ?? '');
    }
    if (url.hostname === 'tile.openstreetmap.org') directUpstreamRequests += 1;
  });

  await page.goto('/');
  const tile = page.locator('img.leaflet-tile').first();
  await expect(tile).toBeVisible();
  await expect(tile).toHaveAttribute('src', /\/api\/tiles\/\d+\/\d+\/\d+/);
  await expect(tile).toHaveAttribute('referrerpolicy', 'origin');
  await expect.poll(() => tileReferrers.find(Boolean)).toBe('http://127.0.0.1:4173/');
  expect(directUpstreamRequests).toBe(0);
});

test('starts Add place at the user location', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 42.3601, longitude: -71.0589 });
  await page.goto('/');

  await page.getByRole('button', { name: /add place/i }).click();

  await expect(page.getByLabel('Latitude')).toHaveValue('42.3601');
  await expect(page.getByLabel('Longitude')).toHaveValue('-71.0589');
});

test('uses one collapsible sidebar for places and settings', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  const sidebar = page.getByLabel('Places sidebar');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'href',
    '/manage/general'
  );
  await expect(page.getByRole('button', { name: /add place/i })).toBeVisible();

  await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await expect(sidebar).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(sidebar).toBeHidden();
});

test('adds a place with direct coordinates and copies them from its details', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
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
  await page.getByRole('button', { name: 'Copy coords' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('42.360100, -71.058900');

  const firstEdit = `${placeName} edited`;
  await page.getByRole('button', { name: 'Edit place' }).click();
  await page.getByLabel('Name').fill(firstEdit);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: firstEdit })).toBeVisible();

  const secondEdit = `${placeName} edited twice`;
  await page.getByRole('button', { name: 'Edit place' }).click();
  await expect(page.getByLabel('Name')).toHaveValue(firstEdit);
  await page.getByLabel('Name').fill(secondEdit);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: secondEdit })).toBeVisible();

  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByTitle('Zoom out').click();
  await page.getByTitle('Zoom out').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = localStorage.getItem('mapme.viewport');
        return saved ? JSON.parse(saved).zoom : null;
      })
    )
    .toBeLessThan(15);

  const mapPane = page.locator('.map-pane');
  const mapWidthWithoutPanel = await mapPane.evaluate(
    (element) => element.getBoundingClientRect().width
  );
  await page.locator('.place-row').filter({ hasText: secondEdit }).click();
  const detailsPanel = page.locator('.panel');
  await expect(detailsPanel).toBeVisible();
  await expect
    .poll(() => mapPane.evaluate((element) => element.getBoundingClientRect().width))
    .toBeLessThan(mapWidthWithoutPanel - 400);
  const reservedPanelWidth = await detailsPanel.evaluate(
    (element) => element.getBoundingClientRect().width
  );
  const mapWidthWithPanel = await mapPane.evaluate(
    (element) => element.getBoundingClientRect().width
  );
  expect(mapWidthWithoutPanel - mapWidthWithPanel).toBeCloseTo(reservedPanelWidth, 0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = localStorage.getItem('mapme.viewport');
        return saved ? JSON.parse(saved) : null;
      })
    )
    .toMatchObject({
      center: [42.3601, -71.0589],
      zoom: 15
    });
  expect(browserErrors).toEqual([]);
});

test('follows the browser light and dark color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  const light = await page.locator('.sidebar-header').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    text: getComputedStyle(document.body).color,
    tileFilter: getComputedStyle(document.querySelector('.leaflet-tile-pane')!).filter
  }));

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(() =>
      page
        .locator('.sidebar-header')
        .evaluate((element) => getComputedStyle(element).backgroundColor)
    )
    .not.toBe(light.background);
  const dark = await page.locator('.sidebar-header').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    text: getComputedStyle(document.body).color,
    tileFilter: getComputedStyle(document.querySelector('.leaflet-tile-pane')!).filter
  }));

  expect(dark.background).not.toBe(light.background);
  expect(dark.text).not.toBe(light.text);
  expect(light.tileFilter).toBe('none');
  expect(dark.tileFilter).not.toBe('none');
});
