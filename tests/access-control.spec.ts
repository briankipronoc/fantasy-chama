import { test, expect } from '@playwright/test';

test.describe('Access Control Protections', () => {
  test('Should not allow Standard Member to view Admin Setup', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Inject "Standard Member" context via localStorage (BOLA simulation)
    await page.evaluate(() => {
      localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
      localStorage.setItem('activeUserId', 'TEST_MEMBER_123');
       // Notice we are NOT setting 'role' to 'admin'
    });

    // Attempt to access setup route
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    // Setup should not remain accessible for an already-scoped member session.
    // Depending on hydration/auth state, app may route to /dashboard or /login.
    expect(page.url()).not.toContain('/setup');
    expect(page.url()).toMatch(/\/(dashboard|login)/);
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

    // Wait and evaluate where the router sends us
    await page.waitForLoadState('networkidle');

    // The router should rebound a member back to the main dashboard or show access denied
    expect(page.url()).not.toContain('/command-center');
  });
});
