# FantasyChama — Master System Blueprint v3.1
*Last updated: April 2026 — Chairman command flow refresh*

---

## 1. Core Tech Stack & Infrastructure

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite, React Router v6, Zustand, Tailwind CSS v4 |
| **Backend** | Node.js + Express (CommonJS/ESM), hosted on Render |
| **Database** | Firebase Firestore (NoSQL, real-time listeners) |
| **Auth** | Firebase Authentication (phone OTP + email/password hybrid) |
| **Payments** | Safaricom Daraja API — STK Push (inflow) + B2C (outflow) + Transaction Status Query |
| **Live FPL Data** | Official Premier League FPL REST API (polling via server cron) |
| **Push Notifications** | Firebase Cloud Messaging (FCM) — foreground + background push via Service Worker |
| **Scheduling** | `node-cron` — automated FPL polling, payment reminders, churn recovery |
| **Monitoring** | Sentry (error tracking + alerting) |
| **Input Validation** | Zod schema validation on all critical backend routes |
| **Rate Limiting** | `express-rate-limit` on STK Push, B2C, and resolution endpoints |
| **Deployment** | Frontend: Vercel, Backend: Render, DB: Firestore managed |

---

## 2. Database Schema (Firestore)

### Root Collections

#### `leagues/{leagueId}`
```
inviteCode, leagueName, gameweekStake, chairmanId, coAdminId,
fplLeagueId, rules { weekly, vault, seasonWinnersCount },
pendingHQDebt, isSuspended, lastResolvedDate (Timestamp),
referralCode, suspensionNudges[]
```

#### `userLeagues/{phone}`
Multi-league index — enables a single phone to belong to multiple leagues.
```
leagues: [ { leagueId, leagueName, role } ]
```

#### `platform_treasury/{docId}`
HQ revenue log — ledgered monthly settlement cycle.
```
leagueId, leagueName, monthKey, settlementWindow,
platformDueAmount, platformPaidAmount, status, receiptCode, timestamp
```

#### `referrals/{code}`
```
referrerLeagueId, referrerChairmanId, redeemedByLeagueId, timestamp
```

---

### League Subcollections

#### `memberships/{memberId}`
```
displayName, phone, role ('admin' | 'member'), walletBalance,
hasPaid, missedGameweeks, isActive, fplTeamId, secondFplTeamId,
avatarSeed, lastLoginAt, hasAcceptedRules, totalEarned,
paymentStreak, fcmToken, authUid
```

#### `transactions/{txId}`
```
type ('deposit' | 'payout' | 'kickback_withdrawal' | 'wallet_funding'),
amount, receiptId, phoneNumber, winnerName, winnerPhone,
mpesaCode, settlementChannel ('mpesa' | 'cash'), cashHandoffDate,
note, timestamp, gameweek
```

#### `league_events/{eventId}`
Live Escrow Feed. Powers the real-time activity ticker.
```
eventType ('payment' | 'resolution' | 'info'), message, actor, timestamp
```

#### `disputes/{disputeId}`
Payment confirmation claims (Pochi La Biashara manual receipts).
```
memberId, memberName, phone, receiptCode, amount, status, timestamp
```

#### `notifications/{notifId}`
Bell inbox. Persistent cross-session alerts.
```
type ('info' | 'warning' | 'success' | 'transactionSuccess'),
message, timestamp, readBy[], targetMemberId, isWinnerEvent
```

#### `pending_payouts/{payoutId}`
Maker/Checker queue. Payouts must be Co-Admin approved.
```
winnerId, winnerName, amount, status ('awaiting_approval' | 'approved' | 'rejected'),
gw, gwName, points, payoutMethod ('mpesa' | 'cash'),
method ('mpesa' | 'cash'), cashHandoffDate, approvalTarget
```

#### `winner_confirmations/{confId}`
Winner acknowledgment receipts (Pochi receipt confirmation).
```
winnerId, amount, receiptId, status ('pending_confirmation' | 'confirmed')
```

#### `wallet_topup_requests/{requestId}`
Chairman wallet credit requests raised from member winnings or manual reconciliation.
```
memberId, memberName, amount, note, status ('pending' | 'approved' | 'rejected'),
source ('winnings_request' | 'manual'), requestedAt, requestedById, targetMemberId
```

---

## 3. The Financial Engine (9% Transparent Economy)

### Per-GW Resolution Flow

```
Gross Pot = paidMembers × gameweekStake

  91% → Weekly Winner (B2C via Safaricom Daraja)
   4% → Chairman Governance Fee (wallet credit)
   3.5% → FantasyChama HQ Platform Fee (Pochi La Biashara)
   1.5% → M-Pesa Telecom Network Buffer
   
   * If Co-Chair active:
     Chairman drops to 3%, Co-Chair earns 1% from Chairman's share
```

### Inflow (Member Deposits)
1. Member triggers STK Push → Safaricom pings phone
2. Safaricom success webhook (`ResultCode: 0`) → backend atomically:
   - Sets `hasPaid = true`
   - Increments `walletBalance`
   - Logs `transaction` doc
   - Appends to `league_events`
   - Increments `paymentStreak`

### GW Resolution
1. Chairman clicks Resolve → `/api/league/deduct-gw-cost`
2. Batch write deducts stake from all wallets
3. 9% split calculated and distributed
4. `paymentStreak` updated per member (increment or reset to 0)
5. `lastResolvedDate` stamped → starts 48h HQ debt clock
6. FCM push dispatched to all league members
7. Winner payout created in `pending_payouts`

