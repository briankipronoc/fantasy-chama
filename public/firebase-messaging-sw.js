// FantasyChama — Firebase Messaging Service Worker
// Handles background push notifications when the app is closed/unfocused.
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

// These values are safe to expose in the service worker (public config only)
firebase.initializeApp({
    apiKey: self.__FIREBASE_API_KEY__ || 'VITE_FIREBASE_API_KEY_PLACEHOLDER',
    authDomain: self.__FIREBASE_AUTH_DOMAIN__ || 'VITE_FIREBASE_AUTH_DOMAIN_PLACEHOLDER',
    projectId: self.__FIREBASE_PROJECT_ID__ || 'VITE_FIREBASE_PROJECT_ID_PLACEHOLDER',
    storageBucket: self.__FIREBASE_STORAGE_BUCKET__ || 'VITE_FIREBASE_STORAGE_BUCKET_PLACEHOLDER',
    messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || 'VITE_FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER',
    appId: self.__FIREBASE_APP_ID__ || 'VITE_FIREBASE_APP_ID_PLACEHOLDER',
});

const messaging = firebase.messaging();

// Handle background messages — show a notification when the app is in background
messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Background message received:', payload);

    const { title, body, icon } = payload.notification || {};

    self.registration.showNotification(title || 'FantasyChama', {
        body: body || 'You have a new update from your league.',
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        data: payload.data || {},
        vibrate: [200, 100, 200],
        actions: [
            { action: 'open', title: '📊 View League' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    });
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('fantasy-chama') && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow('/dashboard');
        })
    );
});
