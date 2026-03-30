import { create } from 'zustand';
import { db, auth } from '../firebase';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
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
    isActive?: boolean;         // Determines if a user has been deactivated from the league
    missedGameweeks?: number;   // Consecutive missed gameweeks (delinquent)
    hasAcceptedRules?: boolean;
    totalEarned?: number;       // Lifetime earnings from kickbacks
}

export interface LeagueSettings {
    name: string;
    monthlyFee: number;
    inviteCode: string;
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
    logout: () => void;

    // Firebase Additions
    setMembers: (members: Member[]) => void;
    listenToLeagueMembers: (leagueId: string) => void;
    listenToLeagueTransactions: (leagueId: string) => void;
    togglePaymentStatus: (leagueId: string, memberId: string, currentStatus: boolean) => Promise<void>;
    toggleAdminStatus: (leagueId: string, memberId: string, currentRole: string | undefined) => Promise<void>;
    updateWalletBalance: (leagueId: string, memberId: string, delta: number) => Promise<void>;
    toggleMemberActiveStatus: (leagueId: string, memberId: string, newStatus: boolean) => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
    role: null, // Initially not logged in
    league: null,
    members: [],
    transactions: [],
    isStealthMode: false,
    setRole: (role) => set({ role }),
    setLeagueSettings: (settings) => set({ league: settings }),
    toggleStealthMode: () => set((state) => ({ isStealthMode: !state.isStealthMode })),
    addMember: (member) =>
        set((state) => ({
            members: [
                ...state.members,
                { ...member, id: crypto.randomUUID() },
            ]
        })),
    logout: () => {
        // Clear local storage
        localStorage.removeItem('activeLeagueId');
        localStorage.removeItem('memberPhone');
        // Sign out from Firebase Auth
        signOut(auth).catch(console.error);
        
        // Reset state
        set({ role: null, league: null, members: [], transactions: [] });
    },

    // Firebase Methods
    setMembers: (members) => set({ members }),

    listenToLeagueMembers: (leagueId) => {
        const membersRef = collection(db, 'leagues', leagueId, 'memberships');
        onSnapshot(membersRef, (snapshot) => {
            const liveMembers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Member[];
            set({ members: liveMembers });
        });
    },

    listenToLeagueTransactions: (leagueId) => {
        const { query, orderBy } = require('firebase/firestore');
        const txRef = collection(db, 'leagues', leagueId, 'transactions');
        const q = query(txRef, orderBy('timestamp', 'desc'));
        onSnapshot(q, (snapshot: any) => {
            const liveTxs = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            }));
            set({ transactions: liveTxs });
        });
    },

    togglePaymentStatus: async (leagueId, memberId, currentStatus) => {
        const memberRef = doc(db, 'leagues', leagueId, 'memberships', memberId);
        await updateDoc(memberRef, {
            hasPaid: !currentStatus
        });
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
        const { increment } = await import('firebase/firestore');
        const memberRef = doc(db, 'leagues', leagueId, 'memberships', memberId);
        await updateDoc(memberRef, { walletBalance: increment(delta) });
    },
}));
