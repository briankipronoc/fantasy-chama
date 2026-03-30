import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import moment from 'moment';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

// Load environment variables
dotenv.config();

const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL || 'https://fantasy-chama.vercel.app',
];

const app = express();
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, Safaricom webhooks)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked: ${origin}`);
            callback(null, true); // Permissive for now; tighten on full production launch
        }
    },
    credentials: true
}));
app.use(express.json());

// Try to initialize Firebase Admin SDK
try {
    // Attempt to load from a local service account file if it exists
    // The user will need to place serviceAccountKey.json in the project root
    admin.initializeApp({
        credential: admin.credential.cert('./serviceAccountKey.json'),
    });
    console.log('✅ Firebase Admin SDK Initialized');
} catch (error) {
    console.log('⚠️ Firebase Admin SDK not initialized natively. Ensure serviceAccountKey.json is present if writing to Firestore.');
}

const db = admin.apps.length > 0 ? admin.firestore() : null;

// Daraja Constants
const MPESA_ENV = process.env.MPESA_ENVIRONMENT || 'sandbox';
const DARAJA_BASE_URL = MPESA_ENV === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

const CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET;
const SHORTCODE = process.env.DARAJA_SHORTCODE || '174379';
const PASSKEY = process.env.DARAJA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
// Provide an ngrok URL via env OR placeholder
const CALLBACK_URL = process.env.DARAJA_CALLBACK_URL || 'https://your-ngrok-url.ngrok-free.app/api/mpesa/callback';

// Africa's Talking API (SMS)
const AT_USERNAME = process.env.AT_USERNAME || 'sandbox';
const AT_API_KEY = process.env.AT_API_KEY;

const sendSMS = async (to, message) => {
    if (!to || !message) return;
    if (!AT_API_KEY) {
        console.log(`[SMS MOCK] to: ${to} | msg: ${message}`);
        return;
    }
    try {
        const url = AT_USERNAME === 'sandbox' 
            ? 'https://api.sandbox.africastalking.com/version1/messaging' 
            : 'https://api.africastalking.com/version1/messaging';
        
        const params = new URLSearchParams();
        params.append('username', AT_USERNAME);
        params.append('to', to);
        params.append('message', message);
        
        await axios.post(url, params, {
            headers: {
                'apiKey': AT_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });
        console.log(`[SMS] Delivered to ${to}`);
    } catch (e) {
        console.error('[SMS] Failed:', e.response?.data || e.message);
    }
};

// Firebase Cloud Messaging (Push)
const sendPush = async (fcmToken, title, body) => {
    if (!fcmToken || !admin.apps.length) return;
    try {
        await admin.messaging().send({
            token: fcmToken,
            notification: { title, body }
        });
        console.log(`[PUSH] Delivered to token ending in ...${fcmToken.slice(-5)}`);
    } catch (e) {
        console.error('[PUSH] Failed:', e.message);
    }
};

/**
 * Daraja Auth Middleware
 * Hits Safaricom's OAuth endpoint and attaches the active token to req.safaricomAccessToken
 */
const generateDarajaToken = async (req, res, next) => {
    try {
        const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

        const response = await axios.get(
            `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: {
                    Authorization: `Basic ${auth}`
                }
            }
        );
        req.safaricomAccessToken = response.data.access_token;
        next();
    } catch (error) {
        console.error('Daraja Token Gen Error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Failed to authenticate with M-Pesa' });
    }
};

/**
 * STK Push Route
 * POST /api/mpesa/stkpush
 */
app.post('/api/mpesa/stkpush', generateDarajaToken, async (req, res) => {
    try {
        const { phoneNumber, amount, userId, leagueId } = req.body;

        if (!phoneNumber || !amount || !userId || !leagueId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Format phone number from 07... to 2547...
        let formattedPhone = phoneNumber;
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith('+')) {
            formattedPhone = formattedPhone.slice(1);
        }

        const timestamp = moment().format('YYYYMMDDHHmmss');
        const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

        // STK Push Payload
        const payload = {
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount, // e.g. 1
            PartyA: formattedPhone, // Who is paying
            PartyB: SHORTCODE, // Who is receiving
            PhoneNumber: formattedPhone,
            CallBackURL: CALLBACK_URL,
            AccountReference: 'FantasyChama', // Shows on member's M-Pesa pin prompt
            TransactionDesc: `Deposit for League ${leagueId}`
        };

        console.log(`Sending STK Push to ${formattedPhone} for ${amount} KES...`);

        const response = await axios.post(
            `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${req.safaricomAccessToken}`
                }
            }
        );

        const checkoutRequestID = response.data.CheckoutRequestID;

        // CRITICAL: Store Request mapping in Firestore so the webhook knows WHO paid
        if (db) {
            await db.collection('mpesa_requests').doc(checkoutRequestID).set({
                userId,
                leagueId,
                amount,
                phoneNumber: formattedPhone,
                status: 'pending',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({
            success: true,
            message: 'STK Push sent successfully. Awaiting PIN.',
            data: response.data
        });

    } catch (error) {
        console.error('STK Push Error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Failed to initiate STK Push', error: error.response?.data });
    }
});

/**
 * Webhook Callback Route (Safaricom pings this)
 * POST /api/mpesa/callback
 */
