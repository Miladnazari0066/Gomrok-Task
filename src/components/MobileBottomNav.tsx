import React from 'react';
import { PackageCheck, LogOut, BarChart3, FileSignature, SlidersHorizontal } from 'lucide-react';
import { fa } from '../utils/jalali';

export type MainTabKey = 'entry' | 'exit' | 'reports' | 'letters';

interface MobileBottomNavProps {
  activeTab: MainTabKey;
  onSelectTab: (tab: MainTabKey) => void;
  onOpenTools: () => void;
  isToolsOpen?: boolean;
  hasToolsAlert?: boolean;
  canViewEntry: boolean;
  canViewExit: boolean;
  canViewReports: boolean;
  canViewLetters: boolean;
  entryCount: number;
  exitCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenTools,
  isToolsOpen = false,
  hasToolsAlert = false,
  canViewEntry,
  canViewExit,
  canViewReports,
  canViewLetters,
  entryCount,
  exitCount,
}) => {
  const items: Array<{
    id: MainTabKey | 'tools';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    alertDot?: boolean;
    activeText: string;
    activeBar: string;
    activeIconBg: string;
    onClick: () => void;
  }> = [];

  if (canViewEntry) {
    items.push({
      id: 'entry',
      label: 'ورود کالا',
      icon: PackageCheck,
      badge: entryCount,
      activeText: 'text-cyan-300',
      activeBar: 'bg-cyan-400',
      activeIconBg: 'bg-cyan-500/20 border-cyan-400/45',
      onClick: () => onSelectTab('entry'),
    });
  }
  if (canViewExit) {
    items.push({
      id: 'exit',
      label: 'خروج کالا',
      icon: LogOut,
      badge: exitCount,
      activeText: 'text-blue-300',
      activeBar: 'bg-blue-400',
      activeIconBg: 'bg-blue-500/20 border-blue-400/45',
      onClick: () => onSelectTab('exit'),
    });
  }
  if (canViewReports) {
    items.push({
      id: 'reports',
      label: 'گزارش‌گیری',
      icon: BarChart3,
      activeText: 'text-emerald-300',
      activeBar: 'bg-emerald-400',
      activeIconBg: 'bg-emerald-500/20 border-emerald-400/45',
      onClick: () => onSelectTab('reports'),
    });
  }
  if (canViewLetters) {
    items.push({
      id: 'letters',
      label: 'نامه‌ها',
      icon: FileSignature,
      activeText: 'text-amber-300',
      activeBar: 'bg-amber-400',
      activeIconBg: 'bg-amber-500/20 border-amber-400/45',
      onClick: () => onSelectTab('letters'),
    });
  }

  // Dedicated thumb-zone Tools & Settings tab
  items.push({
    id: 'tools',
    label: 'ابزارها',
    icon: SlidersHorizontal,
    alertDot: hasToolsAlert,
    activeText: 'text-cyan-200',
    activeBar: 'bg-cyan-300',
    activeIconBg: 'bg-white/15 border-white/30',
    onClick: onOpenTools,
  });

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="ناوبری اصلی موبایل"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#050a16] border-t border-white/15 pb-safe-bar shadow-[0_-10px_30px_rgba(0,0,0,0.9)] font-vazir dir-rtl select-none print:hidden"
    >
      <div
        className="grid items-stretch"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'tools' ? isToolsOpen : !isToolsOpen && activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative min-h-[56px] py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 cursor-pointer ${
                isActive ? item.activeText : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span
                  className={`absolute top-0 inset-x-3 h-[2.5px] rounded-b-full ${item.activeBar}`}
                />
              )}

              <div
                className={`relative w-8 h-7 rounded-xl flex items-center justify-center border transition-colors ${
                  isActive
                    ? item.activeIconBg
                    : 'bg-transparent border-transparent'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`absolute -top-1.5 -left-2 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-mono tabular-nums font-black flex items-center justify-center border ${
                      isActive
                        ? 'bg-slate-950 text-white border-white/30'
                        : 'bg-slate-800 text-slate-300 border-white/15'
                    }`}
                  >
                    {fa(item.badge)}
                  </span>
                )}
                {item.alertDot && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#050a16]" />
                )}
              </div>

              <span className="text-[10px] font-bold leading-tight truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
