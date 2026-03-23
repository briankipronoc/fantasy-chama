# Fantasy Chama — App User Manual 📗

Welcome to the definitive guide for operating Fantasy Chama, the ultimate automated pot and verification engine for your FPL mini-leagues.

---

## 🧍 For Members: Playing & Paying

### 1. The Wallet System (Credits & Allowances)
*   Deposit a **lump sum** via M-Pesa STK push from your dashboard.
*   Your balance auto-deducts each Gameweek. The dashboard shows how many GWs you're covered for.
*   **Green Zone** = Verified & Active. **Red Zone** = wallet empty, top up before FPL deadline.
*   Miss 2 consecutive GWs → permanent vault disqualification.

### 2. Link Your FPL Team (Profile)
*   Go to **Profile → Link FPL Team**.
*   The dropdown fetches your league's live FPL standings. Select your exact team.
*   This saves your FPL Entry ID permanently, resolving any name mismatches between your M-Pesa name and FPL manager name.
*   Your linked FPL team is used by the Standings page for accurate identification.

### 3. Disputes & Missing Payments
*   Click **Dispute payment →** under the Pay button.
*   Enter your exact **M-Pesa Receipt Code** (e.g., `SB49XY123Z`).
*   The system traces it with Safaricom, or flags it for Chairman clearance.

### 4. Claiming the Crown (Winning a Gameweek)
*   The system disburses the weekly pot via M-Pesa B2C to your linked phone.
*   Once you receive the cash, click **'Confirm ✓'** on the golden banner.
*   **Golden Dashboard**: When YOU are the GW champion, your entire dashboard turns gold with a personal celebration card showing your payout amount. The Red Zone banner is hidden.

### 5. Winner's Circle
*   On the dashboard, the **Winner's Circle** panel shows the most recent GW champions.
*   Click **"View All"** to expand and see every historical winner with their GW, points, and aggregate stats.

### 6. Standings & Projections
*   The **Standings** page shows live FPL league data with payment status indicators.
*   **Gameweek Champion** card highlights the current week's highest scorer.
*   **End of Season Projections** dynamically shows vault payouts based on your league's winner count setting.

### 7. Audit Log (Finances)
*   View the **Season Vault**, **My Total Contributed**, and **My Total Winnings** at a glance.
*   Toggle **Stealth Mode** to hide financial amounts in public.
*   Export the full ledger history.

---

## 👑 For Chairmen & Admins: Governance

### 1. The Command Center
The Chairman's Portal gives absolute control over the league's financial timeline.
*   **Master Ledger**: Real-time wallet balances, missing payments, FPL IDs.
*   **Live Escrow Feed**: Watch the league update autonomously as members pay and bots calculate.

### 2. Setting Up the League (Admin Setup)
*   **FPL League ID**: Paste the full FPL league URL or just the numeric ID. The system extracts it automatically.
*   **Gameweek Stake**: Set the amount each member pays per GW.
*   **Prize Split**: Configure the Weekly Pot vs. Season Vault percentage (e.g., 70/30).
*   **Season Winners Count**: Set to 1 (winner takes all) or 3 (50/30/20 split) or 5 for deeper distribution.

### 3. Assigning Co-Admins (Maker/Checker)
*   In the Master Ledger, click **Make Admin** on a trusted member.
*   Co-Admin can log in and access the Command Center.
*   **All payouts require Co-Admin counter-signature** — no single person can disburse funds alone.

### 4. Gameweek Resolution
1.  The **FPL Autopilot** detects the GW end and selects the winner automatically.
2.  A pending payout appears in both Chairman and Co-Admin dashboards.
3.  **Co-Admin reviews** and clicks **"Approve & Pay"** to trigger M-Pesa B2C.
4.  System notifications alert all members about the result and scheduled payout.

### 5. Earn As You Lead (The Chairman's Cut)
Every GW resolution taxes the pot 10% (Escrow). Out of that:
| Recipient | Solo Chairman | With Co-Admin |
|---|---|---|
| Platform | 5.0% | 5.0% |
| Safaricom API | 1.5% | 1.5% |
| Chairman | 3.5% | 2.5% |
| Co-Admin | — | 1.0% |

*   Kickbacks are atomically deposited into your Wallet Balance.
*   The automated WhatsApp receipt transparently displays all cuts to all members.

### 6. Advanced Invites
*   **Expiring Links**: Auto-destroy after 24 hours.
*   **Targeted Phone Links**: Lock the invite to a specific phone number.
*   **6-Digit Codes**: Members paste invite codes directly on the login page.

### 7. Notifications & Nudging
*   System automatically sends **bell inbox** notifications for GW resolutions, payment confirmations, and payout scheduling.
*   Members in Red Zone get emergency in-app warnings near FPL deadlines.
*   Chairman can share results via the **WhatsApp Receipt** button on each resolved payout.
