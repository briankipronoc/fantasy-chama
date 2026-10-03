import { test, expect } from '@playwright/test';

test.describe('Access Control Protections', () => {
  test('Should not allow Standard Member to view Admin Command Center via /admin', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Inject "Standard Member" context via localStorage (BOLA simulation)
    await page.evaluate(() => {
      localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
      localStorage.setItem('activeUserId', 'TEST_MEMBER_123');
      localStorage.setItem('role', 'member');
    });

    // Attempt to access /admin route
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin$/, { timeout: 10000 });
  });

  test('Should block Standard Member from Admin Command Center', async ({ page }) => {
    await page.goto('/');

    // Inject "Standard Member" context via localStorage
    await page.evaluate(() => {
      localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
      localStorage.setItem('activeUserId', 'TEST_MEMBER_123');
      localStorage.setItem('role', 'member'); 
    });

    // Navigate to the command center directly
    await page.goto('/command-center');

    // The router should rebound a member back to the main dashboard or show access denied
    await expect(page).not.toHaveURL(/\/command-center/, { timeout: 10000 });
  });
});
