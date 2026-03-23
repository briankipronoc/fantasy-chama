# Fantasy Chama — Master System Blueprint

## 1. Core Tech Stack & Infrastructure
*   **Frontend**: React (Vite bundler), React Router DOM, Zustand (Global State Management), Tailwind CSS.
*   **Backend**: Node.js, Express.
*   **Database**: Firebase Firestore (NoSQL Document Store).
*   **APIs**:
    *   Safaricom Daraja API (STK Push for collections, B2C for disbursements, Transaction Query for disputes).
    *   Fantasy Premier League (FPL) API (Automated polling for gameweek status and points).
*   **Task Scheduling**: `node-cron` for automated reminders, retentions, and autopilot calculations.

## 2. Database Schema (Firestore)
The application relies on a hierarchical schema centered around `leagues`.

*   **`leagues`** (Root Collection)
    *   `inviteCode` (string), `leagueName` (string), `gameweekStake` (number), `chairmanId` (string), `coAdminId` (string), `rules` (object).
*   **`memberships`** (Subcollection under League)
    *   `displayName`, `phone`, `role` (`'admin' | 'member'`), `walletBalance` (number - tracking accumulated deposits), `hasPaid` (boolean - true if wallet covers next GW), `missedGameweeks` (number), `isActive` (boolean), `fplTeamName`, `lastLoginAt` (timestamp).
*   **`transactions`** (Subcollection under League)
    *   `type` (`'deposit' | 'payout'`), `amount` (number), `receiptId` (string), `phoneNumber`, `timestamp`.
*   **`league_events`** (Subcollection under League)
    *   `eventType` (`'payment' | 'resolution' | 'info'`), `message`, `actor`, `timestamp`. Drives the Live Escrow feed.
*   **`disputes`** (Subcollection under League)
    *   `memberId`, `memberName`, `phone`, `receiptCode`, `amount`, `status`, `timestamp`.
*   **`pending_payouts`** (Subcollection under League)
    *   `winnerId`, `winnerName`, `amount`, `status` (`'awaiting_approval' | 'approved' | 'rejected'`), `gw`, `gwName`, `points`. Used for Maker/Checker logic.
*   **`winner_confirmations`** (Subcollection under League)
    *   `winnerId`, `amount`, `receiptId`, `status` (`'pending_confirmation' | 'confirmed'`).
*   **`mpesa_requests` / `b2c_requests`** (Root Collections)
    *   Temporary webhook mapping for Safaricom async callbacks.
*   **`platform_treasury`** (Root Collection)
    *   `leagueId`, `leagueName`, `gameweek`, `grossPot` (number), `mpesaFee` (number), `chairmanCut` (number), `coAdminCut` (number), `platformNetRevenue` (number), `timestamp`. Logs every single atomic division of the 10% Escrow fee for the global Super Admin UI.

## 3. The Financial Flow (The Ledger)
1.  **Inflow (Collection):** A member triggers an STK Push. Upon Safaricom success webhook (`ResultCode: 0`), the backend fires an atomic update: giving the member `hasPaid = true`, incrementing their `walletBalance` by the exact confirmed amount, saving a permanent `transaction` record, and appending a `payment` record to the `league_events` feed.
2.  **Drain (Gameweek Resolution):** At the end of a gameweek, the backend hits `/api/league/deduct-gw-cost`. This iterates over all active memberships via a Firestore Batch Write, deducting the gameweek cost from their `walletBalance`. The system calculates the Gross Pot and divides the 10% Escrow Rake: 5.0% Platform Revenue, 1.5% Safaricom Fee, and a 3.5% Governance Kickback (split 2.5% to Chairman and 1.0% to Co-Admin if one exists, otherwise 3.5% solo). Chairman and Co-Admin wallets are atomically incremented with these earnings. If a member's `newBalance < cost`, they instantly fall into the Red Zone.
3.  **Outflow (Disbursement):** The Chairman (or FPL Autopilot) selects a winner, moving the payout to `pending_payouts`. A Co-Admin reviews and hits "Approve". This triggers the Daraja B2C endpoint. The backend webhook confirms dispersion and immediately places a document in `winner_confirmations`, displaying a static action banner to the Champion so they can officially confirm physical receipt of funds.

## 4. Automation & Governance
*   **Multi-Admin & Roles**: Control relies on the `role: 'admin' | 'member'` flag attached to `memberships`. The active Chairman can promote other users to `admin` granting them Command Center read/write access.
*   **Maker/Checker System**: Single-point failure is eliminated. Payouts initiated by the Chairman explicitly require a second `admin` to counter-sign and approve.
*   **Cron Job Engine (`server.js`)**:
    *   **FPL Autopilot (`runFPLAutopilot`)**: Polls FPL API constantly. If a gameweek finishes and `data_checked = true`, it calculates the winner, logs the amount, and auto-generates a Maker/Checker pending payout request.
    *   **Warning Nudges (`runDailyReminder`)**: Runs at 10:00 AM EAT. If an FPL deadline is approaching within 24–48 hours, the server finds all `hasPaid == false` members and blasts an in-app emergency warning directing them to STK pay.
    *   **Churn Recovery (`runRetentionEmailJob`)**: Runs at 15:00 EAT. Detects members whose `lastLoginAt` exceeds 10 days, issuing recovery emails ("Hey, still there?") and triggering soft notifications.

## 5. UI/UX Architecture
*   **Visual Language**: The platform uses a high-end, dark fintech motif featuring "Mystic Void" / "Sea by Night" gradients. Attention maps focus heavily around specific accent colors—Irradiated Toad/Avocado Smoothie green (`#10B981`) for successful verifications and balances, alongside Gold/Amber (`#FBBF24`) for champions and secondary warnings. Typography enforces sleek legibility using sans-serif/Helvetica stacks.
*   **4-Tier Notification Hierarchy**:
    1.  **Toasts**: Ephemeral auto-dismissing popups for immediate action feedback (e.g., "Link Copied!").
    2.  **Live Feed**: A completely real-time updating list for system-wide transparency (deposits, resolutions).
    3.  **Static Headers / To-Do Banners**: High-priority, un-closable containers directly at the top of the dashboard specifically engineered for critical operational blockage (e.g., Red Zone Debt, Winner Confirmations).
    4.  **Bell Inbox (Firestore Notifications)**: Persistent cross-session alerts for warnings and system outputs.
