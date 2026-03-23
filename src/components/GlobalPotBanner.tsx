import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import PotVaultSwapper from './PotVaultSwapper';

export default function GlobalPotBanner() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const isStealthMode = useStore(state => state.isStealthMode);
    const members = useStore(state => state.members);

    const [gameweekStake, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });

    useEffect(() => {
        if (!activeLeagueId) return;
        const leagueRef = doc(db, 'leagues', activeLeagueId);
        const unsubscribe = onSnapshot(leagueRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMonthlyContribution(data.gameweekStake || 0);
                if (data.rules) setRules(data.rules);
            }
        });
        return () => unsubscribe();
    }, [activeLeagueId]);

    const paidMembersCount = members.filter(m => m.hasPaid && m.isActive !== false).length;
    const totalCollected = paidMembersCount * gameweekStake;
    const weeklyPot = totalCollected * (rules.weekly / 100);
    const seasonVaultProjected = members.length * gameweekStake * 38 * (rules.vault / 100);

    if (!activeLeagueId) return null;

    return (
        <div className="w-full mb-6">
            <PotVaultSwapper
                weeklyPot={weeklyPot}
                seasonVault={seasonVaultProjected}
                weeklyRulesPercent={rules.weekly}
                isStealthMode={isStealthMode}
            />
        </div>
    );
}
