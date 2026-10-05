# 🏆 FantasyChama
> **The Operating System for FPL Money Leagues in Kenya.**  
> Automated M-Pesa Escrow, Live FPL Data Sync, Dual-Signatory Governance, and Viral WhatsApp Banter.

[![Production Build](https://img.shields.io/badge/Build-Passing-emerald)](https://fantasy-chama.vercel.app)
[![Tests](https://img.shields.io/badge/Tests-20%2F20%20Passing-brightgreen)](https://github.com/briankipronoc/fantasy-chama)
[![License](https://img.shields.io/badge/License-Proprietary-blue)](#)
[![Live App](https://img.shields.io/badge/Live-fantasy--chama.vercel.app-gold)](https://fantasy-chama.vercel.app)

---

## ⚽ What is FantasyChama?

Over 2 million Kenyans play Fantasy Premier League (FPL), with thousands of informal WhatsApp Chamas pooling weekly cash pots. But informal leagues suffer from three crippling problems:
1. **Chairmen ghosting with the money** — no escrow or recourse.
2. **Ugly payment disputes** — manual spreadsheets, missed M-Pesa transactions, and calculation errors.
3. **Delayed payouts** — members waiting days while the admin tabulates transfer hits manually.

**FantasyChama replaces human friction with algorithmic trust.**

---

## 🌟 Key Features

### 🔒 Transparent Escrow & Algorithmic Payouts
- **M-Pesa STK Push**: Members deposit directly from their phone with one PIN prompt.
- **Safaricom Daraja B2C**: Automated prize dispatches straight to the winner's Safaricom number at full-time.
- **Maker/Checker Protocol**: The Chairman initiates resolution, and the designated Co-Chair countersigns. Zero unilateral cash tampering.
- **91/9 Transparent Economy**: 91% to Gameweek and Season winners, exactly 9% covers automated operations (3.5% HQ, 4% Chairman / Co-Chair, 1.5% M-Pesa network fee).

### 🔥 Chama WhatsApp Banter Slip (1-Tap Matchday Digest)
- Auto-generates post-round WhatsApp digests in authentic Kenyan Sheng.
- **3 Roast Heat Levels**: *Mild Chai ☕* (office friendly), *Proper Roast 🔥* (spicy local banter), and *Nuclear Matusi ☢️* (inner circle street roast).
- Highlights **King of the Week** 👑, **Mtu wa Chini (Wooden Spoon)** 🥔, **Benched Regret** 🤦, and **Red Zone Debtors** 🚨.
- 1-tap clipboard copy formatted with WhatsApp markdown and emojis.

### 🧮 Mid-Season Fair Buy-In Calculator
- Solves late-season onboarding without diluting the Season Vault.
- **Fair Entry Formula**:
  $$\text{Buy-In} = (\text{Current GW} - \text{Start GW}) \times \text{Stake} \times \text{Vault \%} + \text{First GW Stake}$$
- Generates transparent, itemized WhatsApp invoices so new managers join at GW10 or GW15 with zero drama.

### ⚔️ 1v1 Side Bets & Branded Victory Cards
- **Spectator Mode (`sidebets_only`)**: Free entry to view live leaderboards and duel rivals without weekly pot deductions.
- **Side Bets Arena**: Head-to-head cash duels locked in M-Pesa escrow and auto-disbursed at 90 minutes.
- **Branded Victory Cards**: High-contrast, sharable cards optimized for WhatsApp Status.

### 📊 Clean Slate Accounting & Dynamic Start
- **Dynamic Start Anchor**: Automatically anchors calculations to the league's actual `startGw` (e.g. GW5).
- **Pre-Season Insulation**: Test gameweeks prior to official start are insulated from member balances and active ledger totals.
- **Reversal Netting**: Audits refunds and reversals (`effectiveWallet = max(0, wallet - refunds)`), guaranteeing master collected amounts match verified cash.

### 🌓 Premium Aesthetics & Mobile First
- Curated dark mode with glassmorphic cards, emerald `#10B981` accents, and amber `#FBBF24` trophy golds.
- **OLED Stealth Mode**: Pitch-black theme toggle with numeric masking for public spaces and screensharing.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **State Management** | Zustand (with localStorage persistence) |
| **Backend** | Node.js, Express, `node-cron`, Zod validation |
| **Database** | Firebase Firestore (Real-time NoSQL listeners) |
| **Authentication** | Firebase Auth (Phone OTP + Email hybrid) |
| **Payments** | Safaricom Daraja API (STK Push Inflow + B2C Outflow) |
| **Live Sports Data** | Official Premier League REST API |
| **Testing** | Playwright End-to-End Suite |
| **Hosting** | Vercel (Frontend), Render (Backend) |

---

## 🚀 Quick Start (Local Development)

### 1. Clone the repository
```bash
git clone https://github.com/briankipronoc/fantasy-chama.git
cd fantasy-chama
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_URL=http://localhost:5001
```

### 4. Run the development server
```bash
npm run dev
```

### 5. Run tests
```bash
# Type check
npx tsc --noEmit

# Run Playwright end-to-end tests
npx playwright test
```

---

## 📚 Documentation Index

- [📘 System Blueprint](docs/SYSTEM_BLUEPRINT.md) — Technical architecture, database schemas, and API design.
- [👑 Chairman Playbook](docs/CHAIRMAN_PLAYBOOK.md) — End-to-end league governance and operations guide.
- [🧍 Member Field Guide](docs/MEMBER_GUIDE.md) — Player reference for wallets, payouts, and side bets.
- [💼 Investor Brief](docs/INVESTOR_BRIEF.md) — Market opportunity, unit economics, and viral flywheels.
- [📈 Marketing & Promo Strategy](docs/MARKETING_AND_PROMO.md) — WhatsApp growth loops and creator playbooks.
- [📗 User Manual](docs/USER_MANUAL.md) — Operational reference manual.
- [🚀 Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md) — Production release procedures.

---

## 👥 Authors & Acknowledgments

- **Founder & Lead Engineer**: Brian Kiprono ([@briankipronoc](https://github.com/briankipronoc))
- Built for the vibrant Kenyan and East African FPL community.

---

*FantasyChama — Your Chama runs itself.*
