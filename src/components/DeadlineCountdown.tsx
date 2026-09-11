// src/components/DeadlineCountdown.tsx
import { useState, useEffect, useMemo } from 'react';
import { Clock, Flame } from 'lucide-react';
import { useStore } from '../store/useStore';
import { haptics } from '../utils/haptics';
import BanterNudgeModal from './BanterNudgeModal';

interface DeadlineCountdownProps {
  className?: string;
  leagueName?: string;
  gameweekStake?: number;
}

export default function DeadlineCountdown({
  className = '',
  leagueName,
  gameweekStake,
}: DeadlineCountdownProps) {
  const members = useStore((state) => state.members);
  const role = useStore((state) => state.role);
  const league = useStore((state) => state.league);

  const effectiveLeagueName = leagueName || league?.name || 'FantasyChama';
  const effectiveStake = (gameweekStake && gameweekStake > 0) ? gameweekStake : (league?.monthlyFee || 0);

  const [nextEvent, setNextEvent] = useState<{ id: number; name: string; deadline_time: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalMs: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch next FPL deadline
  useEffect(() => {
    let isMounted = true;
    fetch('/fpl-api/bootstrap-static/')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!isMounted || !data?.events) return;
        const events = data.events;
        // Next event is either the current unfinished event or the next upcoming event
        const upcoming = events.find((e: any) => !e.finished && new Date(e.deadline_time).getTime() > Date.now())
          || events.find((e: any) => e.is_next)
          || events.find((e: any) => e.is_current);

        if (upcoming?.deadline_time) {
          setNextEvent({
            id: upcoming.id,
            name: upcoming.name,
            deadline_time: upcoming.deadline_time,
          });
        }
      })
      .catch((err) => {
        console.warn('[deadline-countdown] Failed to fetch FPL events:', err?.message || err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update countdown ticker every second
  useEffect(() => {
    if (!nextEvent?.deadline_time) return;

    const calculateTime = () => {
      const targetTime = new Date(nextEvent.deadline_time).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft({ hours, minutes, seconds, totalMs: diff });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [nextEvent?.deadline_time]);

  // Format date in Kenyan local time (EAT: UTC+3)
  const formattedDeadline = useMemo(() => {
    if (!nextEvent?.deadline_time) return 'TBD';
    const date = new Date(nextEvent.deadline_time);
    return date.toLocaleString('en-KE', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi',
    });
  }, [nextEvent?.deadline_time]);

  // Filter unpaid members
  const unpaidMembers = useMemo(() => {
    return members.filter((m) => {
      const isFunded = m.hasPaid === true || (effectiveStake > 0 && (m.walletBalance || 0) >= effectiveStake);
      return !isFunded && m.isActive !== false && m.role !== 'admin';
    });
  }, [members, effectiveStake]);

  if (!nextEvent || !timeLeft) return null;

  const totalHours = timeLeft.hours;
  const isUrgent = totalHours < 2; // under 2 hours
  const isWarning = totalHours < 24; // under 24 hours

  // Format countdown label
  const countdownString = totalHours >= 24
    ? `${Math.floor(totalHours / 24)}d ${totalHours % 24}h left`
    : `${totalHours}h ${timeLeft.minutes}m left`;

  return (
    <>
      <button
        onClick={() => {
          haptics.selection();
          setIsModalOpen(true);
        }}
        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none active:scale-95 ${
          isUrgent
            ? 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse'
            : isWarning
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
        } ${className}`}
        title={`Click to send Banter Nudges for GW${nextEvent.id}`}
      >
        <span className="relative flex h-2 w-2">
          {isWarning && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isUrgent ? 'bg-red-400' : 'bg-amber-400'
              }`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isUrgent ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-400'
            }`}
          />
        </span>

        <span className="flex items-center gap-1 font-mono tracking-tight text-[11px] sm:text-xs">
          <Clock className="w-3.5 h-3.5 opacity-70" />
          <strong className="text-white">GW{nextEvent.id}:</strong>
          <span>{countdownString}</span>
        </span>

        {unpaidMembers.length > 0 && role === 'admin' && (
          <span className="hidden sm:inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Flame className="w-2.5 h-2.5" />
            {unpaidMembers.length} unpaid
          </span>
        )}
      </button>

      {/* Banter Nudge Modal */}
      <BanterNudgeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        leagueName={effectiveLeagueName}
        nextGw={nextEvent.id}
        deadlineFormatted={formattedDeadline}
        unpaidMembers={unpaidMembers}
        gameweekStake={effectiveStake}
      />
    </>
  );
}
