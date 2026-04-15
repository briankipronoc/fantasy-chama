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

    // Setup is theoretically accessible ONLY if league is missing OR if you are setting up something.
    // If the system has auth routing logic, it should redirect away.
    // Let's assert we don't see the "Chairman Setup" text
    const setupText = await page.getByText('Admin Setup', { exact: false }).isVisible();
    
    // In our app model, /setup redirect happens if activeLeagueId exists already
    // so we should be pushed to the member dashboard.
    expect(page.url()).toContain('/dashboard');
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
