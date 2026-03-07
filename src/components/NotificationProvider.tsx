import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
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
    markAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextProps>({
    notifications: [],
    unreadCount: 0,
    markAsRead: () => { }
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id'; // using fallback to avoid crashing if empty MVP
    const members = useStore(state => state.members);

    // We need a stable activeUserId from members if falling back
    const realActiveUser = members.find(m => m.id === activeUserId)?.id || members[0]?.id || activeUserId;

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [initialLoad, setInitialLoad] = useState(true);

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

            // Toast new notifications if not initial load
            if (!initialLoad) {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const newNotif = change.doc.data() as Notification;
                        // Avoid toasting our own nudges or things we've already read
                        if (!newNotif.readBy?.includes(realActiveUser)) {
                            if (newNotif.type === 'success') toast.success(newNotif.message, { style: { background: '#10B981', color: '#0b1014' } });
                            else if (newNotif.type === 'warning') toast.error(newNotif.message, { style: { background: '#EF4444', color: '#fff' } });
                            else toast(newNotif.message, { icon: '🏆', style: { background: '#FBBF24', color: '#0b1014' } });

                            // Native OS Push Notification
                            if ('Notification' in window && Notification.permission === 'granted') {
                                try {
                                    new window.Notification('The Big League', {
                                        body: newNotif.message,
                                    });
                                } catch (e) {
                                    console.log('Mobile PWA Native Push required ServiceWorker context:', e);
                                }
                            }
                        }
                    }
                });
            } else {
                setInitialLoad(false);
            }
        });

        return () => unsubscribe();
    }, [activeLeagueId, realActiveUser, initialLoad]);

    const unreadCount = notifications.filter(n => !n.readBy?.includes(realActiveUser)).length;

    const markAsRead = () => {
        // In a real app, update Firestore readBy array here.
        // For MVP, we can locally mark them read by adding user to local state, 
        // to avoid mass writes.
        setNotifications(prev => prev.map(n => ({
            ...n,
            readBy: [...(n.readBy || []), realActiveUser]
        })));
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead }}>
            {children}
            <Toaster position="bottom-center" toastOptions={{ className: 'font-bold text-sm shadow-xl rounded-xl border border-white/10' }} />
        </NotificationContext.Provider>
    );
}
