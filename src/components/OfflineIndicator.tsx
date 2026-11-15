import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/95 border border-amber-300/60 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xl"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>حالت آفلاین فعال است — تغییرات در حافظه محلی ذخیره می‌شوند</span>
    </div>
  );
};
