import { create } from 'zustand';

export type Role = 'member' | 'admin' | null;

export interface Member {
    id: string;
    displayName: string;
    phone: string;
    hasPaid: boolean;
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
    setRole: (role: Role) => void;
    setLeagueSettings: (settings: LeagueSettings) => void;
    addMember: (member: Omit<Member, 'id'>) => void;
    togglePaymentStatus: (memberId: string) => void;
    logout: () => void;
}

export const useStore = create<AppState>((set) => ({
    role: null, // Initially not logged in
    league: null,
    members: [],
    setRole: (role) => set({ role }),
    setLeagueSettings: (settings) => set({ league: settings }),
    addMember: (member) =>
        set((state) => ({
            members: [
                ...state.members,
                { ...member, id: crypto.randomUUID() },
            ]
        })),
    togglePaymentStatus: (memberId) =>
        set((state) => ({
            members: state.members.map((m) =>
                m.id === memberId ? { ...m, hasPaid: !m.hasPaid } : m
            ),
        })),
    logout: () => set({ role: null }),
}));
