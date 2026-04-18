import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(__dirname, '..');
const serviceAccountPath = path.resolve(rootDir, 'serviceAccountKey.json');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const leagueArg = args.find((arg) => arg.startsWith('--leagueId='));
const leagueId = leagueArg ? leagueArg.split('=')[1] : null;

const initFirebase = () => {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return;
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    return;
  }

  throw new Error('Missing Firebase credentials. Add serviceAccountKey.json or FIREBASE_* env vars.');
};

const isValidCoChair = (coAdminId, coAdminData, chairmanId) => {
  if (!coAdminId) return false;
  if (!coAdminData) return false;
  if (coAdminId === chairmanId) return false;
  if (coAdminData.isActive === false) return false;
  return coAdminData.role === 'admin';
};

const run = async () => {
  initFirebase();
  const db = admin.firestore();

  const leaguesRef = db.collection('leagues');
  const leaguesSnap = leagueId ? await leaguesRef.where(admin.firestore.FieldPath.documentId(), '==', leagueId).get() : await leaguesRef.get();

  if (leaguesSnap.empty) {
    console.log('No leagues found for requested scope.');
    return;
  }

  let scanned = 0;
  let toFix = 0;
  let fixed = 0;

  for (const leagueDoc of leaguesSnap.docs) {
    const leagueData = leagueDoc.data();
    const lid = leagueDoc.id;

    const coAdminId = leagueData.coAdminId || null;
    const chairmanId = leagueData.chairmanId || null;

    let coAdminData = null;
    if (coAdminId) {
      const coMemberSnap = await db.doc(`leagues/${lid}/memberships/${coAdminId}`).get();
      if (coMemberSnap.exists) coAdminData = coMemberSnap.data();
    }

    const validCoChair = isValidCoChair(coAdminId, coAdminData, chairmanId);
    if (validCoChair) continue;

    const pendingSnap = await db.collection(`leagues/${lid}/pending_payouts`)
      .where('status', '==', 'awaiting_approval')
      .where('approvalTarget', '==', 'co-chair')
      .get();

    scanned += pendingSnap.size;
    if (pendingSnap.empty) continue;

    toFix += pendingSnap.size;
    console.log(`[${lid}] Found ${pendingSnap.size} pending payout(s) requiring co-chair, but no valid co-chair exists.`);

    if (!apply) continue;

    const batch = db.batch();
    for (const pendingDoc of pendingSnap.docs) {
      batch.update(pendingDoc.ref, {
        approvalTarget: 'chairman',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      fixed += 1;
    }
    await batch.commit();
    console.log(`[${lid}] Updated ${pendingSnap.size} pending payout(s) to chairman approval.`);
  }

  console.log('------------------------------------------');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Pending payouts scanned: ${scanned}`);
  console.log(`Pending payouts needing fix: ${toFix}`);
  console.log(`Pending payouts updated: ${fixed}`);
  console.log('------------------------------------------');
};

run().catch((err) => {
  console.error('Fix script failed:', err.message || err);
  process.exit(1);
});
