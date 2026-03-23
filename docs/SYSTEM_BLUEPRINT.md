# Fantasy Chama — Master System Blueprint

## 1. Core Tech Stack & Infrastructure
*   **Frontend**: React (Vite bundler), React Router DOM, Zustand (Global State Management), Tailwind CSS.
*   **Backend**: Node.js, Express.
*   **Database**: Firebase Firestore (NoSQL Document Store).
*   **APIs**:
    *   Safaricom Daraja API (STK Push for collections, B2C for disbursements, Transaction Query for disputes).
    *   Fantasy Premier League (FPL) API (Automated polling for gameweek status and points).
*   **Task Scheduling**: `node-cron` for automated reminders, retentions, and autopilot calculations.
*   **CORS Proxy**: `corsproxy.io` for reliable client-side FPL API requests.

## 2. Database Schema (Firestore)
The application relies on a hierarchical schema centered around `leagues`.

*   **`leagues`** (Root Collection)
    *   `inviteCode` (string), `leagueName` (string), `gameweekStake` (number), `chairmanId` (string), `coAdminId` (string), `fplLeagueId` (number), `rules` (object: `{ weekly, vault, seasonWinnersCount }`).
*   **`memberships`** (Subcollection under League)
    *   `displayName`, `phone`, `role` (`'admin' | 'member'`), `walletBalance` (number), `hasPaid` (boolean), `missedGameweeks` (number), `isActive` (boolean), `fplTeamId` (number — binds the FPL Entry ID directly to the user for deterministic matching), `fplTeamName`, `lastLoginAt` (timestamp), `avatarSeed`.
*   **`transactions`** (Subcollection under League)
    *   `type` (`'deposit' | 'payout'`), `amount` (number), `receiptId` (string), `phoneNumber`, `winnerName`, `winnerPhone`, `timestamp`.
*   **`league_events`** (Subcollection under League)
    *   `eventType` (`'payment' | 'resolution' | 'info'`), `message`, `actor`, `timestamp`. Drives the Live Escrow feed.
*   **`disputes`** (Subcollection under League)
    *   `memberId`, `memberName`, `phone`, `receiptCode`, `amount`, `status`, `timestamp`.
*   **`notifications`** (Subcollection under League)
    *   `type` (`'info' | 'warning' | 'success'`), `message`, `timestamp`, `readBy` (array). Drives bell inbox and system-wide alerts.
*   **`pending_payouts`** (Subcollection under League)
    *   `winnerId`, `winnerName`, `amount`, `status` (`'awaiting_approval' | 'approved' | 'rejected'`), `gw`, `gwName`, `points`. Used for Maker/Checker logic.
*   **`winner_confirmations`** (Subcollection under League)
    *   `winnerId`, `amount`, `receiptId`, `status` (`'pending_confirmation' | 'confirmed'`).
*   **`mpesa_requests` / `b2c_requests`** (Root Collections)
    *   Temporary webhook mapping for Safaricom async callbacks.
*   **`platform_treasury`** (Root Collection)
    *   `leagueId`, `leagueName`, `gameweek`, `grossPot`, `mpesaFee`, `chairmanCut`, `coAdminCut`, `platformNetRevenue`, `timestamp`.

## 3. The Financial Flow (The Ledger)
1.  **Inflow (Collection):** A member triggers an STK Push. Upon Safaricom success webhook (`ResultCode: 0`), the backend atomically updates: `hasPaid = true`, increments `walletBalance`, saves a `transaction` record, and appends to `league_events`.
2.  **Drain (Gameweek Resolution):** The backend hits `/api/league/deduct-gw-cost`, deducting GW costs from all members via Batch Write. The 10% Escrow Rake splits: 5.0% Platform Revenue, 1.5% Safaricom Fee, 3.5% Governance Kickback (2.5% Chairman + 1.0% Co-Admin when present, 3.5% solo otherwise). Chairman/Co-Admin wallets are atomically incremented.
3.  **Outflow (Disbursement):** Chairman selects the winner → `pending_payouts`. Co-Admin reviews and approves → Daraja B2C fires → `winner_confirmations` created for the winner to confirm receipt.

## 4. Automation & Governance
*   **Multi-Admin & Roles**: `role: 'admin' | 'member'` flag on memberships. Chairman can promote members to admin.
*   **Maker/Checker System**: Payouts require Co-Admin counter-signature to prevent single-point failure.
*   **Cron Job Engine (`server.js`)**:
    *   **FPL Autopilot**: Polls FPL API. If `data_checked = true`, calculates winner and auto-generates a pending payout.
    *   **Warning Nudges (10:00 AM EAT)**: Finds unpaid members near FPL deadline, sends emergency warnings.
    *   **Churn Recovery (15:00 EAT)**: Detects `lastLoginAt > 10 days` members, issues recovery alerts.

## 5. UI/UX Architecture
*   **Visual Language**: Dark fintech motif with "Mystic Void" gradients. Green `#10B981` for verifications, Gold `#FBBF24` for champions.
*   **Golden Dashboard Experience**: When the logged-in member IS the current GW winner, the entire dashboard background shifts to a gold gradient with ambient glow effects and a personal celebration card.
*   **Winner's Circle**: Expandable panel showing all historical GW champions with points and aggregate stats (Total GWs Won, Unique Winners).
*   **FPL Team Selector**: Profile dropdown that fetches live FPL standings, letting users bind their exact FPL Entry ID to their Firestore profile. The Standings matcher prioritizes `fplTeamId` over fuzzy name matching.
*   **End of Season Projections**: Dynamic visualization on Standings page showing vault distribution based on the league's `seasonWinnersCount` setting.
*   **4-Tier Notification Hierarchy**:
    1.  **Toasts**: Ephemeral auto-dismissing popups.
    2.  **Live Feed**: Real-time `league_events` stream.
    3.  **Static Banners**: Critical un-closable containers (Red Zone, Winner Confirmation).
    4.  **Bell Inbox**: Persistent cross-session Firestore notifications.

## 6. Revenue Model (10% Escrow Rake)
Per GW resolution, the gross pot is taxed 10%:
| Recipient | Solo | With Co-Admin |
|---|---|---|
| Platform | 5.0% | 5.0% |
| Safaricom API | 1.5% | 1.5% |
| Chairman | 3.5% | 2.5% |
| Co-Admin | 0.0% | 1.0% |

The remaining 90% is the **Net Member Pot**, split into Weekly Pot (default 70%) and Season Vault (default 30%).
