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
    // If the user previously dismissed or denied notification permission, do not spam or prompt again
    if (Notification.permission === 'denied') return;
    if (!VAPID_KEY) {
        return;
    }

    try {
        // If not yet granted, request permission
        const permission = Notification.permission === 'granted' 
            ? 'granted' 
            : await Notification.requestPermission();
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
    } catch (err: any) {
        if (err?.name === 'AbortError' || err?.message?.includes('public key')) {
            console.warn('[FCM] Push service unavailable or VAPID key inactive. Continuing gracefully.');
        } else {
            console.warn('[FCM] Token registration note:', err?.message || err);
        }
    }
}

export function useFCMToken() {
    useEffect(() => {
        registerFCMToken();
    }, []);
}
