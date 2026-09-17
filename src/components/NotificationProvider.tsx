import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
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
                color: '#1e293b',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }
            : {
                background: '#161d24',
                color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)'
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

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            let seasonResetTime: Date | null = null;
            try {
                const leagueDoc = await getDoc(doc(db, 'leagues', activeLeagueId));
                if (leagueDoc.exists()) {
                    const data = leagueDoc.data();
                    if (data?.seasonResetAt?.toDate) {
                        seasonResetTime = data.seasonResetAt.toDate();
                    }
                }
            } catch {}

            const notifs = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as Notification[];

            // Filter out notifications created prior to the last season archive/reset
            const currentSeasonNotifs = seasonResetTime
                ? notifs.filter(n => {
                    const notifDate = n.timestamp?.toDate ? n.timestamp.toDate() : new Date(0);
                    return notifDate >= seasonResetTime!;
                })
                : notifs;

            setNotifications(currentSeasonNotifs);

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
                window.scrollTo({ top: 0, behavior: 'smooth' });
                toast.success(newNotif.message, {
                    id: 'financial-toast', // ensures only 1 shown at a time (replaces previous)
                    style: {
                        background: palette.background,
                        color: palette.color,
                        border: palette.border,
                        borderRadius: '12px',
                        fontWeight: 600,
                        fontSize: '13px',
                        padding: '12px 16px',
                        boxShadow: palette.boxShadow,
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        maxWidth: '28rem',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        lineHeight: '1.45',
                    },
                    iconTheme: {
                        primary: '#10B981',
                        secondary: '#ffffff',
                    }
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

    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAllAsRead, markAsRead }}>
            {children}
            {/* Phase 10.5: Strict Toaster — theme-aware, top-center mobile / top-right desktop, highest zIndex */}
            <Toaster
                position={isMobile ? "top-center" : "top-right"}
                toastOptions={{
                    duration: 3600,
                    className: 'fc-toast-item',
                    style: {
                        fontFamily: 'inherit',
                        background: 'var(--fc-toast-bg, rgba(14, 20, 25, 0.96))',
                        color: 'var(--fc-toast-color, #f8fafc)',
                        border: '1px solid var(--fc-toast-border, rgba(16,185,129,0.28))',
                        borderRadius: '16px',
                        fontWeight: 700,
                        fontSize: '13px',
                        padding: '12px 18px',
                        boxShadow: 'var(--fc-toast-shadow, 0 16px 40px rgba(0,0,0,0.3))',
                        backdropFilter: 'blur(20px) saturate(140%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                        maxWidth: 'min(28rem, calc(100vw - 2rem))',
                        width: 'auto',
                        whiteSpace: 'normal',
                        wordBreak: 'normal',
                        overflowWrap: 'break-word',
                        lineHeight: '1.45',
                        boxSizing: 'border-box',
                    },
                    success: {
                        iconTheme: { primary: '#10B981', secondary: '#ffffff' },
                    },
                    error: {
                        style: {
                            background: 'var(--fc-toast-bg, rgba(14, 20, 25, 0.96))',
                            color: 'var(--fc-toast-color, #f8fafc)',
                            border: '1px solid rgba(239,68,68,0.35)',
                            whiteSpace: 'normal',
                            wordBreak: 'normal',
                            overflowWrap: 'break-word',
                            lineHeight: '1.45',
                        },
                        iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
                    }
                }}
                containerStyle={{
                    top: isMobile ? 16 : 84,
                    zIndex: 999999,
                }}
            />
        </NotificationContext.Provider>
    );
}
