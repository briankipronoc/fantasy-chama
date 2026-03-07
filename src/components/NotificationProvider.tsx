import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast, Toaster } from 'react-hot-toast';
import { useStore } from '../store/useStore';

export interface Notification {
    id: string;
    type: 'success' | 'warning' | 'info';
    message: string;
    timestamp: any;
    readBy: string[];
    isWinnerEvent?: boolean;
    winnerId?: string;
    winnerName?: string;
    points?: number;
    gw?: number;
    prize?: number;
}

interface NotificationContextProps {
    notifications: Notification[];
    unreadCount: number;
    markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextProps>({
    notifications: [],
    unreadCount: 0,
    markAllAsRead: () => { }
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id';
    const members = useStore(state => state.members);

    const realActiveUser = members.find(m => m.id === activeUserId)?.id || members[0]?.id || activeUserId;

    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Capture the mount timestamp — only show toasts for notifications NEWER than this
    const mountTimeRef = useRef<Date>(new Date());

    useEffect(() => {
        if (!activeLeagueId) return;

        // Request Push OS Notification Permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const notifRef = collection(db, 'leagues', activeLeagueId, 'notifications');
        const q = query(notifRef, orderBy('timestamp', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];

            setNotifications(notifs);

            // Only toast genuinely new notifications (server timestamp > mount time)
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const newNotif = change.doc.data() as Notification;

                    // Guard: skip if already read by this user
                    if (newNotif.readBy?.includes(realActiveUser)) return;

                    // Guard: only fire toasts for docs with a timestamp AFTER we mounted
                    const notifDate = newNotif.timestamp?.toDate ? newNotif.timestamp.toDate() : new Date(0);
                    if (notifDate <= mountTimeRef.current) return;

                    // It's a truly new notification — display it
                    if (newNotif.type === 'success') {
                        toast.success(newNotif.message, {
                            style: { background: '#10B981', color: '#0b1014' }
                        });
                    } else if (newNotif.type === 'warning') {
                        toast.error(newNotif.message, {
                            style: { background: '#1a1205', color: '#FBBF24', borderColor: '#FBBF24', border: '1px solid' }
                        });
                    } else {
                        toast(newNotif.message, {
                            icon: '🏆',
                            style: { background: '#161d24', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }
                        });
                    }

                    // Native OS Push Notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        try {
                            new window.Notification('FantasyChama', { body: newNotif.message });
                        } catch (e) {
                            // ServiceWorker context needed for PWA push
                        }
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [activeLeagueId, realActiveUser]);

    const unreadCount = notifications.filter(n => !n.readBy?.includes(realActiveUser)).length;

    // Write to Firestore — appends user ID to each unread notification's readBy array
    const markAllAsRead = async () => {
        if (!activeLeagueId) return;
        const unread = notifications.filter(n => !n.readBy?.includes(realActiveUser));

        // Optimistic local update first for instant UI feedback
        setNotifications(prev => prev.map(n => ({
            ...n,
            readBy: n.readBy?.includes(realActiveUser) ? n.readBy : [...(n.readBy || []), realActiveUser]
        })));

        // Persist to Firestore in the background
        await Promise.allSettled(
            unread.map(n =>
                updateDoc(doc(db, 'leagues', activeLeagueId, 'notifications', n.id), {
                    readBy: arrayUnion(realActiveUser)
                })
            )
        );
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAllAsRead }}>
            {children}
            <Toaster
                position="bottom-center"
                toastOptions={{
                    className: 'font-bold text-sm shadow-xl rounded-xl border border-white/10',
                    duration: 5000,
                }}
            />
        </NotificationContext.Provider>
    );
}
