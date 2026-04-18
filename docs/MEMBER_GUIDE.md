# 🧍 The Member's Field Guide
*FantasyChama — Player Reference v3.0*

---

## Welcome to the League.

Your Chairman has set up a FantasyChama league. This guide tells you everything you need to know to join, deposit, track your standing, and collect your winnings.

---

## Part 1: Joining the League

### Step 1 — Get the Access Code
Your Chairman will share a **6-digit Access Code** in your WhatsApp group.

### Step 2 — Navigate to the Invite Page
Go to [fantasychama.co.ke](https://fantasy-chama.vercel.app) → **Join a League** → enter your code.

### Step 3 — Accept the League Constitution
Before gaining full access, you must read and confirm you accept the league rules. This is a one-time step.

### Step 4 — Link Your FPL Team
Go to **Profile** → link your exact FPL team identity. This is how the system knows when *you* win.

> **Playing with two FPL teams?** Both are independently eligible! Your Chairman can register both entries under your phone number, giving you double the chance to win each gameweek.

---

## Part 2: Funding Your Wallet

### M-Pesa STK Push (Recommended)
1. Go to **Deposit** on the sidebar
2. Enter any amount you want to add to your wallet
3. Hit **Pay with M-Pesa**
4. You'll receive an M-Pesa prompt on your phone — enter your PIN
5. Your wallet updates automatically in seconds

You can top up even if your wallet already has money. Wallet deposits are additive and never remove existing balance.

### Pochi La Biashara (Manual)
If you pay directly via Pochi:
1. Go to **Deposit** → **Confirm M-Pesa Receipt**
2. Enter the M-Pesa reference code from your SMS
3. Submit — your Chairman will review and mark your wallet as verified

### Request Wallet Credit From Winnings
If you win a gameweek and want the funds held in your wallet instead of cashing out:
1. Open the winner banner on your dashboard
2. Tap **Request Wallet Credit**
3. Add a note like `Use my GW winnings`
4. The Chairman receives a request to credit the amount to your wallet

### Wallet Rules
- Your wallet must have enough balance to cover the **gameweek stake** before the FPL deadline
- If your wallet runs out → you enter the **Red Zone** and are excluded from that week's pot
- Top up at any time — balances carry forward across gameweeks
- Top-ups are additive. Existing wallet balance is never removed when you add more money.

---

## Part 3: Green Zone & Red Zone

The system constantly monitors your wallet vs. the GW stake.

| Status | Meaning |
|---|---|
| 🟢 **Green Zone** | You're funded. Eligible for this week's pot. |
| 🔴 **Red Zone** | Wallet empty. Excluded from this week's payout. |

When you're Red Zone, you'll receive a push notification and a dashboard banner telling you exactly how much to deposit.

---

## Part 4: Winning & Getting Paid

The system automatically fetches FPL results after every gameweek ends:

1. The highest-scoring FPL manager in your private league **wins the pot**
2. Your dashboard immediately shows you the winner card with points and payout
3. If **YOU** are the winner:
   - Your entire dashboard turns **gold** 🏆
   - You receive an M-Pesa B2C payment automatically (or cash via your Chairman)
   - A **"Confirm M-Pesa Receipt"** prompt appears — tap it once the money lands
   - You can then **Share My Win 🏆** — generates a viral share card for your WhatsApp group!

### What is paid out?
Exactly **91%** of the gross pot always goes to the winner. The remaining 9% covers operational costs (see the Trust Slider on the homepage for a live breakdown).

---

## Part 5: Push Notifications

After allowing notifications when you first sign in, FantasyChama will push alerts directly to your phone:

| Alert | When |
|---|---|
| 🏆 GW Resolved | Gameweek ends and a winner is selected |
| ⚠️ Red Zone Warning | Your wallet drops below the stake threshold |
| 💰 Payout Dispatched | You won and M-Pesa B2C has been triggered |
| 🔔 Approval Needed | (Co-Admin only) A payout is waiting for your signature |

---

## Part 6: Payment Streaks

Every GW you pay on time, your **🔥 Payment Streak** counter increases:

| Streak | Status |
|---|---|
| 1 GW | No badge |
| 2–4 GWs 🔥 | Flame badge appears |
| 5+ GWs 🔥🔥 | Active streak leader |

If you miss a GW, your streak resets to 0. Streaks are visible to your Chairman in the Master Ledger.

---

## Part 7: If the Chairman Misbehaves

FantasyChama actively protects you as a member:

- If the Chairman fails to pay HQ platform fees → **HQ automatically suspends their dashboard**
- You will see a **Suspension Banner** on login: *"Chairman has pending bills. Ask them to settle."*
- You get a **Nudge Chairman** button — sends a direct notification to the Chairman every time you press it (with a 60-second cooldown)
- Once the Chairman settles with HQ, access is restored automatically within minutes

---

## Part 8: Multi-League Support

Are you in more than one Chama? No problem.

If you're registered in multiple leagues under the same phone number, a **League Switcher** appears in your header. Tap it to instantly switch between leagues without logging out.

---

## Part 9: Finances & History

The **Finances** page shows:
- Your complete deposit history
- Every payout you've ever received
- Your total contributed vs. total won
- A **Season Vault Trajectory graph** — showing how the season-end prize pool is growing toward GW38
- Your estimated season-end prize based on current standings

---

## Quick FAQ

**Q: When exactly does the winner get selected?**
A: The system polls FPL automatically. Once `data_checked = true` for your GW, the winner is calculated within minutes.

**Q: What if there's a tie?**
A: The FPL API provides the exact `event_total` points. In case of a genuine tie, the Chairman resolves it manually.

**Q: Can I see everyone else's wallet balances?**
A: Members can only see their own wallet. The Chairman has full visibility via Stealth Mode controls.

**Q: What happens at the end of the season?**
A: The Season Vault (30% of all weekly pots) is distributed among the top N managers based on your league's constitution (e.g. top 3 by total points).

---

## Part 10: Champion vs Live Leader (Important)

- If the current FPL Gameweek is still live, the app shows **Live Leader**.
- The app only shows **Champion/Winner** when the current Gameweek is marked finished by FPL and the winner has positive points.
- A manager with `0 pts` can appear as temporary live leader in edge cases, but will never be finalized as champion.

---

## Part 11: Season Vault Configuration

- Your Chairman can configure season vault rewards as **Top 1, Top 3, Top 5, or Custom**.
- In custom mode, the Chairman can set winner ratios directly.
- The app automatically caps visible payout tiers when active league size is small (for example, a 2-member league cannot practically run Top 3 payouts).
- You can always view the active vault payout setup in **Finances** and **Rules**.

---

## Part 12: April 2026 Member Experience Update

- Winner cards now respect FPL finalization: while live, cards show **Live Leader**.
- Champion labels only appear after the GW is complete and winner points are positive.
- Finance screens now reflect the Chairman's real season payout ladder, including custom ratios.
