
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

