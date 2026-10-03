import { test, expect } from '@playwright/test';

test.describe('Member Login Flow', () => {

  test('Should allow a member to input invite code and phone', async ({ page }) => {
    // Navigate to Login URL
    await page.goto('/login');
    
    // The member login view uses OTP digits. We can paste a code.
    // If we type into the page, the onKeyDown/onChange might pick it up, or we target the first OTP box.
    // In our component, if a user focuses on the first input and pastes, the handlePaste triggers.
    
    // Get the phone input
    const phoneInput = page.getByPlaceholder('0712 345 678').or(page.getByPlaceholder('e.g. 0712345678 or chairman@domain.com')).first();
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    // Ensure the Enter League or Login Button exists
    const enterBtn = page.locator('button', { hasText: /Enter League|Login|Verify|Join/i }).first();
    await expect(enterBtn).toBeVisible();
  });
});
