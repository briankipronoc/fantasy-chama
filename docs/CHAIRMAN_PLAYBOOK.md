# 👑 The Chairman's Playbook
*FantasyChama — League Governance Guide v3.0*

---

## Welcome, Chairman.

You are the backbone of your league. FantasyChama gives you institutional-grade tools to run a fully automated, fraud-proof FPL money league — with M-Pesa integration, real-time escrow tracking, and HQ-level financial oversight.

This guide walks you through every system, every button, and every rule.

---

## Part 1: Setting Up Your League

### Step 1 — Create Your Account
Navigate to [fantasychama.co.ke](https://fantasy-chama.vercel.app) → **Start a League**.

Choose a **League Template** to pre-fill your settings:
| Template | Players | Stake | Split |
|---|---|---|---|
| Classic 10-Man | 10 | KES 200/GW | 70/30 |
| Elite 5-Man | 5 | KES 500/GW | 80/20 |
| Big Money 15 | 15 | KES 150/GW | 65/35 |
| Custom | Your choice | — | — |

### Step 2 — Import Your FPL League
Paste your FPL league link. We'll automatically pull your entire member roster — names and entry IDs — so you don't manually type anything.

### Step 3 — Assign Phone Numbers
For each FPL manager, fill in their M-Pesa phone number. Members with **two FPL teams** can be listed twice using the same phone number — they get independent eligibility for every gameweek.

### Step 4 — Share the Access Code
You'll receive a **6-digit Access Code**. Drop it in your WhatsApp group. Members use this to self-enroll at `/invite`.

### Step 5 — Configure Season Vault Ladder
From setup/profile you can choose:
- Top 1
- Top 3
- Top 5
- Custom ratio ladder

Custom guardrails:
- Max setup projection size: **20 members**
- Max winner tiers: **10**
- Winner tiers cannot exceed **half of active members**

### Step 5 — Configure Season Vault Ladder
You can now choose:
- **Top 1**
- **Top 3**
- **Top 5**
- **Custom** (editable winner ratios)

Guardrails:
- Max league size supported in setup projections: **20 members**
- Max season winners: **10**
- Winners cannot exceed **half of league size**

---

## Part 2: The Command Center

Your dashboard (`/dashboard`) is a full financial command center. It shows:

- **Escrow Vault Balance** — total funds secured this season
- **Live GW Pot** — funds locked for this gameweek's winner
- **Master Ledger** — every member, their wallet balance, payment status, and payment streak 🔥
- **Master Invite Code** — share to let new members join
- **Live Escrow Feed** — real-time event log of every payment and resolution
- **Export Audit CSV** — one click to download a full financial audit spreadsheet

### Green Zone vs Red Zone
- **Green Zone ✅**: Member's wallet covers the current GW stake. They are eligible for the pot.
- **Red Zone ❌**: Wallet is empty. Member is excluded from this week's payout.

You can manually toggle any member's payment status if they've paid via Pochi and you've confirmed the receipt.

---

## Part 3: Resolving a Gameweek

When a Gameweek ends on the FPL website:

1. Go to your Command Center
2. Click the **⚡ Resolve Gameweek** button
3. The system automatically:
   - Deducts the stake from every paid member's wallet
   - Calculates the gross pot
   - Awards the 9% operational split (see below)
   - Identifies the highest-scoring FPL manager as the winner
   - Creates a **Pending Payout** for Co-Admin approval
   - Dispatches a **push notification** to all league members
   - Updates every member's **payment streak** badge
4. If you have a Co-Admin, they must click **Approve** before the M-Pesa B2C fires
5. The winner receives an M-Pesa B2C payment automatically

Resolution protection rules:
- Resolution is blocked while GW is still live.
- Resolution is blocked when winner points are `0`.
- A pending payout for the same GW cannot be created twice.

> **Payout Method Options:**
> - **M-Pesa B2C** — automatic, API-triggered. Fastest.
> - **Cash Handoff** — for manual settlements. You physically pay and log it.

Resolution safety checks now enforced:
- Resolve is blocked while GW is still live
- Resolve is blocked when winner points are `0`
- Duplicate pending approvals for the same GW are blocked
- Approval alerts are targeted to the correct signer (Co-Chair or Chairman)

If you use **Cash Handoff**, the payout is still written to ledger + live feed for audit continuity.

---

## Part 4: The 9% Transparent Economy

Every GW resolution, the gross pot is split algorithmically:

| Recipient | Rate | Notes |
|---|---|---|
| **🏆 Winner** | **91%** | Highest FPL points in the league |
| **👔 Chairman** | **4%** | Your governance fee (3% if Co-Chair exists) |
| **🏦 FPL Chama HQ** | **3.5%** | Platform operation & infrastructure |
| **📡 Network Fee** | **1.5%** | Safaricom B2C API buffer |
| **🤝 Co-Chair** | **1%** | Maker/Checker audit fee (from Chairman's share) |

Your 4% is automatically credited to your **wallet balance** in real-time. Check it in the **Finances** page and withdraw to M-Pesa anytime.

---

## Part 5: Paying HQ (The 48-Hour Window)

After every GW resolution, HQ's 3.5% share accumulates as a `pendingHQDebt` on your league.

### Your timeline:
1. **GW Resolves** → 48-hour window opens
2. **0–48 hours** → Yellow warning banner visible. Dashboard is fully functional.
3. **After 48 hours** → **Full blur lockout** activates. Your dashboard is frozen. Members see a suspension banner and can nudge you.
4. **To unlock**: Send the owed amount to **FPL Chama via Pochi La Biashara**. HQ manually verifies and lifts the suspension.

The exact amount owed is always displayed on the warning banner.

---

## Part 6: The Co-Chair System (Maker/Checker)

Promote any trusted member to Co-Chair:
1. Go to **Settings / Profile**
2. Find the member → Toggle to Admin role
3. They gain access to approve payouts on their Co-Admin dashboard

### Why this matters:
- No single person can release funds unilaterally
- Every payout leaves a permanent audit trail
- Co-Chair earns 1% per approved payout as a trustee fee

### Wallet Credit Requests
Members can ask for winnings to be credited into their wallet instead of withdrawing cash.
- These requests are stored as notifications and wallet-credit request records.
- Review the request amount and note, then either top up the wallet from winnings or reconcile manually.

---

## Part 7: The Referral Engine

Every league gets a unique **Referral Code** on your Command Center dashboard.

Share it with other FPL WhatsApp groups. When a new Chairman creates a league using your code, you earn a **0.5% bonus** on your next GW kickback — deposited automatically by the system.

---

## Part 8: Suspend or Remove a Member

On the Master Ledger:
- **Toggle Off** — marks a member Red Zone (excludes from pot)
- **Deactivate** — fully removes them from league eligibility

Deactivated members cannot participate in payouts but remain in the ledger for transparency.

---

## Part 9: Export & WhatsApp Sharing

After any GW resolves:
- Click **Export Audit CSV** — downloads a full member financial summary
- Click **Share WhatsApp Receipt** — copies a rich message to paste into your group showing the winner, payout, and 9% breakdown

Post both every GW to prove the math and build trust.

---

## Part 10: April 2026 Governance Update

- Season vault mode now supports **Top 1 / Top 3 / Top 5 / Custom**.
- Custom winner tiers are capped to half of active members and max 10 tiers.
- GW resolution now blocks if the week is still live or winner points are `0`.
- Approval routing now targets the correct signer (Co-Chair or Chairman).
