# FantasyChama Deployment Runbook

This checklist covers the minimum steps for a safe production launch.

## 1. Before You Deploy

- Confirm the frontend env values are present:
  - `VITE_API_URL`
  - `VITE_FIREBASE_VAPID_KEY`
  - `VITE_SENTRY_DSN`
  - `VITE_APP_URL`
- Confirm the backend env values are present:
  - `DARAJA_CONSUMER_KEY`
  - `DARAJA_CONSUMER_SECRET`
  - `DARAJA_SHORTCODE`
  - `DARAJA_PASSKEY`
  - `DARAJA_CALLBACK_URL`
  - `DARAJA_B2C_RESULT_URL`
  - `DARAJA_B2C_TIMEOUT_URL`
  - `MPESA_ENVIRONMENT`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `FRONTEND_URL`
  - `BACKEND_URL`
  - `AT_USERNAME`
  - `AT_API_KEY`
- Confirm Firebase Cloud Messaging is enabled in the Firebase project.
- Confirm the public service worker file exists at `public/firebase-messaging-sw.js`.
- Confirm the backend can reach the public Daraja callback URLs.

## 2. Production Checks

- Run the frontend build and confirm it passes.
- Start the backend and verify the health endpoint responds:
  - `GET /api/health`
- Confirm the health payload reports `firebaseReady: true` and `darajaReady: true` in production.
- Verify Firestore rules and indexes are deployed.
- Verify CORS allows the production frontend domain.

## 3. Smoke Test Sequence

Run these flows in order:

1. Login
2. Join or load a league
3. Deposit via STK push
4. Approve a payout with a Co-Chair
5. Resolve a gameweek without a Co-Chair
6. Read and mark notifications as read
7. Open standings and confirm the table loads
8. Open the member dashboard and confirm winner/podium sections render

## 4. Post-Deploy Monitoring

- Check Render logs for webhook failures.
- Check Sentry for frontend and backend errors.
- Confirm M-Pesa callbacks are arriving and updating Firestore.
- Confirm the cron jobs are running for autopilot and reminders.
- Confirm the app shell loads on mobile without zoom or layout shifts.

## 5. Rollback Triggers

Pause the rollout if you see any of these:

- Missing or repeated payout callbacks
- STK pushes failing consistently
- FCM registration errors across multiple devices
- Firestore permission errors
- `/api/health` reports missing critical env values in production

## 6. Useful Endpoints

- `GET /api/health` - service readiness and environment summary
- `POST /api/mpesa/stkpush` - member deposit flow
- `POST /api/mpesa/b2c` - winner payout flow
- `POST /api/league/deduct-gw-cost` - GW resolution engine

## 7. Repair Commands (Safe)

If old pending payouts still require co-chair approval while no valid co-chair exists, run:

- Dry run (no writes):
  - `npm run fix:pending-approvals:dry`
- Apply fixes:
  - `npm run fix:pending-approvals:apply`

Optional league scope:

- `node scripts/fix_pending_approval_targets.mjs --leagueId=<LEAGUE_ID>`
- `node scripts/fix_pending_approval_targets.mjs --leagueId=<LEAGUE_ID> --apply`
