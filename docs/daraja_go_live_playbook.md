# Daraja Go-Live Playbook
## Graduating FantasyChama from Sandbox to Production M-Pesa

> **Last Updated:** March 2026  
> **Scope:** STK Push (C2B) + B2C Disbursement  
> **Estimated Timeline:** 5–14 business days after application submission

---

## Overview

Safaricom operates two environments:

| Environment | Base URL | Purpose |
|---|---|---|
| **Sandbox** | `https://sandbox.safaricom.co.ke` | Development & testing (fake money) |
| **Production** | `https://api.safaricom.co.ke` | Real money, real M-Pesa accounts |

Your `server.js` currently targets **Sandbox**. This playbook walks you through every step to flip to live.

---

## Phase 1 — Administrative Prerequisites

### Step 1.1 — Register a Business Entity
Safaricom requires one of:
- A **Registered Company** (Certificate of Incorporation)
- A **Business Name** (Business Registration Certificate)
- An **NGO Certificate**, or
- **KRA PIN Certificate**

> If you're launching personally, a Business Name registration via eCitizen (~KES 1,000) is the fastest route.

### Step 1.2 — Get a Safaricom Paybill or Till Number
You need a real Paybill/Till to receive C2B payments (STK Push).

1. Visit any **Safaricom Shop** or apply via **M-Pesa Global** (business.safaricom.co.ke)
2. Choose: **Paybill** (for business payments, recommended) or **Buy Goods / Till** (retail)
3. You'll receive a **Shortcode** (e.g., `4089291`) — this replaces `174379` (sandbox)
4. Activate **Lipa na M-Pesa** on the Paybill

### Step 1.3 — Create a Production App on Safaricom Developer Portal

1. Go to **[developer.safaricom.co.ke](https://developer.safaricom.co.ke)**
2. Log in → **My Apps** → **Add New App**
3. Select both:
   - ✅ **Lipa na M-Pesa Online** (STK Push / C2B)
   - ✅ **M-Pesa B2C** (Business-to-Customer payouts)
4. Set **Go Live** status → Submit for review
5. Safaricom will review and issue:
   - Production **Consumer Key**
   - Production **Consumer Secret**
   - Production **Passkey** (a unique SHA-256 hash per app)

---

## Phase 2 — Safaricom's Required Test Cases

Before approving your Go-Live request, Safaricom requires you to demonstrate these scenarios in **Sandbox** (with their team watching, or via an online form):

### C2B (STK Push) Test Cases

| # | Test Case | Expected Result |
|---|---|---|
| TC-01 | Initiate STK Push to a valid Safaricom number | Prompt appears, user enters PIN, callback fires with `ResultCode: 0` |
| TC-02 | User **cancels** the STK prompt | Callback fires with `ResultCode: 1032` (cancelled) |
| TC-03 | User enters **wrong PIN** 3 times | Callback fires with `ResultCode: 1` (failed) |
| TC-04 | STK Push to **invalid phone** number | HTTP 400 from Daraja before prompt |
| TC-05 | Callback URL **unreachable** | Daraja retries 3x; your system must handle idempotently |
| TC-06 | **Duplicate** CheckoutRequestID received | System must not double-credit the wallet |

### B2C (Payout) Test Cases

| # | Test Case | Expected Result |
|---|---|---|
| BC-01 | B2C to a **registered** M-Pesa number | `ResultCode: 0`, `B2CRecipientIsRegisteredCustomer: Y` |
| BC-02 | B2C to an **unregistered** number | `ResultCode: 2001` error (gracefully handled) |
| BC-03 | B2C with **insufficient** balance in the initiator account | `ResultCode: 2001` — display human-readable error |
| BC-04 | B2C **timeout** (QueueTimeOutURL fires) | System retries or alerts admin |
| BC-05 | B2C amount **below minimum** (< KES 10) | Rejected at Daraja level |

> **How to run:** Use Postman or your simulation script. Log every request/response. Safaricom may ask for screenshot evidence.

---

## Phase 3 — Exact Code Changes in `server.js`

### Change 1 — Swap API Base URLs (3 places)

```diff
// In generateDarajaToken (line ~67):
- 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
+ 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',

// In /api/mpesa/stkpush (line ~120):
- 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
+ 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',

// In /api/mpesa/b2c (line ~271):
- 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
+ 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
```

### Change 2 — B2C SecurityCredential (RSA Encryption)

In Sandbox you can mock the SecurityCredential. In **Production**, you **must** generate it properly:

```js
// Install: npm install node-forge
import forge from 'node-forge';
import fs from 'fs';

function generateB2CCredential(initiatorPassword) {
    // Download the production cert from:
    // https://developer.safaricom.co.ke/sites/default/files/cert/ProductionCertificate.cer
    const certPem = fs.readFileSync('./ProductionCertificate.cer', 'utf-8');
    const cert = forge.pki.certificateFromPem(certPem);
    const publicKey = cert.publicKey;
    const encrypted = publicKey.encrypt(initiatorPassword, 'RSA-OAEP');
    return forge.util.encode64(encrypted);
}

// In /api/mpesa/b2c — replace the placeholder:
const SecurityCredential = generateB2CCredential(process.env.DARAJA_INITIATOR_PASSWORD);
```

### Change 3 — Remove the Mock Auto-Trigger (Sandbox Only)

```diff
// In /api/mpesa/b2c — remove the entire setTimeout block:
- setTimeout(() => {
-     axios.post(`http://localhost:${PORT}/api/mpesa/b2c/result`, { ... })
- }, 3000);
```

### Change 4 — Disable Simulation Endpoint

```diff
// Already production-gated in Phase 12, but double check:
app.post('/api/simulate/stk-callback', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
+       return res.status(403).json({ success: false, message: 'Disabled.' });
    }
