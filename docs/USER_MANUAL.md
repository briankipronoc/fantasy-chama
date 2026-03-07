# FantasyChama — Master User Manual

> **The definitive guide to running, playing, and deploying the platform.**  
> Version 1.0 · March 2026

---

## 📌 Table of Contents

1. [Platform Overview — The Pitch](#1-platform-overview--the-pitch)
2. [The Chairman's Guide — How to Run a League](#2-the-chairmans-guide--how-to-run-a-league)
3. [The Member's Guide — How to Play & Get Paid](#3-the-members-guide--how-to-play--get-paid)
4. [Developer Quickstart — Local Setup](#4-developer-quickstart--local-setup)

---

## 1. Platform Overview — The Pitch

**FantasyChama is a trustless, automated Escrow-as-a-Service for Kenyan Fantasy Premier League communities — powered by M-Pesa Daraja and the official FPL API.**

In a traditional Chama, the Chairman collects money manually, pays winners manually, and the group prays nobody runs. FantasyChama eliminates every single one of those failure points. Members deposit via M-Pesa STK Push. Balances are held in a tamper-proof Firestore Vault. Gameweek winners are identified automatically by querying the official Premier League servers. Payouts are wired via Safaricom B2C within seconds of Co-Admin approval. No spreadsheets. No WhatsApp arguments. No chasing.

### Core Philosophy

| Principle | What It Means |
|---|---|
| 🔐 **Zero Disputes** | Every deposit, deduction, and payout is logged immutably. Any member can audit the ledger in real-time. |
| 💸 **No Chasing Payments** | The Wallet Architecture auto-deducts the weekly stake. If a member's balance runs dry, they're flagged Red Zone automatically. |
| ⚡ **Automated Payouts** | The FPL Cron Job resolves standings. The Maker/Checker protocol routes the B2C payout. Safaricom delivers the cash. Chairman does nothing. |

---

## 2. The Chairman's Guide — How to Run a League

### Step 1 — Initialization

1. Visit the app and tap **"Start a League (Admin)"**
2. Complete the **Admin Setup** form:
   - **League Name** — e.g., "The Big League"
   - **Monthly Contribution (KES)** — the weekly wallet deduction per Gameweek (e.g., KES 200)
   - **Distribution Split** — e.g., `70 / 30` (70% Weekly Pot, 30% Season Vault)
   - **Season Vault Winners** — Top 1, Top 3, or Top 5 at GW38
3. Your account is created as `role: admin`. You will be taken to the **Chairman Hub**.

> 💡 The `Monthly Contribution` figure is deducted from each member's wallet every time you resolve a Gameweek. Members who pre-pay multiple rounds don't need to do anything for subsequent weeks.

---

### Step 2 — Linking Your FPL League

To enable live score resolution, you need your **FPL Classic League ID**.

**How to find it:**

1. Log in to [fantasy.premierleague.com](https://fantasy.premierleague.com)
2. Go to **Leagues** → click your private Classic League
3. Look at the browser URL. It will look like:

```
https://fantasy.premierleague.com/leagues/314/standings/c
                                          ^^^
                                  This is your League ID
```

4. Enter this number in **League Settings → FPL League ID** in the Chairman Hub.

> ⚠️ Only **Classic Leagues** are supported. H2H leagues use a different scoring format. The ID is typically a 3–6 digit number.

---

### Step 3 — Inviting Members

1. From the Chairman Hub, go to **Invite Hub**
2. You have two options:

| Method | How It Works |
|---|---|
| **Master Invite Code** | A static 6-digit PIN (e.g., `Y3A 3TI`). Share it via WhatsApp. Members enter it on the `/access` page. |
| **Expiring Invite Link** | Generates a time-limited URL (valid 48h). One-click join. Ideal for onboarding new members quickly. |

3. **Bulk Nudge** — tap this button to send a WhatsApp reminder to all Red Zone members with a direct payment link.

> 💡 Members only need to join once. After that, their wallet is their entry ticket for all subsequent gameweeks.

---

### Step 4 — Gameweek Resolution

#### Option A: Autopilot (Cron Job)
A cron job runs automatically at **10:00 AM EAT** on the day of each FPL deadline. It:
1. Checks if a deadline is within 24 hours
2. Queries the live FPL standings API
3. Identifies the highest-scoring **Green Zone** member (paid up)
4. Creates a `pending_payouts` document for Co-Admin review
5. Sends a notification to all members with the result

#### Option B: Manual Resolution (Chairman Hub)
1. Click **"Resolve Gameweek"** in the Chairman Hub
2. The system fetches live standings and calculates the winner
3. **If a Co-Admin is set:** A Maker/Checker request is sent. The Co-Admin must approve before any M-Pesa is dispatched.
4. **If no Co-Admin:** The B2C payout fires immediately to the winner's M-Pesa.

#### The Maker/Checker Protocol
- The **Chairman** triggers the payout → acts as **Maker**
- The **Co-Admin** reviews and approves → acts as **Checker**
- This dual-signature system means no single person can unilaterally move funds
- Set your Co-Admin from **League Settings → Co-Admin Phone Number**

#### After Resolution
- A **"Share to WhatsApp Group"** receipt card appears in the Operations Feed
- The receipt lists winner, payout amount, Green Zone members, and Red Zone flags
- Click **"Share to WhatsApp Group"** to open the pre-formatted message

---

## 3. The Member's Guide — How to Play & Get Paid

### 💰 The Wallet Architecture

FantasyChama does **not** ask you to pay every week manually. Instead:

1. You deposit a **lump sum** via M-Pesa STK Push (e.g., KES 2,000)
2. This credits your **Wallet Balance**
3. Every time the Chairman resolves a Gameweek, the system automatically deducts the **weekly stake** (e.g., KES 200) from your wallet
4. If your wallet has KES 2,000, you are pre-funded for **10 Gameweeks** without touching your phone again

**How to deposit:**
1. Go to your **Member Hub → Deposit**
2. Enter the amount and tap **"Pay with M-Pesa"**
3. An STK Push prompt appears on your phone
4. Enter your M-Pesa PIN
5. Your wallet balance updates within seconds — visible on your dashboard

---

### 🟢 Green Zone vs. 🔴 Red Zone

Your Zone is determined by your **Wallet Balance** at the moment of Gameweek resolution.

| Zone | Condition | Consequence |
|---|---|---|
| 🟢 **Green Zone** | `walletBalance >= weeklyStake` | You are eligible. If you score highest, you win the pot. |
| 🔴 **Red Zone** | `walletBalance < weeklyStake` | You are **ineligible** for that week's payout, regardless of your FPL score. |

> **The critical rule:** If you are the highest FPL scorer in a given Gameweek but your wallet is in the Red Zone, **you forfeit the pot**. The winnings go to the next highest-scoring member who is in the Green Zone.

**The Red Zone banner** on your dashboard is intentionally aggressive — it will stay pinned at the top of your screen until you top up. This is by design.

---

### 💬 Claiming a Disputed Payment

If you paid via M-Pesa but the app didn't update (network drop, webhook failure), **do not panic**:

1. Open your M-Pesa messages and find the **Transaction Code** (e.g., `QKL7A2XPDS`)
2. Go to **Member Hub → Profile → Claim Payment**
3. Enter the receipt code and amount
4. Your claim is flagged to the Chairman for review
5. Once the Chairman verifies and approves, your wallet is manually credited

> The Firestore Security Rules prevent any member from self-approving their own claim. Only the Chairman or Co-Admin can move wallet balances. Your receipt code is the proof.

---

## 4. Developer Quickstart — Local Setup

### Prerequisites

- Node.js 18+
- Firebase project (Firestore + Authentication enabled)
- Safaricom Daraja Sandbox account ([developer.safaricom.co.ke](https://developer.safaricom.co.ke))
- `serviceAccountKey.json` from Firebase Console → Project Settings → Service Accounts

---

### Step 1 — Clone & Install

```bash
git clone https://github.com/briankipronoc/fantasy-chama.git
cd fantasy-chama
npm install
```

---

### Step 2 — Environment Variables

Create a `.env` file in the project root:

```bash
# ── Firebase (Frontend) ────────────────────────────────────────
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# ── Backend API URL ────────────────────────────────────────────
VITE_API_URL=http://localhost:5000

# ── Daraja (Sandbox) ───────────────────────────────────────────
DARAJA_CONSUMER_KEY=your_sandbox_consumer_key
DARAJA_CONSUMER_SECRET=your_sandbox_consumer_secret
DARAJA_SHORTCODE=174379
DARAJA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
DARAJA_CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/mpesa/callback

# ── FPL API ────────────────────────────────────────────────────
FPL_API_BASE=https://fantasy.premierleague.com/api
```

> ⚠️ Never commit `.env` to Git. The `.gitignore` already excludes it.

---

### Step 3 — Place Firebase Service Account

Download `serviceAccountKey.json` from:
> Firebase Console → ⚙️ Project Settings → Service Accounts → Generate New Private Key

Place it in the **project root** (same level as `server.js`). It is already in `.gitignore`.

---

### Step 4 — Run the Application

Open **two terminal windows**:

```bash
# Terminal 1 — Express Backend (port 5000)
node server.js

# Terminal 2 — Vite Frontend (port 5173)
npm run dev
```

Visit `http://localhost:5173` — you'll see the landing page.

---

### Step 5 — Test the Wallet Flow Locally

```bash
# Fill in your LEAGUE_ID and member UIDs in the script first
node scripts/simulate_wallet.mjs
```

This runs the full 4-step simulation:
1. 🐳 Whale deposit (simulated STK callback)
2. ⚙️ GW resolution + wallet deduction
3. 🔴 Red Zone flag verification
4. 📲 WhatsApp receipt generation

See [`scripts/simulate_wallet.mjs`](../scripts/simulate_wallet.mjs) for configuration.

---

### Key Files Reference

| File | Purpose |
|---|---|
| `server.js` | Express backend: Daraja STK/B2C, wallet routes, cron jobs |
| `src/pages/AdminCommandCenter.tsx` | Chairman Hub — GW resolution, ledger, Co-Admin |
| `src/pages/MemberDashboard.tsx` | Member Hub — wallet, live feed, action required banner |
| `src/components/NotificationProvider.tsx` | 4-tier notification engine |
| `src/pages/LandingPage.tsx` | Public storefront (unauthenticated `/`) |
| `firestore.rules` | Security rules — walletBalance/transactions hard-locked |
| `docs/daraja_go_live_playbook.md` | Step-by-step guide to flip Sandbox → Production |
| `scripts/simulate_wallet.mjs` | Local end-to-end wallet simulation script |

---

### Deployment

| Service | Platform | Notes |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | Connect GitHub repo, set `VITE_*` env vars in Vercel dashboard |
| **Backend** | [Render](https://render.com) | Web Service, Node 18, start command: `node server.js`, set all non-`VITE_` vars |
| **Database** | Firebase Firestore | Already cloud-hosted, no extra deployment needed |
| **Rules** | Firebase Console | Paste `firestore.rules` → Rules → Publish, or run `firebase deploy --only firestore:rules` |

---

*FantasyChama · Built for the serious Kenyan FPL Chama · March 2026*
