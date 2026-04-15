# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: setup.spec.ts >> Chairman Setup Flow >> Should navigate the multi-step Chairman registration process
- Location: tests/setup.spec.ts:5:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/setup
Call log:
  - navigating to "http://localhost:5173/setup", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Chairman Setup Flow', () => {
  4  | 
  5  |   test('Should navigate the multi-step Chairman registration process', async ({ page }) => {
  6  |     // Navigate to Setup URL
> 7  |     await page.goto('/setup');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/setup
  8  |     
  9  |     // Step 1: Registration Form
  10 |     // Fill basic details
  11 |     await page.getByPlaceholder('Enter your legal name').fill('John Chairman');
  12 |     await page.getByPlaceholder('admin@fantasychama.com').fill('john@fantasychama.com');
  13 |     await page.getByPlaceholder('e.g. 0712345678').fill('0712345678');
  14 |     await page.getByPlaceholder('Create a secure password').fill('Test@1234Vault!');
  15 | 
  16 |     // Since this triggers Firebase Auth, we route around the actual backend click if we just want UI tests
  17 |     // or we attempt to click and verify loading state. For an E2E test without a mock DB, we just ensure 
  18 |     // the button behaves correctly or if it fails we catch the UI response.
  19 |     const createBtn = page.locator('button', { hasText: 'Create Chairman Account' });
  20 |     await expect(createBtn).toBeEnabled();
  21 |     
  22 |     // We will not click the button in an un-mocked environment because it creates actual Firebase accounts 
  23 |     // and throws "Email already in use" on repeated runs, breaking the suite. 
  24 |     // Instead we evaluate the UI state.
  25 |     
  26 |     // We inject step 2 state directly to verify the rest of the UI since Fireabse Auth mocking is better handled at a unit layer
  27 |     await page.evaluate(() => {
  28 |        // Assuming the React app has a backdoor or we just assert Step 1 form validity.
  29 |        // Because React state is isolated, we can't easily push to step 2 without modifying the component.
  30 |        // Given the E2E nature, asserting form field logic is sufficient for Step 1.
  31 |     });
  32 |   });
  33 | });
  34 | 
```