```

---

## Phase 4 — New Environment Variables

Add these to your `.env` (local) and your **Render** service environment:

```bash
# ── Daraja Production Credentials ─────────────────────────────
DARAJA_CONSUMER_KEY=your_prod_consumer_key_here
DARAJA_CONSUMER_SECRET=your_prod_consumer_secret_here
DARAJA_SHORTCODE=your_paybill_number_here        # e.g. 4089291
DARAJA_PASSKEY=your_prod_256_passkey_here        # From Safaricom portal
DARAJA_INITIATOR_NAME=your_initiator_name        # B2C initiator username
DARAJA_INITIATOR_PASSWORD=your_initiator_password # B2C initiator password (plain, encrypted at runtime)

# ── Callback URLs (must be HTTPS, publicly reachable) ──────────
DARAJA_CALLBACK_URL=https://fantasy-chama-api.onrender.com/api/mpesa/callback
DARAJA_B2C_RESULT_URL=https://fantasy-chama-api.onrender.com/api/mpesa/b2c/result
DARAJA_B2C_TIMEOUT_URL=https://fantasy-chama-api.onrender.com/api/mpesa/b2c/timeout

# ── App Mode ───────────────────────────────────────────────────
NODE_ENV=production
FRONTEND_URL=https://fantasy-chama.vercel.app
```

> ⚠️ **Never commit production keys to Git.** Your `.env` is already in `.gitignore`. On Render, set these in the **Environment** tab of your service.

---

## Phase 5 — Go-Live Submission Checklist

Complete all items before submitting to Safaricom:

### Technical
- [ ] All 6 STK Push test cases pass in Sandbox
- [ ] All 5 B2C test cases pass in Sandbox
- [ ] Callback URL is HTTPS and publicly reachable (test with Postman → your Render URL)
- [ ] B2C SecurityCredential generates correctly with `node-forge` + Production certificate
- [ ] Idempotency check: re-sending same `CheckoutRequestID` does NOT double-credit wallet
- [ ] Simulation endpoint returns 403 in production
- [ ] Sandbox base URLs replaced with `api.safaricom.co.ke`
- [ ] All new env variables set on Render

### Business
- [ ] Real Paybill/Till Number activated on M-Pesa
- [ ] Business registration documents uploaded to Safaricom portal
- [ ] Production App created and submitted for Go-Live on developer.safaricom.co.ke
- [ ] Test evidence screenshots collected (Postman logs, Firestore writes)
- [ ] Terms of Service page live at `https://fantasy-chama.vercel.app/terms`

---

## Phase 6 — Post-Go-Live Verification

After Safaricom approves your app (email notification), do one real transaction:

```bash
# 1. Real STK Push — use YOUR phone, KES 1
curl -X POST https://fantasy-chama-api.onrender.com/api/mpesa/stkpush \
  -H "Content-Type: application/json" \
  -d '{ "phoneNumber": "0724177517", "amount": 1, "userId": "YOUR_UID", "leagueId": "YOUR_LEAGUE_ID" }'

# 2. Confirm in Firebase Console:
#    leagues/{leagueId}/memberships/{userId}.walletBalance incremented by 1
#    leagues/{leagueId}/transactions — new 'deposit' document
#    leagues/{leagueId}/league_events — new '[PAYMENT]' entry in Live Feed

# 3. Real B2C Payout — small amount, YOUR phone
#    Fire from AdminCommandCenter → Resolve Gameweek → Co-Admin Approve
#    Confirm: M-Pesa SMS received within ~5 seconds
```

---

## Quick Reference

| Item | Sandbox Value | Production Value |
|---|---|---|
| STK API URL | `sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest` | `api.safaricom.co.ke/mpesa/stkpush/v1/processrequest` |
| OAuth URL | `sandbox.safaricom.co.ke/oauth/v1/generate` | `api.safaricom.co.ke/oauth/v1/generate` |
| B2C URL | `sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest` | `api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest` |
| Shortcode | `174379` | Your real Paybill number |
| SecurityCredential | Mocked / skipped | RSA-OAEP encrypted with Production cert |
| Initiator | `testapi` | Your registered B2C initiator name |

---

*Generated for FantasyChama · Phase 14 Go-Live Prep · March 2026*
