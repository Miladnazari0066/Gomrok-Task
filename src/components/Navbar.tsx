import React, { useState, useEffect } from 'react';
import {
  LogOut,
  ShieldCheck,
  CloudCheck,
  CloudOff,
  RefreshCw,
  PieChart,
  Bell,
  ClipboardList,
  UserCheck,
  Building2,
  Crown,
} from 'lucide-react';
import { toJalali, WDN, JMONTHS, fa, pad2 } from '../utils/jalali';
import { isSupabaseConfigured } from '../lib/supabase';
import { PWAInstallButton } from './PWAInstallButton';
import type {
  CompanyMember,
  CompanyProfile,
  WorkspaceMembershipSummary,
} from '../types';

interface NavbarProps {
  onLogout: () => void;
  onClearAllData?: () => void;
  onOpenCloudDb?: () => void;
  onManualSync?: () => void;
  onOpenSummaryModal?: () => void;
  onOpenSecurityCenter?: () => void;
  onOpenCompanySettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenDailyTasks?: () => void;
  unreadNotificationsCount?: number;
  pendingTasksCount?: number;
  overdueTasksCount?: number;
  company?: CompanyProfile | null;
  member?: CompanyMember | null;
  roleName?: string;
  allMemberships?: WorkspaceMembershipSummary[];
  onSwitchCompany?: (companyId: string) => void;
  lastCloudSyncTime?: Date | null;
  isCloudSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onLogout,
  onOpenCloudDb,
  onOpenSummaryModal,
  onOpenSecurityCenter,
  onOpenCompanySettings,
  onOpenNotifications,
  onOpenDailyTasks,
  unreadNotificationsCount = 0,
  pendingTasksCount = 0,
  overdueTasksCount = 0,
  company,
  member,
  roleName,
  allMemberships = [],
  onSwitchCompany,
  isCloudSyncing = false,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [shortDateStr, setShortDateStr] = useState('');

