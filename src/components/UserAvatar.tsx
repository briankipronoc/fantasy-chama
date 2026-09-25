// src/components/UserAvatar.tsx
import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { auth } from '../firebase';

interface UserAvatarProps {
  name?: string;
  photoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showRing?: boolean;
}

// Deterministic high-contrast aesthetic palettes for initials
const COLOR_PALETTES = [
  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  { bg: 'bg-slate-500/15 dark:bg-slate-400/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/30' },
];

function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'FC';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPalette(name?: string) {
  if (!name) return COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm font-black',
  lg: 'w-12 h-12 text-base font-black',
  xl: 'w-16 h-16 text-xl font-black',
};

export default function UserAvatar({
  name,
  photoUrl,
  size = 'md',
  className = '',
  showRing = true,
}: UserAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const initials = getInitials(name);
  const palette = getPalette(name);
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  const members = useStore((state) => state.members);

  const resolvedPhoto = useMemo(() => {
    if (photoUrl) return photoUrl;

    const localSavedAvatar = typeof window !== 'undefined' ? localStorage.getItem('fc_user_avatar') : null;
    const currentUserName = auth.currentUser?.displayName || (typeof window !== 'undefined' ? localStorage.getItem('activeUserName') : null);

    if (localSavedAvatar && name && currentUserName && name.trim().toLowerCase() === currentUserName.trim().toLowerCase()) {
      return localSavedAvatar;
    }

    if (auth.currentUser?.photoURL && name && currentUserName && name.trim().toLowerCase() === currentUserName.trim().toLowerCase()) {
      return auth.currentUser.photoURL;
    }

    if (name && members && members.length > 0) {
      const cleanTarget = name.trim().toLowerCase();
      const match = members.find((m: any) => {
        const d = (m.displayName || '').trim().toLowerCase();
        const f = (m.fplTeamName || m.teamName || '').trim().toLowerCase();
        return d === cleanTarget || f === cleanTarget || (d && cleanTarget && (d.includes(cleanTarget) || cleanTarget.includes(d)));
      });
      if (match && ((match as any).photoUrl || (match as any).avatarUrl)) {
        return (match as any).photoUrl || (match as any).avatarUrl;
      }
    }

    if (localSavedAvatar && (!name || name === 'Manager' || name === 'You')) {
      return localSavedAvatar;
    }

    return null;
  }, [photoUrl, name, members]);

  const showImage = Boolean(resolvedPhoto && !hasImageError);

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full select-none shrink-0 font-mono font-bold uppercase tracking-wider overflow-hidden ${sizeClasses} ${palette.bg} ${palette.text} ${showRing ? `border ${palette.border}` : ''} ${className}`}
      title={name || 'Manager'}
    >
      {showImage ? (
        <img
          src={resolvedPhoto!}
          alt={name || 'Manager Avatar'}
          onError={() => setHasImageError(true)}
          className="w-full h-full object-cover rounded-full"
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

