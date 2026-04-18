// useFCMToken.ts — Manages Firebase Cloud Messaging device token registration.
// Requests notification permission, gets the FCM token, and saves it to Firestore
// so the backend can target this device for push notifications.

import { useEffect } from 'react';
import { getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function registerFCMToken() {
    // Only run in browser environments with notification support
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (!VAPID_KEY) {
        console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not set. Push notifications disabled.');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const app = getApps()[0];
        if (!app) return;

        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        });

        if (token) {
            // Save this device's FCM token to the member's Firestore document
            const leagueId = localStorage.getItem('activeLeagueId');
            const activeUserId = localStorage.getItem('activeUserId');
            if (leagueId && activeUserId) {
                await updateDoc(doc(db, 'leagues', leagueId, 'memberships', activeUserId), {
                    fcmToken: token
                });
            }
        }

        // Handle foreground messages (app is open) — show a toast
        onMessage(messaging, (payload) => {
            const { title, body } = payload.notification || {};
            if (!title) return;

            // Dispatch a custom DOM event that NotificationProvider can listen to
            window.dispatchEvent(new CustomEvent('fcm-message', {
                detail: { title, body, data: payload.data }
            }));
        });
    } catch (err) {
        console.error('[FCM] Token registration error:', err);
    }
}

export function useFCMToken() {
    useEffect(() => {
        registerFCMToken();
    }, []);
}
