import React from 'react';
import {
  PackageCheck,
  LogOut,
  BarChart3,
  FileSignature,
  SlidersHorizontal,
} from 'lucide-react';
import { fa } from '../utils/jalali';
import { MainTabType } from '../types';

interface MobileBottomNavProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  toolsAlertCount?: number;
  hasSecurityWarning?: boolean;
  canViewEntry: boolean;
  canViewExit: boolean;
  canViewReports: boolean;
  canViewLetters: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  toolsAlertCount = 0,
  hasSecurityWarning = false,
  canViewEntry,
  canViewExit,
  canViewReports,
  canViewLetters,
}) => {
  const items: Array<{
    id: MainTabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    activeText: string;
    activeIndicator: string;
    badgeCount?: number;
    warningDot?: boolean;
  }> = [];

  if (canViewEntry) {
    items.push({
      id: 'entry',
      label: 'ورود',
      icon: PackageCheck,
      activeText: 'text-cyan-300',
      activeIndicator: 'bg-cyan-400',
    });
  }
  if (canViewExit) {
    items.push({
      id: 'exit',
      label: 'خروج',
      icon: LogOut,
      activeText: 'text-blue-300',
      activeIndicator: 'bg-blue-400',
    });
  }
  if (canViewReports) {
    items.push({
      id: 'reports',
      label: 'گزارش',
      icon: BarChart3,
      activeText: 'text-emerald-300',
      activeIndicator: 'bg-emerald-400',
    });
  }
  if (canViewLetters) {
    items.push({
      id: 'letters',
      label: 'نامه‌ها',
      icon: FileSignature,
      activeText: 'text-amber-300',
      activeIndicator: 'bg-amber-400',
    });
  }

  items.push({
    id: 'tools',
    label: 'ابزارها',
    icon: SlidersHorizontal,
    activeText: 'text-cyan-200',
    activeIndicator: 'bg-cyan-300',
    badgeCount: toolsAlertCount > 0 ? toolsAlertCount : undefined,
    warningDot: toolsAlertCount === 0 && hasSecurityWarning,
  });

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="ناوبری اصلی موبایل"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#070d1a] border-t border-white/10 pb-safe-bar shadow-[0_-8px_24px_rgba(0,0,0,0.75)] font-vazir dir-rtl select-none print:hidden"
    >
      <div
        className="grid items-stretch max-w-lg mx-auto"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative min-h-[56px] pt-2 pb-1.5 px-1 flex flex-col items-center justify-center gap-1 transition-colors duration-150 active:scale-95 cursor-pointer ${
                isActive ? item.activeText : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Crisp Top Active Accent Line */}
              <span
                aria-hidden="true"
                className={`absolute top-0 w-7 h-[2px] rounded-full transition-opacity duration-150 ${
                  isActive ? `${item.activeIndicator} opacity-100` : 'opacity-0'
                }`}
              />

              {/* Clean Unboxed Icon with Single Alert Indicator on Tools */}
              <span className="relative flex items-center justify-center w-6 h-6">
                <Icon className="w-[20px] h-[20px]" />
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span className="absolute -top-1.5 -left-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono tabular-nums font-bold flex items-center justify-center ring-2 ring-[#070d1a]">
                    {item.badgeCount > 99 ? '+۹۹' : fa(item.badgeCount)}
                  </span>
                )}
                {item.warningDot && (
                  <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#070d1a]" />
                )}
              </span>

              {/* Single-Word Crisp Label */}
              <span
                className={`text-[11px] leading-none whitespace-nowrap ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
