import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'node scripts/reset-e2e-data.mjs && npm run build && node scripts/startup.mjs',
    url: 'http://127.0.0.1:4173/healthz',
    reuseExistingServer: false,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '4173',
      DATABASE_PATH: './data/e2e/database.sqlite',
      UPLOAD_PATH: './data/e2e/uploads',
      BACKUP_PATH: './data/e2e/backups',
      TILE_CACHE_PATH: './data/e2e/tile-cache'
    }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