  const isCloud = isSupabaseConfigured();

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const j = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      setDateStr(`${WDN[now.getDay()]} ${fa(j.jd)} ${JMONTHS[j.jm - 1]} ${fa(j.jy)}`);
      setShortDateStr(`${fa(j.jd)} ${JMONTHS[j.jm - 1]} ${fa(j.jy)}`);
      setTimeStr(fa(`${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const displayTitle = company?.name || 'مدیریت کارهای گمرک';
  const opsSubtitle = company
    ? company.enableImport && company.enableExport
      ? 'واردات و صادرات · کنترل ورود، تجمیع و خروج'
      : company.enableImport
        ? 'عملیات واردات · ورود کالا و تجمیع انبار'
        : 'عملیات صادرات · خروج کالا، آزمایشگاه و ۹۰/۱۰'
    : 'Customs Task Management · کنترل ورود، تجمیع و خروج';

  return (
    <header className="sticky top-0 z-30 pt-safe-header bg-[#060b17]/95 border-b border-white/10 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.75)] font-vazir dir-rtl select-none print:hidden">
      {/* Main Desktop & Mobile Header Row */}
      <div className="max-w-[1460px] mx-auto px-3.5 sm:px-6 h-[46px] md:h-auto md:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo & Company Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-initial">
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden border border-cyan-400/45 bg-[#071A21] shadow-md shrink-0 flex items-center justify-center">
            <img
              src={company?.logoUrl || 'pwa-192x192.png'}
              alt={`لوگوی ${displayTitle}`}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-lalezar text-[15px] sm:text-xl lg:text-2xl font-normal leading-tight text-slate-100 tracking-wide truncate">
              {displayTitle}
            </h1>
            <p className="hidden sm:block text-[11px] text-slate-400 font-medium truncate">
              {opsSubtitle}
            </p>
          </div>
        </div>

        {/* Live Jalali Clock (Desktop / Large Tablet) */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs text-slate-200 bg-[#0c1426] border border-white/15 px-3.5 py-1.5 rounded-full shrink-0">
          <span className="text-xs font-medium text-slate-300 whitespace-nowrap">{dateStr}</span>
          <span className="w-px h-3.5 bg-white/20" />
          <span className="font-lalezar text-sm text-cyan-300 tracking-wider font-normal tabular-nums whitespace-nowrap">
            {timeStr}
          </span>
        </div>

        {/* Controls Bar - Desktop / Tablet (>= md) */}
        <div className="hidden md:flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Multi-Company Switcher (only if user belongs to > 1 company) */}
          {allMemberships.length > 1 && onSwitchCompany && company && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border bg-indigo-500/15 border-indigo-400/40 text-indigo-200">
              <Building2 className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <select
                value={company.id}
                onChange={(e) => onSwitchCompany(e.target.value)}
                className="bg-transparent text-indigo-100 font-bold outline-none cursor-pointer text-xs max-w-[140px]"
                title="تغییر شرکت فعال"
              >
                {allMemberships.map((ms) => (
                  <option key={ms.companyId} value={ms.companyId} className="bg-[#0c0e14] text-slate-100">
                    {ms.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Authenticated Member & Role Badge */}
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-cyan-500/15 border-cyan-400/40 text-cyan-200 shrink-0">
            {member?.isOwner ? (
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <b className="font-bold whitespace-nowrap max-w-[120px] truncate">
              {member?.fullName || 'کاربر'}
            </b>
            {roleName && (
              <span className="text-[10px] text-cyan-300/80 border-r border-cyan-400/30 pr-1.5 whitespace-nowrap">
                {roleName}
              </span>
            )}
          </div>

          {/* Company Settings Button (Authorized Admins / Owner) */}
          {onOpenCompanySettings && (
            <button
              type="button"
              onClick={onOpenCompanySettings}
              className="flex items-center gap-1.5 text-xs text-cyan-100 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/45 px-3 py-1.5 rounded-full transition-colors cursor-pointer font-bold shrink-0 whitespace-nowrap"
              title="تنظیمات شرکت، کاربران، نقش‌ها و راه‌اندازی"
            >
              <Building2 className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="hidden xl:inline">تنظیمات شرکت</span>
            </button>
          )}

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Notification Bell Button */}
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative flex items-center gap-1.5 text-xs text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 px-3 py-1.5 rounded-full transition-colors cursor-pointer font-bold shrink-0 whitespace-nowrap"
              title="مرکز اعلان‌های هوشمند"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden xl:inline">اعلان‌ها</span>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono tabular-nums font-black">
                  {fa(unreadNotificationsCount)}
                </span>
              )}
            </button>
          )}

          {/* Daily Tasks Button */}
          {onOpenDailyTasks && (
            <button
              type="button"
              onClick={onOpenDailyTasks}
              className="relative flex items-center gap-1.5 text-xs text-indigo-200 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 px-3 py-1.5 rounded-full transition-colors cursor-pointer font-bold shrink-0 whitespace-nowrap"
              title="مدیریت کارهای روزانه"
            >
              <ClipboardList className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <span className="hidden xl:inline">کارهای روزانه</span>
              {(pendingTasksCount > 0 || overdueTasksCount > 0) && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-black ${
                    overdueTasksCount > 0 ? 'bg-rose-500 text-white' : 'bg-indigo-400 text-slate-950'
                  }`}
                >
                  {fa(pendingTasksCount)}
                </span>
              )}
            </button>
          )}

          {/* Security Center Button */}
          {onOpenSecurityCenter && (
            <button
              type="button"
              onClick={onOpenSecurityCenter}
              className="relative flex items-center gap-1.5 text-xs text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 px-3 py-1.5 rounded-full transition-colors cursor-pointer font-bold shrink-0 whitespace-nowrap"
              title="مرکز امنیت و گزارش فعالیت"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">امنیت</span>
            </button>
          )}

          {/* Commodity & Docs Summary Button */}
          {onOpenSummaryModal && (
            <button
              type="button"
              onClick={onOpenSummaryModal}
              className="flex items-center gap-1.5 text-xs text-cyan-200 bg-white/10 hover:bg-white/15 border border-cyan-400/40 px-3 py-1.5 rounded-full transition-colors cursor-pointer font-bold shrink-0 whitespace-nowrap"
              title="مشاهده خلاصه و آمار اسناد تفکیکی کالاها"
            >
              <PieChart className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden xl:inline">آمار تفکیکی</span>
            </button>
          )}

          {/* Cloud Status Icon Button */}
          {onOpenCloudDb && (
            <button
              type="button"
              onClick={onOpenCloudDb}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                !isCloud
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300'
                  : isCloudSyncing
                    ? 'bg-amber-500/25 border-amber-500/60 text-amber-300'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
              }`}
              title="وضعیت اتصال به دیتابیس ابری"
            >
              {!isCloud ? (
                <CloudOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : isCloudSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" />
              ) : (
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="hidden xl:inline">{isCloud ? 'دیتابیس ابری' : 'آفلاین'}</span>
            </button>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs text-rose-200 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer font-bold shrink-0 whitespace-nowrap"
            title="خروج از سامانه"
          >
            <span>خروج</span>
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>

        {/* Mobile Title-Only Info Slot (< md: Zero unreachable buttons; all actions live in the full-screen Tools tab) */}
        <span className="md:hidden text-[11px] font-medium text-slate-400 tabular-nums whitespace-nowrap shrink-0">
          {shortDateStr}
        </span>
      </div>

      {/* Subtle Bottom Hairline */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/35 to-transparent" />
    </header>
  );
};
