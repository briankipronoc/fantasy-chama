import { create } from 'zustand';
import { db, auth } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, increment, query, orderBy, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export type Role = 'member' | 'admin' | null;

export interface Member {
    id: string;
    displayName: string;
    phone: string;
    hasPaid: boolean;           // kept for backward compat; derive from walletBalance >= gwCostPerRound
    walletBalance: number;      // KES balance — Module 2 Wallet Architecture
    role?: string;
    authUid?: string; // Added to map the Co-Admin strictly by Auth UID
    fplTeamId?: number; // Binds the FPL Entry ID directly to the user
    secondFplTeamId?: number; // Second FPL entry for dual-team members (independent eligibility)
    isActive?: boolean;         // Determines if a user has been deactivated from the league
    missedGameweeks?: number;   // Consecutive missed gameweeks (delinquent)
    hasAcceptedRules?: boolean;
    totalEarned?: number;       // Lifetime earnings from kickbacks
    paymentStreak?: number;     // Consecutive GWs paid without missing (Streak engine)
    fcmToken?: string;          // FCM device push token
    teamName?: string;          // FPL Team Name
    playMode?: 'pot' | 'sidebets_only'; // 'pot': regular weekly/season cash pot, 'sidebets_only': free spectator & 1v1 side bets
    joinedGw?: number;          // Gameweek joined (contributions only apply from this GW forward)
}

export interface LeagueSettings {
    name: string;
    monthlyFee: number;
    inviteCode: string;
    pendingHQDebt?: number;
    isSuspended?: boolean;
    pilotMode?: boolean;
    suspensionNudges?: string[];
    lastResolvedDate?: any; // Firestore Timestamp — used by 48h grace period engine
    referralCode?: string;  // Unique referral code for this league's chairman
    forfeitedGws?: number[]; // Gameweeks marked as unplayed/forfeited
    startGw?: number;        // Initial gameweek for the league
    paymentDetails?: string; // Chairman payment details (Till/Paybill/Pochi)
    pochiNumber?: string;    // Chairman Pochi number
    chairmanPhone?: string;  // Chairman Phone
    chairmanName?: string;   // Chairman Display Name
}

interface AppState {
    role: Role;
    league: LeagueSettings | null;
    members: Member[];
    transactions: any[];
    isStealthMode: boolean;
    setRole: (role: Role) => void;
    setLeagueSettings: (settings: LeagueSettings) => void;
    toggleStealthMode: () => void;
    addMember: (member: Omit<Member, 'id'>) => void;
    logout: () => Promise<void> | void;