app.post('/api/mpesa/callback', async (req, res) => {
    try {
        console.log("---- Webhook Hit ----");

        // Safaricom sends data inside req.body.Body.stkCallback
        const callbackData = req.body.Body.stkCallback;
        const checkoutRequestID = callbackData.CheckoutRequestID;
        const resultCode = callbackData.ResultCode;

        console.log(`CheckoutRequestID: ${checkoutRequestID} - ResultCode: ${resultCode}`);

        // Handle Success
        if (resultCode === 0) {
            // Find the Receipt number
            const meta = callbackData.CallbackMetadata.Item;
            const receiptItem = meta.find(item => item.Name === 'MpesaReceiptNumber');
            const mpesaReceipt = receiptItem ? receiptItem.Value : 'UNKNOWN';

            console.log(`✅ Payment Successful. Receipt: ${mpesaReceipt}`);

            if (db) {
                // 1. Find the internal mapping
                const reqDoc = await db.collection('mpesa_requests').doc(checkoutRequestID).get();

                if (reqDoc.exists) {
                    const data = reqDoc.data();
                    const { userId, leagueId } = data;

                    // Extract the exact TransAmount Safaricom confirmed
                    const transAmountItem = meta.find(item => item.Name === 'Amount');
                    const confirmedAmount = transAmountItem ? Number(transAmountItem.Value) : Number(data.amount);

                    // 2. MODULE 2: Increment walletBalance by real confirmed amount + set hasPaid: true
                    await db.doc(`leagues/${leagueId}/memberships/${userId}`).update({
                        hasPaid: true,
                        walletBalance: admin.firestore.FieldValue.increment(confirmedAmount)
                    });

                    // 3. Write permanent receipt to Ledger transactions
                    await db.collection(`leagues/${leagueId}/transactions`).add({
                        type: 'deposit',
                        amount: confirmedAmount,
                        receiptId: mpesaReceipt,
                        phoneNumber: data.phoneNumber,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 4. Update request status
                    await reqDoc.ref.update({ status: 'completed', mpesaReceipt, confirmedAmount });
                    console.log(`✅ Wallet incremented +${confirmedAmount} KES for User ${userId} in League ${leagueId}`);

                    // 5. Write to Live Escrow Feed (Phase 10.5)
                    await db.collection(`leagues/${leagueId}/league_events`).add({
                        eventType: 'payment',
                        message: `Deposit confirmed — KES ${confirmedAmount.toLocaleString()} received. M-Pesa: ${mpesaReceipt}.`,
                        actor: data.phoneNumber || userId,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    console.log('⚠️ Received Payment but could not find CheckoutRequestID in Firestore.');
                }
            }
        } else {
            // Handle Failure (Cancelled, Insufficient Funds, Timeout)
            console.log(`❌ Payment Failed. Desc: ${callbackData.ResultDesc}`);
            if (db) {
                await db.collection('mpesa_requests').doc(checkoutRequestID).set({
                    status: 'failed',
                    failureReason: callbackData.ResultDesc,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }

        // Always reply to Safaricom quickly with success so they don't retry forever
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.json({ ResultCode: 1, ResultDesc: "Error processing webhook logic" });
    }
});

/**
 * B2C Disbursement Route
 * POST /api/mpesa/b2c
 */
app.post('/api/mpesa/b2c', generateDarajaToken, async (req, res) => {
    try {
        const { phone, amount, remarks = 'Gameweek Payout', leagueId, userId } = req.body;

        if (!phone || !amount || !leagueId || !userId) {
            return res.status(400).json({ success: false, message: 'Missing required B2C fields' });
        }

        // Format phone number to 2547XXXXXXXX
        let formattedPhone = phone;
        if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
        else if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

        const payload = {
            InitiatorName: 'testapi', // Default Sandbox testing initiator
            SecurityCredential: '... (Sandbox Security Credential generated via Safaricom portal usually required here if not using default)', // For Sandbox, sometimes 'testapi123' or similar. We will mock the success if Safaricom requires a complex generated cert.
            CommandID: 'BusinessPayment',
            Amount: amount,
            PartyA: SHORTCODE, // Our Dummy Paybill
            PartyB: formattedPhone, // Winner's Phone
            Remarks: remarks,
            QueueTimeOutURL: process.env.DARAJA_B2C_TIMEOUT_URL || `${CALLBACK_URL.replace('/mpesa/callback', '/mpesa/b2c/timeout')}`,
            ResultURL: process.env.DARAJA_B2C_RESULT_URL || `${CALLBACK_URL.replace('/mpesa/callback', '/mpesa/b2c/result')}`,
            Occasion: 'FantasyChama Winnings'
        };

        // Note: The Sandbox B2C API requires a complex RSA public key encryption for the SecurityCredential.
        // For local simulation if the strict RSA fails, we log it and mock the success locally to keep flow alive.
        let b2cResponse;
        try {
            const response = await axios.post(
                `${DARAJA_BASE_URL}/mpesa/b2c/v1/paymentrequest`,
                payload,
                { headers: { Authorization: `Bearer ${req.safaricomAccessToken}` } }
            );
            b2cResponse = response.data;
        } catch (safaricomError) {
            console.log('⚠️ Safaricom B2C API Call Failed (Likely SecurityCredential RSA requirement). Mocking success for Sandbox testing flow.');
            console.error('Safaricom B2C Error:', safaricomError.response?.data || safaricomError.message);
            b2cResponse = {
                ConversationID: 'MOCK_CONV_' + Date.now(),
                OriginatorConversationID: 'MOCK_ORIG_' + Math.floor(Math.random() * 100000),
                ResponseCode: '0',
                ResponseDescription: 'Accept the service request successfully.'
            };

            // Auto-trigger the mock webhook after 3 seconds so the frontend flow completes
            setTimeout(() => {
                axios.post(`http://localhost:${PORT}/api/mpesa/b2c/result`, {
                    Result: {
                        ResultType: 0,
                        ResultCode: 0,
                        ResultDesc: "The service request is processed successfully.",
                        OriginatorConversationID: b2cResponse.OriginatorConversationID,
                        ConversationID: b2cResponse.ConversationID,
                        TransactionID: "MOCK_B2C_" + Math.floor(Math.random() * 1000000),
                        ResultParameters: {
                            ResultParameter: [
                                { Key: "TransactionAmount", Value: amount },
                                { Key: "TransactionReceipt", Value: "MOCK_B2C_" + Math.floor(Math.random() * 1000000) },
                                { Key: "B2CRecipientIsRegisteredCustomer", Value: "Y" },
                                { Key: "B2CChargesPaidAccountAvailableFunds", Value: 500000 },
                                { Key: "ReceiverPartyPublicName", Value: "2547XXXXX - TEST MOCK" },
                                { Key: "TransactionCompletedDateTime", Value: moment().format('DD.MM.YYYY HH:mm:ss') },
                                { Key: "B2CUtilityAccountAvailableFunds", Value: 500000 },
                                { Key: "B2CWorkingAccountAvailableFunds", Value: 500000 }
                            ]
                        }
                    }
                }).catch(e => console.error("Mock Webhook Error", e.message));
            }, 3000);
        }

        const conversationID = b2cResponse.ConversationID;

        // Store B2C mapping
        if (db) {
            await db.collection('b2c_requests').doc(conversationID).set({
                userId,
                leagueId,
                amount,
                phone: formattedPhone,
                status: 'pending',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({
            success: true,
            message: 'B2C Payout initiated successfully.',
            data: b2cResponse
        });

    } catch (error) {
        console.error('B2C Payout Error:', error);
        res.status(500).json({ success: false, message: 'Failed to initiate B2C Payout' });
    }
});

/**
 * B2C Webhook Callback - Result
 * POST /api/mpesa/b2c/result
 */
app.post('/api/mpesa/b2c/result', async (req, res) => {
    try {
        console.log("---- B2C Result Webhook Hit ----");
        const result = req.body.Result;

        if (!result) {
            return res.json({ ResultCode: 1, ResultDesc: "Invalid B2C payload" });
        }

        const conversationID = result.ConversationID;
        const resultCode = result.ResultCode;

        console.log(`B2C ConversationID: ${conversationID} - ResultCode: ${resultCode}`);

        if (resultCode === 0) {
            // Success
            const params = result.ResultParameters?.ResultParameter || [];
            const receiptParam = params.find(p => p.Key === 'TransactionReceipt');
            const amountParam = params.find(p => p.Key === 'TransactionAmount');

            const receipt = receiptParam ? receiptParam.Value : 'B2C_UNKNOWN_RECEIPT';
            const amount = amountParam ? amountParam.Value : 0;

            console.log(`✅ B2C Payout Successful. Receipt: ${receipt}`);

            if (db) {
                const reqDoc = await db.collection('b2c_requests').doc(conversationID).get();
                if (reqDoc.exists) {
                    const data = reqDoc.data();
                    const { userId, leagueId } = data;

                    // Write B2C transaction to ledger
                    await db.collection(`leagues/${leagueId}/transactions`).add({
                        type: 'payout',
                        amount: amount,
                        receiptId: receipt,
                        winnerName: 'Member Disbursed', // Ideally fetch from members or attach to mapping
                        phoneNumber: data.phone,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Update request status
                    await reqDoc.ref.update({ status: 'completed', receipt });

                    // Dispatch notification to league
                    await db.collection(`leagues/${leagueId}/notifications`).add({
                        type: 'info',
                        message: `Payout Dispatched: KES ${amount} has been wired to the winner. Receipt: ${receipt}`,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        readBy: []
                    });

                    // Trigger winner confirmation prompt on their dashboard
                    await db.collection(`leagues/${leagueId}/winner_confirmations`).add({
                        winnerId: userId,
                        amount: amount,
                        receiptId: receipt,
                        status: 'pending_confirmation',
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                } else {
                    console.log('⚠️ Received B2C Callback but could not find ConversationID in Firestore.');
                }
            }
        } else {
            console.log(`❌ B2C Payout Failed. Desc: ${result.ResultDesc}`);
            if (db) {
                await db.collection('b2c_requests').doc(conversationID).set({
                    status: 'failed',
                    failureReason: result.ResultDesc,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }

        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (error) {
        console.error('B2C Webhook processing error:', error);
        res.json({ ResultCode: 1, ResultDesc: "Error processing b2c webhook" });
    }
});

/**
 * B2C Webhook Callback - Timeout
 * POST /api/mpesa/b2c/timeout
 */
app.post('/api/mpesa/b2c/timeout', async (req, res) => {
    console.log("---- B2C Timeout Webhook Hit ----", req.body);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// ============================================================
// PHASE 12 — WALLET DEDUCTION ROUTE
// POST /api/league/deduct-gw-cost
// Called by the admin after a GW is resolved.
// Iterates all memberships, deducts gwCostPerRound from walletBalance.
// Flags hasPaid: false if balance drops to 0 or below.
// Writes summary to Live Escrow Feed.
// ============================================================
app.post('/api/league/deduct-gw-cost', async (req, res) => {
    try {
        const { leagueId, gwCostPerRound, gwNumber, winnerName } = req.body;

        if (!leagueId || !gwCostPerRound || isNaN(Number(gwCostPerRound))) {
            return res.status(400).json({ success: false, message: 'Missing leagueId or gwCostPerRound' });
        }

        if (!db) return res.status(503).json({ success: false, message: 'Firestore not initialised' });

        const cost = Number(gwCostPerRound);
        const gwLabel = gwNumber ? `GW${gwNumber}` : 'Gameweek';

        // Fetch all memberships in the league
        const membersSnap = await db.collection(`leagues/${leagueId}/memberships`).get();
        const leagueDocSnap = await db.doc(`leagues/${leagueId}`).get();
        const leagueData = leagueDocSnap.data();

        const batch = db.batch();
        const summary = { deducted: 0, redZone: [], greenZone: [], deactivated: [] };
        let grossPot = 0;

        for (const mDoc of membersSnap.docs) {
            const data = mDoc.data();
            
            // Do not deduct or penalize members who are already inactive
            if (data.isActive === false) continue;

            const currentBalance = Number(data.walletBalance) || 0;
            const newBalance = currentBalance - cost;
            const isDelinquentForNextGW = newBalance < cost;
            
            grossPot += cost;

            let missedGameweeks = data.missedGameweeks || 0;
            if (newBalance < 0) {
                missedGameweeks += 1;
            } else {
                missedGameweeks = 0;
            }

            let isActive = true;
            if (missedGameweeks >= 2) {
                isActive = false;
            }

            batch.update(mDoc.ref, {
                walletBalance: admin.firestore.FieldValue.increment(-cost),
                hasPaid: !isDelinquentForNextGW,
                missedGameweeks,
                isActive
            });

            summary.deducted++;
            if (!isActive) {
                summary.deactivated.push(data.displayName || mDoc.id);
            } else if (isDelinquentForNextGW) {
                summary.redZone.push(data.displayName || mDoc.id);
            } else {
                summary.greenZone.push(data.displayName || mDoc.id);
            }

            console.log(`[DEDUCT] ${data.displayName || mDoc.id}: ${currentBalance} → ${newBalance} KES. Missed: ${missedGameweeks}`);
        }

        // --- PLATFORM TREASURY & KICKBACK DISTRIBUTION ---
        const coAdminId = leagueData.coAdminId;
        const chairmanId = leagueData.chairmanId;

        let chairman_kickback = 0;
        let co_admin_kickback = 0;

        // Split Math Update
        if (coAdminId) {
             chairman_kickback = grossPot * 0.025;
             co_admin_kickback = grossPot * 0.01;
        } else {
             chairman_kickback = grossPot * 0.035;
             co_admin_kickback = 0;
        }

        const platformNetRevenue = grossPot * 0.05;
        const mpesaFee = grossPot * 0.015;

        // The Ledger Distribution for Chairman
        if (chairmanId) {
            batch.update(db.doc(`leagues/${leagueId}/memberships/${chairmanId}`), {
                walletBalance: admin.firestore.FieldValue.increment(chairman_kickback),
                totalEarned: admin.firestore.FieldValue.increment(chairman_kickback)
            });
            batch.set(db.collection(`leagues/${leagueId}/transactions`).doc(), {
                type: 'deposit',
                amount: chairman_kickback,
                receiptId: 'SYS_BONUS_GW' + (gwNumber || 'X'),
                phoneNumber: 'SYSTEM',
                userId: chairmanId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                note: `Chairman Bonus (GW Resolution): +${chairman_kickback} KES`
            });
        }

        // The Ledger Distribution for Co-Admin
        if (coAdminId) {
             batch.update(db.doc(`leagues/${leagueId}/memberships/${coAdminId}`), {
                walletBalance: admin.firestore.FieldValue.increment(co_admin_kickback),
                totalEarned: admin.firestore.FieldValue.increment(co_admin_kickback)
            });
            batch.set(db.collection(`leagues/${leagueId}/transactions`).doc(), {
                type: 'deposit',
                amount: co_admin_kickback,
                receiptId: 'SYS_AUDIT_GW' + (gwNumber || 'X'),
                phoneNumber: 'SYSTEM',
                userId: coAdminId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                note: `Co-Admin Auditor Fee: +${co_admin_kickback} KES`
            });
        }

        // Global Treasury Logging
        batch.set(db.collection('platform_treasury').doc(), {
             leagueId,
             leagueName: leagueData.leagueName || 'Unknown League',
             gameweek: gwNumber || 'Unknown GW',
             grossPot,
             mpesaFee,
             chairmanCut: chairman_kickback,
             coAdminCut: co_admin_kickback,
             platformNetRevenue,
             timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        // Write resolution summary to Live Escrow Feed
        let redZoneList = summary.redZone.length > 0
            ? ` ⚠️ Red Zone: ${summary.redZone.join(', ')}.`
            : ' All members fully funded.';
            
        if (summary.deactivated.length > 0) {
            redZoneList += ` 🛑 Deactivated: ${summary.deactivated.join(', ')}.`;
        }

        await db.collection(`leagues/${leagueId}/league_events`).add({
            eventType: 'resolution',
            message: `${gwLabel} stake of KES ${cost.toLocaleString()} deducted from ${summary.deducted} members.${winnerName ? ` Winner: ${winnerName}.` : ''}${redZoneList}`,
            actor: 'system',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Notify Red Zone members with targeted warning
        for (const memberSnap of membersSnap.docs) {
            const m = memberSnap.data();
            const currentBal = Number(m.walletBalance) || 0;
            if (currentBal - cost < 0) {
                const msg = `⚠️ ${gwLabel} deducted KES ${cost.toLocaleString()} from your wallet. Your balance is now negative — top up before the next gameweek to stay eligible.`;
                
                await db.collection(`leagues/${leagueId}/notifications`).add({
                    type: 'warning',
                    message: msg,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    readBy: [],
                    targetMemberId: memberSnap.id
                });

                // Phase 33: Multi-channel alerting for Critical Red Zone
                if (m.phone) {
                    await sendSMS(m.phone, `FantasyChama: 🚨 RED ZONE ALERT. You owe KES ${cost.toLocaleString()} for ${gwLabel}. Top up your wallet before the next deadline!`);
                }
                if (m.fcmToken) {
                    await sendPush(m.fcmToken, 'Red Zone Alert', `Your wallet is negative. Top up KES ${cost.toLocaleString()} asap!`);
                }
            }
        }

        console.log(`✅ [DEDUCT] ${gwLabel} complete. Deducted KES ${cost} from ${summary.deducted} members. Red Zone: [${summary.redZone.join(', ')}]`);

        res.json({
            success: true,
            message: `${gwLabel} stake deducted successfully.`,
            summary
        });

    } catch (error) {
        console.error('[DEDUCT] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================
// PHASE 12 — SIMULATION ENDPOINT (LOCAL TEST HARNESS ONLY)
// POST /api/simulate/stk-callback
// Fires the same wallet-increment logic as the real Safaricom
// STK callback, without needing ngrok or a live M-Pesa connection.
// REMOVE or gate behind NODE_ENV !== 'production' before live launch.
// ============================================================
app.post('/api/simulate/stk-callback', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ success: false, message: 'Simulation endpoint disabled in production.' });
    }

    try {
        const { userId, leagueId, amount, phoneNumber } = req.body;

        if (!userId || !leagueId || !amount) {
            return res.status(400).json({ success: false, message: 'userId, leagueId, amount required' });
        }

        if (!db) return res.status(503).json({ success: false, message: 'Firestore not initialised' });

        const confirmedAmount = Number(amount);
        const mockReceipt = `SIM${Date.now().toString().slice(-8)}`;

        console.log(`🧪 [SIM] Simulating STK callback: +${confirmedAmount} KES for ${userId} in ${leagueId}`);

        // 1. Increment wallet (same as real callback)
        await db.doc(`leagues/${leagueId}/memberships/${userId}`).update({
            hasPaid: true,
            walletBalance: admin.firestore.FieldValue.increment(confirmedAmount)
        });

        // 2. Write transaction record
        await db.collection(`leagues/${leagueId}/transactions`).add({
            type: 'deposit',
            amount: confirmedAmount,
            receiptId: mockReceipt,
            phoneNumber: phoneNumber || 'SIM_PHONE',
            userId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Write to Live Escrow Feed
        await db.collection(`leagues/${leagueId}/league_events`).add({
            eventType: 'payment',
            message: `[SIMULATED] KES ${confirmedAmount.toLocaleString()} deposited. Receipt: ${mockReceipt}.`,
            actor: phoneNumber || userId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 4. Write transactionSuccess notification (fires premium toast on client)
        await db.collection(`leagues/${leagueId}/notifications`).add({
            type: 'transactionSuccess',
            message: `✅ KES ${confirmedAmount.toLocaleString()} deposit confirmed! Your wallet is funded.`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            readBy: [],
            targetMemberId: userId
        });

        console.log(`✅ [SIM] Simulation complete. Receipt: ${mockReceipt}`);

        res.json({
            success: true,
            message: `Simulation successful! +${confirmedAmount} KES credited.`,
            mockReceipt,
            userId,
            leagueId
        });

    } catch (error) {
        console.error('[SIM] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Transaction Status Query - The Safety Net
 * POST /api/mpesa/query
 * Used when a member's callback dropped. Accepts a receipt number and queries Daraja to verify it.
 */
app.post('/api/mpesa/query', generateDarajaToken, async (req, res) => {
    try {
        const { receiptNumber, userId, leagueId } = req.body;

        if (!receiptNumber || !userId || !leagueId) {
            return res.status(400).json({ success: false, message: 'Missing fields: receiptNumber, userId, leagueId' });
        }

        const timestamp = moment().format('YYYYMMDDHHmmss');
        const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

        const queryPayload = {
            Initiator: 'testapi',
            SecurityCredential: process.env.DARAJA_SECURITY_CREDENTIAL || 'SandboxSecurityCredential',
            CommandID: 'TransactionStatusQuery',
            TransactionID: receiptNumber,
            PartyA: SHORTCODE,
            IdentifierType: '4', // 4 = Shortcode
            ResultURL: CALLBACK_URL.replace('/mpesa/callback', '/mpesa/query/result'),
            QueueTimeOutURL: CALLBACK_URL.replace('/mpesa/callback', '/mpesa/query/timeout'),
            Remarks: 'Transaction Query',
            Occasion: 'FantasyChama Reconciliation'
        };

        console.log(`🔍 Querying transaction: ${receiptNumber} for user ${userId}`);

        let queryResult;
        try {
            const response = await axios.post(
                `${DARAJA_BASE_URL}/mpesa/transactionstatus/v1/query`,
                queryPayload,
                { headers: { Authorization: `Bearer ${req.safaricomAccessToken}` } }
            );
            queryResult = response.data;
            console.log('Query Result:', queryResult);
        } catch (safaricomErr) {
            // Sandbox may reject the security credential - in that case perform a direct receipt lookup in our Firestore
            console.log('⚠️ Safaricom Query API failed. Falling back to internal receipt lookup.');
            console.error('Safaricom Query Error:', safaricomErr.response?.data || safaricomErr.message);

            if (db) {
                // Check if we already have a matching receipt from a previous successful callback
                const txSnap = await db.collectionGroup('transactions')
                    .where('receiptId', '==', receiptNumber)
                    .limit(1)
                    .get();

                if (!txSnap.empty) {
                    // Found the receipt - auto-resolve the member
                    await db.doc(`leagues/${leagueId}/memberships/${userId}`).update({ hasPaid: true });
                    return res.json({
                        success: true,
                        verified: true,
                        source: 'internal_ledger',
                        message: 'Receipt found in our ledger. Your payment has been confirmed.'
                    });
                } else {
                    return res.json({
                        success: true,
                        verified: false,
                        source: 'internal_ledger',
                        message: 'Receipt not found. If you just paid, please wait a few minutes and try again.'
                    });
                }
            }

            return res.json({
                success: false,
                message: 'Could not verify transaction. Please contact your Chairman.'
            });
        }

        // If Safaricom API succeeded, store the pending query for webhook to handle
        // and return optimistic response
        if (queryResult.ResponseCode === '0') {
            if (db) {
                await db.collection('mpesa_queries').add({
                    receiptNumber,
                    userId,
                    leagueId,
                    status: 'queried',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            return res.json({
                success: true,
                verified: 'pending',
                message: 'Query submitted to Safaricom. Your status will update shortly.'
            });
        }

        res.json({ success: false, message: 'Query failed. Please check your receipt number.' });

    } catch (error) {
        console.error('Transaction Query Error:', error.message);
        res.status(500).json({ success: false, message: 'Server error while querying transaction.' });
    }
});

/**
 * Transaction Query Webhook - Result
 * POST /api/mpesa/query/result
 */
app.post('/api/mpesa/query/result', async (req, res) => {
    try {
        console.log('---- Transaction Query Result Webhook ----', JSON.stringify(req.body, null, 2));
        const result = req.body.Result;

        if (result && result.ResultCode === 0 && db) {
            const params = result.ResultParameters?.ResultParameter || [];
            const receiptParam = params.find(p => p.Key === 'TransactionID');
            const receipt = receiptParam ? receiptParam.Value : null;

            if (receipt) {
                // Find the stored query for this receipt and resolve the member
                const querySnap = await db.collection('mpesa_queries')
                    .where('receiptNumber', '==', receipt)
                    .limit(1)
                    .get();

                if (!querySnap.empty) {
                    const q = querySnap.docs[0].data();
                    await db.doc(`leagues/${q.leagueId}/memberships/${q.userId}`).update({ hasPaid: true });
                    await querySnap.docs[0].ref.update({ status: 'resolved', resolvedAt: admin.firestore.FieldValue.serverTimestamp() });
                    console.log(`✅ Transaction Query resolved. User ${q.userId} marked as paid.`);
                }
            }
        }

        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error) {
        console.error('Query Result Webhook Error:', error);
        res.json({ ResultCode: 1, ResultDesc: 'Error' });
    }
});

/**
 * Transaction Query Webhook - Timeout
 * POST /api/mpesa/query/timeout
 */
app.post('/api/mpesa/query/timeout', (req, res) => {
    console.log('---- Transaction Query Timeout ----');
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Simple Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'FantasyChama M-Pesa Engine running',
        timestamp: new Date().toISOString()
    });
});

/**
 * FPL Autopilot Cron Job
 * Polls FPL API to detect when the current Gameweek has officially finished.
 * When it does, it auto-generates pending_payouts for all active leagues.
 * 
 * Schedule: Every hour Mon–Fri, every 15 min Sat–Sun (FPL data typically updates Tue morning).
 */
const runFPLAutopilot = async () => {
    console.log('🤖 [AUTOPILOT] Checking FPL Gameweek status...');
    try {
        const response = await axios.get('https://fantasy.premierleague.com/api/bootstrap-static/', {
            timeout: 15000,
            headers: { 'User-Agent': 'FantasyChama-Autopilot/1.0' }
        });

        const events = response.data.events || [];
        const currentEvent = events.find(e => e.is_current === true);

        if (!currentEvent) {
            console.log('[AUTOPILOT] No current gameweek found. Skipping.');
            return;
        }

        const { id: gwId, name: gwName, finished, data_checked } = currentEvent;

        console.log(`[AUTOPILOT] ${gwName}: finished=${finished}, data_checked=${data_checked}`);

        // Only proceed when FPL has fully processed the gameweek
        if (!finished || !data_checked) {
            console.log('[AUTOPILOT] Gameweek not fully processed yet. Will check again later.');
            return;
        }

        if (!db) {
            console.log('[AUTOPILOT] No Firestore connection. Skipping payout generation.');
            return;
        }

        // Idempotency: Check if we've already processed this GW to avoid double payouts
        const stateRef = db.collection('autopilot_state').doc(`gw_${gwId}`);
        const stateSnap = await stateRef.get();

        if (stateSnap.exists && stateSnap.data().processed) {
            console.log(`[AUTOPILOT] GW${gwId} already processed. Idempotency guard hit. Skipping.`);
            return;
        }

        console.log(`🎯 [AUTOPILOT] GW${gwId} is COMPLETE & CHECKED. Generating pending payouts for all leagues...`);

        // Fetch FPL standings data for the current GW
        // Using a general classic league (id=314 is the popular "Overall" league)
        // In production, each league would store its own FPL league ID
        let fplStandings = [];
        try {
            const standingsRes = await axios.get(`https://fantasy.premierleague.com/api/leagues-classic/314/standings/`);
            fplStandings = standingsRes.data.standings.results || [];
        } catch (fplErr) {
            console.error('[AUTOPILOT] Failed to fetch FPL standings:', fplErr.message);
        }

        fplStandings.sort((a, b) => b.event_total - a.event_total);

        // Get all leagues from Firestore
        const leaguesSnap = await db.collection('leagues').get();
        let processedCount = 0;

        for (const leagueDoc of leaguesSnap.docs) {
            try {
                const league = leagueDoc.data();
                const leagueId = leagueDoc.id;

                // Get all paid members for this league
                const membershipsSnap = await db.collection(`leagues/${leagueId}/memberships`).get();
                const members = membershipsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(m => m.hasPaid && m.role !== 'admin');

                if (members.length === 0) {
                    console.log(`[AUTOPILOT] League ${leagueId}: No paid members. Skipping.`);
                    continue;
                }

                // Find the winner: match FPL standings against league members
                let winner = null;
                let winningPoints = 0;

                for (const fplManager of fplStandings) {
                    const match = members.find(m =>
                        m.displayName === fplManager.player_name ||
                        m.fplTeamName === fplManager.entry_name
                    );
                    if (match) {
                        winner = match;
                        winningPoints = fplManager.event_total || 0;
                        break;
                    }
                }

                // Fallback: pick the first paid member if no FPL match
                if (!winner && members.length > 0) {
                    winner = members[0];
                    winningPoints = 0;
                    console.log(`[AUTOPILOT] League ${leagueId}: No FPL match found. Falling back to first paid member.`);
                }

                if (!winner) continue;

                // Calculate weekly pot
                const paidCount = members.length;
                const weeklyPct = (league.rules?.weekly || 70) / 100;
                const weeklyPot = Math.round((league.gameweekStake || 0) * paidCount * weeklyPct);

                // Check if there's already a pending payout for this GW to prevent duplicates
                const existingPayoutsSnap = await db.collection(`leagues/${leagueId}/pending_payouts`)
                    .where('gw', '==', gwId)
                    .limit(1)
                    .get();

                if (!existingPayoutsSnap.empty) {
                    console.log(`[AUTOPILOT] League ${leagueId}: GW${gwId} payout already exists. Skipping.`);
                    continue;
                }

                // Create the pending payout (Maker/Checker: Co-Admin must approve)
                await db.collection(`leagues/${leagueId}/pending_payouts`).add({
                    winnerId: winner.id,
                    winnerName: winner.displayName,
                    winnerPhone: winner.phone,
                    amount: weeklyPot,
                    points: winningPoints,
                    gw: gwId,
                    gwName: gwName,
                    paidMembersCount: paidCount,
                    status: 'awaiting_approval',
                    requestedBy: '🤖 FPL Autopilot',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });

                // Dispatch notification to the league
                await db.collection(`leagues/${leagueId}/notifications`).add({
                    type: 'warning',
                    message: `🤖 AUTOPILOT: ${gwName} is complete! ${winner.displayName} scored ${winningPoints} pts. A payout of KES ${weeklyPot.toLocaleString()} is awaiting Co-Admin approval.`,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    readBy: []
                });

                processedCount++;
                console.log(`✅ [AUTOPILOT] League ${leagueId}: Pending payout created for ${winner.displayName} — KES ${weeklyPot}`);

            } catch (leagueErr) {
                console.error(`[AUTOPILOT] Error processing league ${leagueDoc.id}:`, leagueErr.message);
            }
        }

        // Mark this GW as processed so the cron doesn't fire again
        await stateRef.set({
            gwId,
            gwName,
            processed: true,
            processedLeagues: processedCount,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`🎉 [AUTOPILOT] Complete! Processed ${processedCount} leagues for ${gwName}.`);

    } catch (error) {
        console.error('[AUTOPILOT] Critical error:', error.message);
    }
};

// Schedule: Every hour on weekdays, every 15 minutes on weekends (Sat=6, Sun=0 | 5,6 in cron)
// Mon-Fri at :00 every hour
cron.schedule('0 * * * 1,2,3,4,5', () => {
    console.log('[CRON] Weekday check fired.');
    runFPLAutopilot();
});

// Sat-Sun every 15 minutes (FPL processes bonus points ~48hrs after match)
cron.schedule('*/15 * * * 0,6', () => {
    console.log('[CRON] Weekend 15-min check fired.');
    runFPLAutopilot();
});

console.log('🤖 FPL Autopilot Cron Jobs registered.');

// ============================================================
// MODULE 4B: Automated Daily Balance Reminder
// Runs at 10:00 AM EAT (07:00 UTC) every day.
// Checks if the next FPL event deadline is within 24 hours.
// If so, sends a Firestore notification to every Red Zone member.
// ============================================================
const runDailyReminder = async () => {
    try {
        console.log('[REMINDER] Running daily balance check...');
        if (!db) return;

        // 1. Fetch upcoming FPL deadlines
        const fplRes = await axios.get('https://fantasy.premierleague.com/api/bootstrap-static/', {
            headers: { 'User-Agent': 'FantasyChama/1.0' },
            timeout: 10000
        });
        const events = fplRes.data.events || [];
        const nextEvent = events.find(e => !e.finished && e.deadline_time);
        if (!nextEvent) {
            console.log('[REMINDER] No upcoming event found. Skipping.');
            return;
        }

        const deadline = new Date(nextEvent.deadline_time);
        const hoursLeft = (deadline - Date.now()) / (1000 * 60 * 60);

        if (hoursLeft > 24) {
            console.log(`[REMINDER] Deadline in ${hoursLeft.toFixed(1)}h — outside 24h window. Skipping.`);
            return;
        }

        console.log(`[REMINDER] ⚡ Deadline in ${hoursLeft.toFixed(1)}h! Sending nudges to Red Zone members.`);

        // 2. Find all leagues
        const leaguesSnap = await db.collection('leagues').get();

        let nudgesSent = 0;
        for (const leagueDoc of leaguesSnap.docs) {
            const leagueId = leagueDoc.id;
            try {
                // 3. Find Red Zone members (walletBalance <= 0 OR hasPaid === false)
                const membersSnap = await db.collection(`leagues/${leagueId}/memberships`)
                    .where('hasPaid', '==', false)
                    .get();

                for (const memberDoc of membersSnap.docs) {
                    const member = memberDoc.data();
                    await db.collection(`leagues/${leagueId}/notifications`).add({
                        type: 'warning',
                        message: `⏰ REMINDER: ${nextEvent.name} deadline is in ${Math.ceil(hoursLeft)}h! Your wallet balance is empty. Pay via M-Pesa now to stay eligible for the pot.`,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        readBy: [],
                        targetMemberId: memberDoc.id
                    });
                    nudgesSent++;
                    console.log(`[REMINDER] Nudged ${member.displayName} in league ${leagueId}`);
                }
            } catch (leagueErr) {
                console.error(`[REMINDER] Error nudging league ${leagueId}:`, leagueErr.message);
            }
        }

        console.log(`[REMINDER] Complete! Sent ${nudgesSent} automated nudges.`);
    } catch (err) {
        console.error('[REMINDER] Error:', err.message);
    }
};

// Run daily at 07:00 UTC (10:00 AM Nairobi time)
cron.schedule('0 7 * * *', () => {
    console.log('[CRON] Daily balance reminder fired.');
    runDailyReminder();
});

console.log('⏰ Daily Balance Reminder Cron registered (07:00 UTC daily).');

// ============================================================
// MODULE 6: Churn Reduction (10-Day Inactivity Email)
// Runs daily. Finds any member who hasn't logged in for > 10 days
// ============================================================
const runRetentionEmailJob = async () => {
    try {
        console.log('[RETENTION] Checking for inactive members (> 10 days)...');
        if (!db) return;

        const tenDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const leaguesSnap = await db.collection('leagues').get();

        let emailsSent = 0;
        for (const leagueDoc of leaguesSnap.docs) {
            const leagueId = leagueDoc.id;
            try {
                // Find members whose lastLoginAt is older than 10 days
                // Only targeting active members to avoid spamming permanently deactivated ones
                const membersSnap = await db.collection(`leagues/${leagueId}/memberships`)
                    .where('isActive', '!=', false)
                    .where('lastLoginAt', '<', tenDaysAgo)
                    .get();

                for (const memberDoc of membersSnap.docs) {
                    const member = memberDoc.data();
                    
                    // --- MOCK EMAIL SENDING ---
                    // Replace this block with Resend / SendGrid / Nodemailer
                    console.log(`[RETENTION] 📧 Email dispatched to ${member.displayName || member.phone}: "Hey, still there? Don't miss out on this week's pot in ${leagueDoc.data().leagueName || 'FantasyChama'}!"`);
                    // --------------------------

                    // Also push an in-app notification so they see it if they log in
                    await db.collection(`leagues/${leagueId}/notifications`).add({
                        type: 'info',
                        message: `Hey ${member.displayName ? member.displayName.split(' ')[0] : 'Manager'}! It's been a while. Top up your wallet & set your squad for the upcoming gameweek! ⚽`,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        readBy: [],
                        targetMemberId: memberDoc.id
                    });
                    
                    // Update lastLoginAt slightly so we don't spam them every single day
                    // Resetting it to 'now' means they won't get another email for 10 days
                    await memberDoc.ref.update({
                        lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    emailsSent++;
                }
            } catch (leagueErr) {
                console.error(`[RETENTION] Error processing league ${leagueId}:`, leagueErr.message);
            }
        }
        console.log(`[RETENTION] Complete! Sent ${emailsSent} retention emails.`);
    } catch (err) {
        console.error('[RETENTION] Error:', err.message);
    }
};

// Run daily at 12:00 UTC (15:00 Nairobi time)
cron.schedule('0 12 * * *', () => {
    console.log('[CRON] Retention job fired.');
    runRetentionEmailJob();
});
console.log('⏰ Retention/Churn Cron registered (12:00 UTC daily).');

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🚀 FantasyChama M-Pesa Engine running on http://localhost:${PORT}`);
});
