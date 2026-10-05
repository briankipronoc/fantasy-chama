# FantasyChama — Investor Brief
*April 2026 | Confidential*

---

## The Problem

FPL (Fantasy Premier League) mini-leagues in Kenya are a massive, entirely informal market. Thousands of WhatsApp groups run weekly cash pots — collecting M-Pesa payments manually, tracking standings in spreadsheets, and disbursing winnings via trust-based chairman handoffs.

This system creates **three critical failure points every single week**:
1. **Chairmen collect and disappear** — no escrow, no recourse
2. **Disputes get ugly** — no verifiable payment trail, no audit log
3. **Payouts are slow** — manual processes take days; members chase chairmen

The market is enormous. The Premier League has over **2 million active FPL users in Kenya**. Most are operating informal money leagues. There is currently no product addressing this.

---

## The Solution

FantasyChama is the **operating system for FPL money leagues in Kenya**.

We automate every part of the informal process:
- **Auto-import** league rosters directly from the FPL API
- **M-Pesa STK Push** collects weekly stakes from each member
- **Live FPL scoring** determines the winner algorithmically — no disputes
- **Daraja B2C** auto-disburses winnings to the winner's phone
- **Maker/Checker** Co-Admin protocol prevents chairman fraud
- **HQ Enforcement** suspends leagues that don't pay platform fees

We turn a trust problem into a technology product.

---

## Product Architecture

### Technology Stack
- **Frontend**: React + Vite, hosted on Vercel
- **Backend**: Node.js + Express, hosted on Render
- **Database**: Firebase Firestore (real-time, NoSQL)
- **Payments**: Safaricom Daraja API (production-certified STK Push + B2C)
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Monitoring**: Sentry error tracking

### Key Features Shipped
- ✅ Automated FPL standings sync (live gameweek data)
- ✅ M-Pesa STK Push collection (per-member per-GW)
- ✅ Daraja B2C winner disbursement (automated or chairman-triggered)
- ✅ Maker/Checker Co-Admin payout approval (dual signatory)
- ✅ Real-time escrow ledger (every KES tracked)
- ✅ **Chama WhatsApp Banter Slip**: 1-tap weekly matchday digest with authentic Kenyan Sheng & roast heat levels (King of Week, Wooden Spoon / Mtu wa Chini, Benched Regret, Red Zone debt alerts)
- ✅ **Mid-Season Fair Buy-In Calculator**: Algorithmic equity formula solving mid-season onboarding without vault dilution
- ✅ **Universal Dynamic GW Alignment & Reversal Reconciliation**: Clean-slate accounting, pre-season insulation, and spectator isolation
- ✅ **Spectator Mode & 1v1 Side Bets Arena**: Free entry for spectators with cash head-to-head duels and branded Victory Cards
- ✅ Chairman & Co-Chair earnings (automatic 4% / 1% wallet credits)
- ✅ 48-hour HQ debt enforcement + league suspension system
- ✅ FCM push notifications (winner alerts, red zone warnings)
- ✅ Multi-league support (one account, multiple Chamas)
- ✅ Payment streak rewards (🔥 gamification layer)
- ✅ OG viral win share cards (/win?... social preview cards)
- ✅ Audit CSV export for Chairmen
- ✅ Season Vault trajectory visualizer (Bloomberg-style graph)
- ✅ Dark/Light/OLED Stealth mode

---

## Revenue Model

**Per-league, per-gameweek fee: 9% of gross pot**

| Recipient | Split |
|---|---|
| FantasyChama HQ | 3.5% |
| Chairman | 4% (or 3% + 1% Co-Chair) |
| M-Pesa Network | 1.5% |

The **3.5% HQ fee is enforced at the infrastructure level** — not collected on trust. Chairmen who don't pay within 48 hours are automatically suspended until they settle.

### Unit Economics Example
- League: 10 members × KES 200/GW stake = **KES 2,000 gross pot**
- HQ revenue: 3.5% = **KES 70 per gameweek per league**
- At 100 active leagues: **KES 7,000/GW × 38 GWs = KES 266,000/season**
- At 1,000 active leagues: **KES 2.66M/season**

Season vault (30% of all weekly pots) accumulates and creates a **season-end prize event**, which acts as a virality flywheel — members stay for 38 gameweeks to compete for a large end-of-season payout.

---

## Go-To-Market & Viral Flywheels

### Target Customer
- FPL WhatsApp group admins (we call them "Chairmen")
- They already run informal money leagues
- They are the distribution channel — every Chairman brings 8–15 members

### Acquisition Strategy
1. **WhatsApp Banter Slip Loop (Zero-CAC Organic Distribution)**: Post-matchday FPL banter is the cultural lifeblood of Kenyan WhatsApp groups. With 1 tap, the Chairman copies an automated, branded Banter Slip with local Sheng roasts into their group every Sunday/Monday night. Every member in that chat sees FantasyChama, sparking organic word-of-mouth.
2. **Mid-Season Fair Buy-In Calculator**: Historically, informal leagues lose momentum or lock out new friends after Gameweek 5. Our Fair Buy-In formula generates transparent WhatsApp invoices, allowing leagues to continuously onboard late entrants and expand TVL throughout the season.
3. **1v1 Side Bets & Victory Cards**: Non-stakeholders can join as spectators for free and challenge friends to KES 500 head-to-head duels. Winners share high-res Victory Cards to WhatsApp Status, driving peer curiosity and onboarding.
4. **Referral Engine**: Each Chairman earns a 0.5% kickback bonus when referring another league operator.

### Retention Mechanics
- Payment streaks keep members habitually paying every GW
- Season vault locks members in for the full 38-GW season
- Notifications create daily habit loops

---

## Traction

- **Platform Status**: Production-deployed (Vercel + Render)
- **API Status**: Safaricom Daraja API live (production certification in progress)
- **Pilot**: 1 league, 8 GWs of operation, zero missed payouts
- **Stage**: Pre-revenue, post-product

---

## The Ask

We are raising **[amount TBD]** to:
1. Complete Safaricom Daraja production certification (go-live for real B2C)
2. Run 3 months of WhatsApp community acquisition
3. Onboard the first 50 paid leagues before GW38

---

## Team

- **Founder**: Brian Kiprono — Full-stack engineer, FPL player, Chama operator
- Supported by AI-assisted development infrastructure

---

## Contact

📧 support@fantasychama.co.ke  
🌐 https://fantasy-chama.vercel.app  
🐦 @FantasyChama  

---

*FantasyChama — Your Chama runs itself.*

## Growth Strategy: Micro-payments & Wallet Pre-funding
By pivoting to a Wallet-First system with spectator segregation and reversal reconciliation, we now capture both high-roller bulk deposits (4-week advances) and student micro-payments (custom top-ups), dramatically increasing total platform liquidity and user retention by removing weekly payment friction.