    // Firebase Additions
    setMembers: (members: Member[]) => void;
    listenToLeagueSettings: (leagueId: string) => () => void;
    listenToLeagueMembers: (leagueId: string) => () => void;
    listenToLeagueTransactions: (leagueId: string) => () => void;
    togglePaymentStatus: (leagueId: string, memberId: string, currentStatus: boolean, gameweekStake?: number) => Promise<void>;
    toggleAdminStatus: (leagueId: string, memberId: string, currentRole: string | undefined) => Promise<void>;
    updateWalletBalance: (leagueId: string, memberId: string, delta: number) => Promise<void>;
    toggleMemberActiveStatus: (leagueId: string, memberId: string, newStatus: boolean) => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
    role: (((localStorage.getItem('fc-role') || localStorage.getItem('role')) as Role) || (localStorage.getItem('activeLeagueId') ? 'member' : null)), // Hydrate role with least-privilege fallback
    league: null,
    members: [],
    transactions: [],
    isStealthMode: false,
    setRole: (role) => {
        if (role) {
            localStorage.setItem('fc-role', role);
            localStorage.setItem('role', role);
        } else {
            localStorage.removeItem('fc-role');
            localStorage.removeItem('role');
        }
        set({ role });
    },
    setLeagueSettings: (settings) => set({ league: settings }),
    toggleStealthMode: () => {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('fc-stealth-anim');
            // Force reflow so repeated taps replay animation reliably.
            void document.documentElement.offsetWidth;
            document.documentElement.classList.add('fc-stealth-anim');
            window.setTimeout(() => {
                document.documentElement.classList.remove('fc-stealth-anim');
            }, 280);
        }
        set((state) => ({ isStealthMode: !state.isStealthMode }));
    },
    addMember: (member) =>
        set((state) => ({
            members: [
                ...state.members,
                { ...member, id: crypto.randomUUID() },
            ]
        })),
    logout: async () => {
        try {
            // Clear local storage — all session keys
            localStorage.removeItem('activeLeagueId');
            localStorage.removeItem('memberPhone');
            localStorage.removeItem('activeUserId');
            localStorage.removeItem('fc-role');
            localStorage.removeItem('role');
        } catch {}

        // Reset state
        try {
            set({ role: null, league: null, members: [], transactions: [] });
        } catch {}

        // Sign out from Firebase Auth safely
        try {
            await signOut(auth);
        } catch (err: any) {
            console.warn('[store] signOut non-fatal error:', err?.message || err);
        }
    },

    // Firebase Methods
    setMembers: (members) => set({ members }),

    listenToLeagueSettings: (leagueId) => {
        try {
            const leagueRef = doc(db, 'leagues', leagueId);
            const unsub = onSnapshot(leagueRef, (doc) => {
                if (doc.exists()) {
                    const data = doc.data();
                    const realName = data?.leagueName || data?.name || 'League';
                    try {
                        localStorage.setItem('activeLeagueName', realName);
                    } catch {}
                    set({ league: { ...data, name: realName, leagueName: realName } as unknown as LeagueSettings });
                }
            }, (error) => {
                console.warn('[store] listenToLeagueSettings failed:', error?.message || error);
            });
            return () => {
                try { unsub(); } catch (error: any) {
                    console.warn('[store] listenToLeagueSettings unsubscribe failed:', error?.message || error);
                }
            };
        } catch (error: any) {
            console.warn('[store] listenToLeagueSettings setup failed:', error?.message || error);
            return () => { };
        }
    },

    listenToLeagueMembers: (leagueId) => {
        try {
            const membersRef = collection(db, 'leagues', leagueId, 'memberships');
            const unsub = onSnapshot(membersRef, (snapshot) => {
                const liveMembers = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Member[];

                // Deduplicate members to prevent duplicate counts (e.g. chairman registered both as admin and member)
                const deduplicatedMap = new Map<string, Member>();
                for (const m of liveMembers) {
                    const rawPhone = (m.phone || (m as any).phoneNumber || '').replace(/\D/g, '');
                    const cleanName = (m.displayName || '').trim().toLowerCase();
                    const phoneKey = rawPhone.length >= 9 ? rawPhone.slice(-9) : '';
                    const dedupKey = phoneKey ? `p_${phoneKey}` : (cleanName ? `n_${cleanName}` : `id_${m.id}`);

                    if (!deduplicatedMap.has(dedupKey)) {
                        deduplicatedMap.set(dedupKey, m);
                    } else {
                        const existing = deduplicatedMap.get(dedupKey)!;
                        const preferExisting = existing.role === 'admin' || (existing.hasPaid && !m.hasPaid);
                        const primary = preferExisting ? existing : m;
                        const secondary = preferExisting ? m : existing;

                        const merged: Member = {
                            ...secondary,
                            ...primary,
                            id: primary.id,
                            role: (existing.role === 'admin' || m.role === 'admin') ? 'admin' : (existing.role === 'co-chair' || m.role === 'co-chair') ? 'co-chair' : primary.role,
                            hasPaid: Boolean(existing.hasPaid || m.hasPaid),
                            walletBalance: Math.max(Number(existing.walletBalance || 0), Number(m.walletBalance || 0)),
                            isActive: existing.isActive !== false && m.isActive !== false,
                        };
                        deduplicatedMap.set(dedupKey, merged);
                    }
                }

                set({ members: Array.from(deduplicatedMap.values()) });
            }, (error) => {
                console.warn('[store] listenToLeagueMembers failed:', error?.message || error);
            });
            return () => {
                try { unsub(); } catch (error: any) {
                    console.warn('[store] listenToLeagueMembers unsubscribe failed:', error?.message || error);
                }
            };
        } catch (error: any) {
            console.warn('[store] listenToLeagueMembers setup failed:', error?.message || error);
            return () => { };
        }
    },

    listenToLeagueTransactions: (leagueId) => {
        try {
            const txRef = collection(db, 'leagues', leagueId, 'transactions');
            const q = query(txRef, orderBy('timestamp', 'desc'), limit(50));
            const unsub = onSnapshot(q, (snapshot: any) => {
                const liveTxs = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data()
                }));
                set({ transactions: liveTxs });
            }, (error) => {
                console.warn('[store] listenToLeagueTransactions failed:', error?.message || error);
            });
            return () => {
                try { unsub(); } catch (error: any) {
                    console.warn('[store] listenToLeagueTransactions unsubscribe failed:', error?.message || error);
                }
            };
        } catch (error: any) {
            console.warn('[store] listenToLeagueTransactions setup failed:', error?.message || error);
            return () => { };
        }
    },

    togglePaymentStatus: async (leagueId, memberId, currentStatus, gameweekStake = 0) => {
        const memberRef = doc(db, 'leagues', leagueId, 'memberships', memberId);
        const updates: any = { hasPaid: !currentStatus };
        
        if (gameweekStake > 0) {
            const modifier = currentStatus ? -gameweekStake : gameweekStake;
            updates.walletBalance = increment(modifier);
        }

        await updateDoc(memberRef, updates);
    },

    toggleAdminStatus: async (leagueId, memberId, currentRole) => {
        const memberRef = doc(db, 'leagues', leagueId, 'memberships', memberId);
        await updateDoc(memberRef, {
            role: currentRole === 'admin' ? 'member' : 'admin'
        });
    },

    toggleMemberActiveStatus: async (leagueId, memberId, newStatus) => {
        const memberRef = doc(db, 'leagues', leagueId, 'memberships', memberId);
        await updateDoc(memberRef, {
            isActive: newStatus
        });
    },

    updateWalletBalance: async (leagueId, memberId, delta) => {
        const memberRef = doc(db, 'leagues', leagueId, 'memberships', memberId);
        await updateDoc(memberRef, { walletBalance: increment(delta) });
    },
}));
