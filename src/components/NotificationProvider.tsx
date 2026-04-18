import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast, Toaster } from 'react-hot-toast';
import { useStore } from '../store/useStore';

export interface Notification {
    id: string;
    type: 'success' | 'warning' | 'info' | 'transactionSuccess';
    message: string;
    timestamp: any;
    readBy: string[];
    isWinnerEvent?: boolean;
    winnerId?: string;
    winnerName?: string;
    points?: number;
    gw?: number;
    prize?: number;
    targetMemberId?: string;
}

interface NotificationContextProps {
    notifications: Notification[];
    unreadCount: number;
    markAllAsRead: () => void;
    markAsRead: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps>({
    notifications: [],
    unreadCount: 0,
    markAllAsRead: () => { },
    markAsRead: async () => { }
});

export const useNotifications = () => useContext(NotificationContext);

// Financial receipts and personal success events that deserve an immediate toast
const TOAST_TYPES: Notification['type'][] = ['transactionSuccess', 'success'];

export function NotificationProvider({ children }: { children: ReactNode }) {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id';
    const members = useStore(state => state.members);

    const realActiveUser = members.find(m => m.id === activeUserId)?.id || members[0]?.id || activeUserId;

    const [notifications, setNotifications] = useState<Notification[]>([]);

    const isVisibleToUser = (notification: Notification) => {
        return !notification.targetMemberId || notification.targetMemberId === realActiveUser;
    };

    const getToastPalette = () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        return isLight
            ? {
                background: '#ffffff',
                color: '#047857',
                border: '1px solid rgba(4,120,87,0.25)',
                boxShadow: '0 8px 24px rgba(15,23,42,0.12)'
            }
            : {
                background: '#0e1419',
                color: '#10B981',
                border: '1px solid rgba(16,185,129,0.25)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            };
    };

    // Capture mount timestamp — only show toasts for notifications NEWER than this
    const mountTimeRef = useRef<Date>(new Date());

    useEffect(() => {
        if (!activeLeagueId) return;

        // Request OS Push Notification Permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const notifRef = collection(db, 'leagues', activeLeagueId, 'notifications');
        const q = query(notifRef, orderBy('timestamp', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as Notification[];

            setNotifications(notifs);

            // Phase 10.5 Toast Rules:
            // - Only fire for 'transactionSuccess' type (financial confirmations)
            // - Only if the notification was created AFTER this session mounted
            // - Only if not already read by this user
            snapshot.docChanges().forEach((change) => {
                if (change.type !== 'added') return;
                const newNotif = change.doc.data() as Notification;

                // Silently ignore — route to inbox only
                if (!TOAST_TYPES.includes(newNotif.type)) return;

                // Already read → skip
                if (newNotif.readBy?.includes(realActiveUser)) return;

                // Old notification from a previous session → skip
                const notifDate = newNotif.timestamp?.toDate ? newNotif.timestamp.toDate() : new Date(0);
                if (notifDate <= mountTimeRef.current) return;

                // Targeted notification — must match current user to show a toast
                if (newNotif.targetMemberId && newNotif.targetMemberId !== realActiveUser) return;

                // Avoid aggressive toasts for general system announcements (unless it's an overarching transaction success)
                if (!newNotif.targetMemberId && newNotif.type !== 'transactionSuccess') return;

                // 🔔 Financial/Personal confirmation toast — slide up from bottom-right
                const palette = getToastPalette();
                toast.success(newNotif.message, {
                    id: 'financial-toast', // ensures only 1 shown at a time (replaces previous)
                    style: {
                        background: palette.background,
                        color: palette.color,
                        border: palette.border,
                        borderRadius: '14px',
                        fontWeight: 700,
                        fontSize: '13px',
                        padding: '14px 18px',
                        boxShadow: palette.boxShadow,
                    },
                });

                // OS push (best-effort)
                if ('Notification' in window && Notification.permission === 'granted') {
                    try { new window.Notification('FantasyChama', { body: newNotif.message }); } catch { }
                }
            });
        }, (error) => {
            console.warn('[notifications] snapshot listener failed:', error?.message || error);
        });

        return () => {
            try {
                unsubscribe();
            } catch (error: any) {
                console.warn('[notifications] unsubscribe failed:', error?.message || error);
            }
        };
    }, [activeLeagueId, realActiveUser]);

    const unreadCount = notifications.filter(n => isVisibleToUser(n) && !n.readBy?.includes(realActiveUser)).length;

    const markAllAsRead = async () => {
        if (!activeLeagueId) return;
        const unread = notifications.filter(n => isVisibleToUser(n) && !n.readBy?.includes(realActiveUser));

        // Optimistic local update for instant UI feedback
        setNotifications(prev => prev.map(n => ({
            ...n,
            readBy: n.readBy?.includes(realActiveUser) ? n.readBy : [...(n.readBy || []), realActiveUser]
        })));

        // Persist to Firestore in background
        await Promise.allSettled(
            unread.map(n =>
                updateDoc(doc(db, 'leagues', activeLeagueId, 'notifications', n.id), {
                    readBy: arrayUnion(realActiveUser)
                })
            )
        );
    };

    const markAsRead = async (notificationId: string) => {
        if (!activeLeagueId) return;
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification || !isVisibleToUser(notification) || notification.readBy?.includes(realActiveUser)) return;

        setNotifications(prev => prev.map(n => (
            n.id === notificationId
                ? { ...n, readBy: [...(n.readBy || []), realActiveUser] }
                : n
        )));

        await updateDoc(doc(db, 'leagues', activeLeagueId, 'notifications', notificationId), {
            readBy: arrayUnion(realActiveUser)
        });
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAllAsRead, markAsRead }}>
            {children}
            {/* Phase 10.5: Strict Toaster — bottom-right, max 1, 4s, financial only */}
            <Toaster
                position="bottom-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        fontFamily: 'inherit',
                    },
                    success: {
                        iconTheme: { primary: '#10B981', secondary: '#0e1419' },
                    },
                }}
                containerStyle={{ bottom: 80 }} // clear the mobile nav bar
            />
        </NotificationContext.Provider>
    );
}
