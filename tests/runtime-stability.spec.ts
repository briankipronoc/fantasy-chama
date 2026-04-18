import { test, expect } from '@playwright/test';

const fallbackText = 'FantasyChama encountered an unexpected error. Your data is safe — please retry.';

const seedSession = async (page: any) => {
  await page.addInitScript(() => {
    localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
    localStorage.setItem('activeUserId', 'TEST_MEMBER_123');
    localStorage.setItem('memberPhone', '0700000000');
    localStorage.setItem('fc-role', 'member');
  });
};

test.describe('Runtime Stability Smoke', () => {
  test('dashboard, finances and profile should not crash into ErrorBoundary', async ({ page }) => {
    await seedSession(page);

    const routes = ['/dashboard', '/finances', '/standings', '/profile'];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(fallbackText)).toHaveCount(0, { timeout: 5000 });
    }
  });

});
