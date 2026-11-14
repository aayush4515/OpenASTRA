import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:8011',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: '../.venv/bin/python ../scripts/e2e_server.py',
    url: 'http://127.0.0.1:8011/api/health',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
