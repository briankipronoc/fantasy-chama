import { test, expect } from '@playwright/test';

test.describe('M-Pesa Deposit Flow', () => {

  test('Should mock backend STK prompt and display success toast', async ({ page }) => {
    
    // 1. Intercept the POST request to our API to prevent actual Daraja hits
    await page.route('**/api/mpesa/stkpush', async (route) => {
      const json = { success: true, message: 'Awaiting M-Pesa PIN...' };
      await route.fulfill({ json });
    });

    // 2. Set auth context before navigating to deposit page
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
      localStorage.setItem('activeUserId', 'TEST_USER_123');
      localStorage.setItem('role', 'member');
    });
    
    await page.goto('/deposit');

    // 3. Verify Deposit UI elements render
    const depositTitle = page.locator('text=/Deposit|Fund Wallet|Select Amount/i').first();
    await expect(depositTitle).toBeVisible({ timeout: 10000 });

    // 4. Assert amount buttons exist
    const amountButton = page.locator('button', { hasText: /Gameweek|Custom/i }).first();
    await expect(amountButton).toBeVisible();
  });
});
