# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: access-control.spec.ts >> Access Control Protections >> Should not allow Standard Member to view Admin Setup
- Location: tests/access-control.spec.ts:4:3

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "/dashboard"
Received string:    "http://localhost:5173/login"
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic:
    - img
  - generic [ref=e4]:
    - generic [ref=e9]: FANTASY CHAMA
    - generic [ref=e10]:
      - img [ref=e11]
      - generic [ref=e13]: Secure Wealth Circle
  - generic [ref=e14]:
    - generic [ref=e15]:
      - heading "Enter the League" [level=1] [ref=e16]
      - paragraph [ref=e17]: Exclusive access for high-stakes wealth management
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]: M-Pesa Phone Number
        - generic [ref=e21]:
          - img [ref=e22]
          - textbox "e.g. 0712345678" [ref=e24]
      - generic [ref=e25]:
        - generic [ref=e26]: League Invite Code
        - generic [ref=e27]:
          - textbox [ref=e28]
          - textbox [ref=e29]
          - textbox [ref=e30]
          - textbox [ref=e31]
          - textbox [ref=e32]
          - textbox [ref=e33]
        - paragraph [ref=e34]: "Tip: paste a copied code to auto-fill all boxes instantly"
        - paragraph [ref=e35]: Required for Entry
      - button "JOIN LEAGUE" [disabled] [ref=e36]:
        - text: JOIN LEAGUE
        - img [ref=e37]
    - generic [ref=e41]: Authorized Personal Only
  - button "Chairman Access" [ref=e43]:
    - img [ref=e44]
    - text: Chairman Access
  - paragraph [ref=e47]: © 2026 Fantasy Chama Global Wealth Management. All Rights Reserved.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Access Control Protections', () => {
  4  |   test('Should not allow Standard Member to view Admin Setup', async ({ page }) => {
  5  |     // Navigate to the app
  6  |     await page.goto('/');
  7  | 
  8  |     // Inject "Standard Member" context via localStorage (BOLA simulation)
  9  |     await page.evaluate(() => {
  10 |       localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
  11 |       localStorage.setItem('activeUserId', 'TEST_MEMBER_123');
  12 |        // Notice we are NOT setting 'role' to 'admin'
  13 |     });
  14 | 
  15 |     // Attempt to access setup route
  16 |     await page.goto('/setup');
  17 |     await page.waitForLoadState('networkidle');
  18 | 
  19 |     // Setup is theoretically accessible ONLY if league is missing OR if you are setting up something.
  20 |     // If the system has auth routing logic, it should redirect away.
  21 |     // Let's assert we don't see the "Chairman Setup" text
  22 |     const setupText = await page.getByText('Admin Setup', { exact: false }).isVisible();
  23 |     
  24 |     // In our app model, /setup redirect happens if activeLeagueId exists already
  25 |     // so we should be pushed to the member dashboard.
> 26 |     expect(page.url()).toContain('/dashboard');
     |                        ^ Error: expect(received).toContain(expected) // indexOf
  27 |   });
  28 | 
  29 |   test('Should block Standard Member from Admin Command Center', async ({ page }) => {
  30 |     await page.goto('/');
  31 | 
  32 |     // Inject "Standard Member" context via localStorage
  33 |     await page.evaluate(() => {
  34 |       localStorage.setItem('activeLeagueId', 'TEST_LEAGUE_123');
  35 |       localStorage.setItem('activeUserId', 'TEST_MEMBER_123');
  36 |       localStorage.setItem('role', 'member'); 
  37 |     });
  38 | 
  39 |     // Navigate to the command center directly
  40 |     await page.goto('/command-center');
  41 | 
  42 |     // Wait and evaluate where the router sends us
  43 |     await page.waitForLoadState('networkidle');
  44 | 
  45 |     // The router should rebound a member back to the main dashboard or show access denied
  46 |     expect(page.url()).not.toContain('/command-center');
  47 |   });
  48 | });
  49 | 
```