# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Member Login Flow >> Should allow a member to input invite code and phone
- Location: tests/login.spec.ts:5:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/login
Call log:
  - navigating to "http://localhost:5173/login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Member Login Flow', () => {
  4  | 
  5  |   test('Should allow a member to input invite code and phone', async ({ page }) => {
  6  |     // Navigate to Login URL
> 7  |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/login
  8  |     
  9  |     // The member login view uses OTP digits. We can paste a code.
  10 |     // If we type into the page, the onKeyDown/onChange might pick it up, or we target the first OTP box.
  11 |     // In our component, if a user focuses on the first input and pastes, the handlePaste triggers.
  12 |     
  13 |     // Get the phone input
  14 |     const phoneInput = page.getByPlaceholder('e.g. 0712345678').first();
  15 |     await phoneInput.fill('0799999999');
  16 |     
  17 |     // Ensure the Join Button exists
  18 |     const joinBtn = page.locator('button', { hasText: 'Verify & Join' }).or(page.locator('button', { hasText: 'Secure Login' })).or(page.locator('button', { hasText: /Join/i }));
  19 |     
  20 |     // Verify the UI rendered successfully
  21 |     await expect(phoneInput).toBeVisible();
  22 |     await expect(joinBtn).toBeVisible();
  23 |   });
  24 | });
  25 | 
```