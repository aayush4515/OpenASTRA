import { test, expect } from '@playwright/test';

test('complete onboard assessment, lab, emergency and delayed Earth report', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A healthy crew. A mission forward.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Start health check-in' }).click();
  await page.getByLabel('Demonstration scenario').selectOption('voc_anomaly');
  await page.getByRole('button', { name: 'Begin check-in' }).click();
  for (const name of [
    'Confirm Maya Chen',
    'Open optical assessment',
    'Continue without camera',
    'Collect simulated readings',
    'Collect VOC fingerprint',
    'Complete questionnaire',
    'Analyze & save assessment',
    'Finish check-in',
  ])
    await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByText('VOC fingerprint changed')).toBeVisible();
  await page.getByRole('link', { name: 'View health dashboard' }).click();
  await page.getByRole('button', { name: 'Start simulated blood test' }).click();
  for (const name of ['Load simulated sample', 'Run simulated analysis', 'Save lab results'])
    await page.getByRole('button', { name }).click();
  await expect(page.getByText('Lab results saved. Next reminder scheduled.')).toBeVisible();
  await page.getByRole('link', { name: 'Mission Control', exact: true }).click();
  await page.getByRole('button', { name: 'Enter Mission Control demo role' }).click();
  await page.getByRole('button', { name: 'Disconnect Earth link' }).click();
  await page.getByRole('button', { name: 'Queue health report' }).click();
  await expect(page.getByText('Queued', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Communication delay').fill('0');
  await page.getByRole('button', { name: 'Apply delay' }).click();
  await page.getByRole('button', { name: 'Restore Earth link' }).click();
  await page.getByRole('button', { name: 'Acknowledge', exact: true }).first().click();
  await expect(page.getByText('Acknowledged', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Emergency assistance' }).click();
  await page.getByRole('button', { name: 'Activate emergency simulation' }).click();
  await expect(page.getByText('Event saved locally. Mission Control report queued.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Close simulation' })).toBeVisible();
});

test('all routes load at desktop and narrow widths without horizontal overflow', async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    for (const route of [
      '/',
      '/booth',
      '/astronaut/AST-001',
      '/intelligence/AST-001',
      '/emergency',
      '/mission-control',
      '/settings',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  }
});

test('camera permission denied preserves manual fallback', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
      },
      configurable: true,
    }),
  );
  await page.goto('/booth');
  await page.getByRole('button', { name: 'Begin check-in' }).click();
  await page.getByRole('button', { name: 'Confirm Maya Chen' }).click();
  await page.getByRole('button', { name: 'Open optical assessment' }).click();
  await page.getByRole('button', { name: 'Enable camera' }).click();
  await expect(page.getByRole('alert')).toContainText('Camera permission was denied', {
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Continue without camera' }).click();
  await expect(page.getByRole('button', { name: 'Collect simulated readings' })).toBeVisible();
});
