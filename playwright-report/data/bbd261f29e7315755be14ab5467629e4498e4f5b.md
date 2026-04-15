# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: deposit.spec.ts >> M-Pesa Deposit Flow >> Should mock backend STK prompt and display success toast
- Location: tests/deposit.spec.ts:5:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/deposit
Call log:
  - navigating to "http://localhost:5173/deposit", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('M-Pesa Deposit Flow', () => {
  4  | 
  5  |   test('Should mock backend STK prompt and display success toast', async ({ page }) => {
  6  |     
  7  |     // 1. Intercept the POST request to our API to prevent actual Daraja hits
  8  |     await page.route('**/api/mpesa/stkpush', async (route) => {
  9  |       const json = { success: true, message: 'Awaiting M-Pesa PIN...' };
  10 |       await route.fulfill({ json });
  11 |     });
  12 | 
  13 |     // 2. Navigate to deposit page with Mock Auth
> 14 |     await page.goto('/deposit');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/deposit
  15 |     
  16 |     await page.evaluate(() => {
  17 |       localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
  18 |       localStorage.setItem('activeUserId', 'TEST_USER_123');
  19 |     });
  20 |     
  21 |     // Reload to apply localstorage if needed
  22 |     await page.reload();
  23 | 
  24 |     // 3. Fill out the M-Pesa phone number
  25 |     const phoneInput = page.getByPlaceholder('7X XXXXXXX');
  26 |     await phoneInput.fill('712345678');
  27 | 
  28 |     // 4. Submit the payment
  29 |     const payBtn = page.locator('button', { hasText: 'Pay with M-Pesa' });
  30 |     await expect(payBtn).toBeVisible();
  31 |     
  32 |     await payBtn.click();
  33 |     
  34 |     // 5. Assert the Toast Notification appears with our mocked success message
  35 |     const toastMessage = page.getByText('Awaiting M-Pesa PIN...');
  36 |     await expect(toastMessage).toBeVisible({ timeout: 5000 });
  37 |   });
  38 | });
  39 | 
```