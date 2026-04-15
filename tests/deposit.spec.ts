import { test, expect } from '@playwright/test';

test.describe('M-Pesa Deposit Flow', () => {

  test('Should mock backend STK prompt and display success toast', async ({ page }) => {
    
    // 1. Intercept the POST request to our API to prevent actual Daraja hits
    await page.route('**/api/mpesa/stkpush', async (route) => {
      const json = { success: true, message: 'Awaiting M-Pesa PIN...' };
      await route.fulfill({ json });
    });

    // 2. Navigate to deposit page with Mock Auth
    await page.goto('/deposit');
    
    await page.evaluate(() => {
      localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
      localStorage.setItem('activeUserId', 'TEST_USER_123');
    });
    
    // Reload to apply localstorage if needed
    await page.reload();

    // 3. Fill out the M-Pesa phone number
    const phoneInput = page.getByPlaceholder('7X XXXXXXX');
    await phoneInput.fill('712345678');

    // 4. Submit the payment
    const payBtn = page.locator('button', { hasText: 'Pay with M-Pesa' });
    await expect(payBtn).toBeVisible();
    
    await payBtn.click();
    
    // 5. Assert the Toast Notification appears with our mocked success message
    const toastMessage = page.getByText('Awaiting M-Pesa PIN...');
    await expect(toastMessage).toBeVisible({ timeout: 5000 });
  });
});
