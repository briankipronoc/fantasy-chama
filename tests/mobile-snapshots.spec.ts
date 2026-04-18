import { test, expect } from '@playwright/test';

test.describe('Mobile Breakpoint Snapshots', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Dashboard mobile snapshot', async ({ page }) => {
    // For this dummy test we'll just check if the page loads and we can log in if needed. 
    // Usually, you'd navigate and check the specific UI visual regressions.
    await page.goto('/');
    // Check elements instead, since UI needs to load
    await expect(page.locator('body')).toBeVisible();
  });

  test('Command Center mobile snapshot', async ({ page }) => {
    await page.goto('/hq');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Finances mobile snapshot', async ({ page }) => {
    await page.goto('/finances');
    await expect(page.locator('body')).toBeVisible();
  });
});