### Outflow (Disbursement)
- Co-Admin approves pending payout → Daraja B2C fires
- `winner_confirmations` created for winner to acknowledge receipt

### HQ Revenue Cycle (Monthly Settlement Window)
- HQ dues still accrue from GW operations, but operational settlement is now monthly.
- Settlement is expected at month-end (last GW of the month) or early next month.
- The HQ step appears in the Resolution Timeline only during the monthly window or when debt/submission exists.
- Within grace: yellow warning banner on Chairman dashboard with receipt form.
- After grace expiry on unpaid debt: full blur lockout on Chairman + red banner for all members.

### Chairman Command Surface (Overview)
- The Overview now carries the full Master Invite Card (code, WhatsApp share, regenerate placeholder).
- Resolution Timeline tiles are tappable and route to the exact workflow queue.
- Completed timeline tiles glow, and a Return to Overview action appears when cycle steps are complete.
- Pending payout approval supports both M-Pesa dispatch and direct cash handoff, with ledger write-through.

### Deployment Contract
- Frontend must set `VITE_API_URL` to the public Render backend URL in production.
- Vercel should never point at `localhost` for payment calls.
- Backend remains the single source of truth for STK push, B2C, and GW deduction.

---

## 4. Automation & Governance Engine

### Cron Jobs (server.js)
| Schedule | Job | Description |
|---|---|---|
| Every 30 min | FPL Autopilot | Polls FPL API; if `data_checked=true`, calculates winner, auto-creates `pending_payouts` |
| 10:00 AM EAT | Payment Reminder | Finds unpaid members, sends WhatsApp-style SMS warnings |
| 15:00 EAT | Churn Recovery | Detects members `lastLoginAt > 10 days`, issues re-engagement alerts |

### Multi-Admin Roles
- `role: 'admin'` — Chairman and Co-Chair. Full command access.
- `role: 'member'` — Standard league participant.
- Chairman is identified by `chairmanId` field on the league document.
- Co-Chair is identified by `coAdminId`.

### Maker/Checker Protocol
Every payout requires:
1. Chairman creates a pending payout
2. Co-Admin must electronically approve it
3. Only then does the backend fire B2C
- Prevents unilateral chairman fraud

### Payment Streaks
- `paymentStreak` increments automatically per on-time GW payment
- Resets to `0` on any missed GW
- Displayed as 🔥 badge in the Chairman's ledger and Member dashboard

---

## 5. Push Notification Architecture (FCM)

### How It Works
1. On app load, `useFCMToken()` hook runs in `App.tsx`
2. Requests browser notification permission
3. Registers Service Worker (`public/firebase-messaging-sw.js`)
4. Gets FCM device token → saved to `memberships/{id}.fcmToken`
5. Backend `/api/notify` endpoint sends to any array of FCM tokens

### Notification Triggers
| Event | Recipient |
|---|---|
| GW resolved + winner announced | All league members |
| Member drops to Red Zone | That member only |
| Payout dispatched | Winner only |
| Co-Admin approval needed | Co-Admin only |
| HQ suspension triggered | Chairman only |

---

## 6. UI/UX Architecture

### Visual Design System
- **Base**: `#0a0e17` deep navy, `#0b1014` panel backgrounds
- **Primary Green**: `#10B981` — payments verified, Green Zone
- **Champion Gold**: `#FBBF24` — winners, payouts, admin kickbacks
- **Typography**: Satoshi (headings) + Inter (body)
- **Glassmorphism**: `backdrop-blur-xl` + `bg-white/5` panels throughout
- **Dark/Light Toggle**: `data-theme` attribute on `<html>` with full CSS var overrides

### Key UX Patterns
- **Golden Dashboard**: When the user IS the current GW winner, the entire background shifts gold
- **Stealth Mode**: Toggle that replaces all KES values with `****`
- **4-Tier Notifications**: Toast → Static Banner → Bell Inbox → FCM Push
- **League Switcher**: Header component — only appears for multi-league users
- **Trust Slider**: Landing page interactive breakdown of 91/9 fee split (max KES 30,000)
- **OG Win Share**: `/win?...` page with full OG meta tags for WhatsApp/Twitter preview

### Page Inventory
| Route | Component | Access |
|---|---|---|
| `/` | `LandingPage` | Public |
| `/login` | `Login` | Public |
| `/setup` | `AdminSetup` | Public (Chairman) |
| `/invite` | `InviteHub` | Public (Member) |
| `/dashboard` | `AdminCommandCenter` / `MemberDashboard` | Auth |
| `/finances` | `Finances` | Auth |
| `/standings` | `Standings` | Auth |
| `/profile` | `Profile` | Auth |
| `/deposit` | `Deposit` | Auth |
| `/rules` | `PayoutRules` | Auth |
| `/win` | `WinSharePage` | Public |
| `/hq` | `SuperAdminDashboard` | Super Admin |
| `/terms` | `Terms` | Public |
| `/privacy-policy` | `PrivacyPolicy` | Public |
| `/faq` | `FAQ` | Public |

---

## 7. Revenue Model Summary

| Recipient | Rate | Condition |
|---|---|---|
| **GW Winner** | **91%** | Highest FPL points in the league |
| **FantasyChama HQ** | **3.5%** | Platform operation fee |
| **Chairman** | **4%** | Governance fee (3% if Co-Chair active) |
| **Co-Chair** | **1%** | Maker/Checker audit fee (from Chairman's share) |
| **M-Pesa Network** | **1.5%** | Safaricom telecom API processing buffer |

Season Vault: 30% of all weekly pots accumulate into a season-end prize pool.
