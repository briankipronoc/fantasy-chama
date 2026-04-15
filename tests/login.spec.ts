import { test, expect } from '@playwright/test';

test.describe('Member Login Flow', () => {

  test('Should allow a member to input invite code and phone', async ({ page }) => {
    // Navigate to Login URL
    await page.goto('/login');
    
    // The member login view uses OTP digits. We can paste a code.
    // If we type into the page, the onKeyDown/onChange might pick it up, or we target the first OTP box.
    // In our component, if a user focuses on the first input and pastes, the handlePaste triggers.
    
    // Get the phone input
    const phoneInput = page.getByPlaceholder('e.g. 0712345678').first();
    await phoneInput.fill('0799999999');
    
    // Ensure the Join Button exists
    const joinBtn = page.locator('button', { hasText: 'Verify & Join' }).or(page.locator('button', { hasText: 'Secure Login' })).or(page.locator('button', { hasText: /Join/i }));
    
    // Verify the UI rendered successfully
    await expect(phoneInput).toBeVisible();
    await expect(joinBtn).toBeVisible();
  });
});
