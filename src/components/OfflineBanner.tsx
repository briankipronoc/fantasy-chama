// src/components/OfflineBanner.tsx
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top duration-300">
      <WifiOff className="w-4 h-4" />
      <span>You are offline — showing cached Chama data. Changes will sync once reconnected.</span>
    </div>
  );
}
