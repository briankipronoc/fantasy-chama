import { create } from 'zustand';
import { db } from '../firebase';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';

export type Role = 'member' | 'admin' | null;

export interface Member {
    id: string;
    displayName: string;
    phone: string;
    hasPaid: boolean;           // kept for backward compat; derive from walletBalance >= gwCostPerRound
    walletBalance: number;      // KES balance — Module 2 Wallet Architecture
    role?: string;
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
    isStealthMode: boolean;
    setRole: (role: Role) => void;
    setLeagueSettings: (settings: LeagueSettings) => void;
    toggleStealthMode: () => void;
    addMember: (member: Omit<Member, 'id'>) => void;
    logout: () => void;

    // Firebase Additions
    setMembers: (members: Member[]) => void;
    listenToLeagueMembers: (leagueId: string) => void;
    togglePaymentStatus: (leagueId: string, memberId: string, currentStatus: boolean) => Promise<void>;
    updateWalletBalance: (leagueId: string, memberId: string, delta: number) => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
    role: null, // Initially not logged in
    league: null,
    members: [],
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
    logout: () => set({ role: null }),

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

    togglePaymentStatus: async (leagueId, memberId, currentStatus) => {
        const memberRef = doc(db, 'leagues', leagueId, 'memberships', memberId);
        await updateDoc(memberRef, {
            hasPaid: !currentStatus
        });
    },

    updateWalletBalance: async (leagueId, memberId, delta) => {
        const { increment } = await import('firebase/firestore');
        const memberRef = doc(db, 'leagues', leagueId, 'memberships', memberId);
        await updateDoc(memberRef, { walletBalance: increment(delta) });
    },
}));
