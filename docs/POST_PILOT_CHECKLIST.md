
# Post-Pilot Checklist

When the pilot is successful and you are ready to transition to the live system, ensure the following keys actions are taken:

1. **Re-Enable HQ Month-End Fee Enforcement**
   - The pilot optionally bypassed the monthly 20% HQ fee lockout mechanism or left the fees zeroed. In the live environment, you need to ensure the Cron jobs run correctly to charge the `isHqSettled` requirement.
   - Any comments masking the `!isHqSettled` logic check should be reverted.
   
2. **Pochi La Biashara Webhook Live Environment**
   - During the pilot, cash top-ups and payouts might have been logged natively or pushed to manual hand-off queues. 
   - Point the Pochi webhook to the live endpoint `https://us-central1-fantasychama.cloudfunctions.net/darajaWebhook`
   - Swap the test M-Pesa credentials for the production credentials in Firebase Secrets.

3. **Reset Firebase Pilot Environment Data**
   - All pilot FPL IDs, deposits, ledgers, `leagues` collections, and `memberships` collections should be securely truncated or archived.
   - Set up the main production `League` document.
   - Run the initial setup on the SuperAdmin Dashboard to claim the "Chairman" token via Seed generation.

4. **Verify Domain Configuration**
   - Vercel deployments should be pointed to your custom domain, not the `vercel.app` staging domain. Ensure DNS Cnames and A records are propagated.


## Post-Pilot System & Monetization Upgrades (Phase 3)

After the pilot, the following features should be implemented into the codebase to maximize the business revenue and optimize administration:

1. **H2H Side Bets (5% Fee)**
   - Create a `h2hWagers` collection where managers can challenge each other to 1v1 Gameweek battles. 
   - Winners take the pot minus a 5% system deduction (2.5% to Chairman, 2.5% to HQ).

2. **Relegation Fines**
   - Introduce an automated 50 KES penalty for the bottom 3 managers each Gameweek.
   - Requires updating the `backend/` cron job that checks standings to append a negative transaction against those members' wallets.

3. **Comeback Insurance**
   - Offer a pre-deadline 20 KES "Captain Blank" insurance top-up. If the manager's captain blanks (no goal, assist, or clean sheet), their GW entry stake is refunded.

4. **League Creation Fee**
   - Place a standard 500 KES fee to initialize a new league via the Admin Setup portal, adding friction-based revenue outside of weekly GW stakes.

5. **WhatsApp B2C Nudges & Automations**
   - Integrate WhatsApp API for automated "Settle the pot" reminders 4 hours post-GW.
   - Bypass the human Maker-Checker queue in the Admin Command Center for payouts under 5,000 KES if they perfectly match the FPL API standings.
