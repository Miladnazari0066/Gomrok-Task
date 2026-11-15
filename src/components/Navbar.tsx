import React, { useState, useEffect } from 'react';
import {
  LogOut,
  ShieldCheck,
  CloudCheck,
  CloudOff,
  RefreshCw,
  PieChart,
  Eye,
  Bell,
  ClipboardList,
  UserCheck,
  Menu,
  X,
} from 'lucide-react';
import { toJalali, WDN, JMONTHS, fa, pad2 } from '../utils/jalali';
import { isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from './LoginGate';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  onLogout: () => void;
  onClearAllData?: () => void;
  onOpenCloudDb?: () => void;
  onManualSync?: () => void;
  onOpenSummaryModal?: () => void;
  onOpenSecurityCenter?: () => void;
  onOpenNotifications?: () => void;
  onOpenDailyTasks?: () => void;
  unreadNotificationsCount?: number;
  pendingTasksCount?: number;
  overdueTasksCount?: number;
  activeOperator?: 'نظری' | 'یوسفی' | 'افسر';
  onSwitchOperator?: (op: 'نظری' | 'یوسفی' | 'افسر') => void;
  isDefaultPasswordActive?: boolean;
  lastCloudSyncTime?: Date | null;
  isCloudSyncing?: boolean;
  currentUser?: string;
  userRole?: UserRole;
}

export const Navbar: React.FC<NavbarProps> = ({
  onLogout,
  onOpenCloudDb,
  onOpenSummaryModal,
  onOpenSecurityCenter,
  onOpenNotifications,
  onOpenDailyTasks,
  unreadNotificationsCount = 0,
  pendingTasksCount = 0,
  overdueTasksCount = 0,
  activeOperator = 'نظری',
  onSwitchOperator,
  isDefaultPasswordActive = false,
  isCloudSyncing = false,
  userRole,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isCloud = isSupabaseConfigured();
  const activeRole: UserRole = userRole || (sessionStorage.getItem('gm_role') as UserRole) || 'admin';

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const j = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      setDateStr(`${WDN[now.getDay()]} ${fa(j.jd)} ${JMONTHS[j.jm - 1]} ${fa(j.jy)}`);
      setTimeStr(fa(`${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#050a16]/95 border-b border-white/12 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] font-vazir dir-rtl select-none">
      {/* Main Desktop & Mobile Header Row */}
      <div className="max-w-[1460px] mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden border border-cyan-400/45 bg-[#071A21] shadow-md shrink-0 flex items-center justify-center">
            <img
              src="pwa-192x192.png"
              alt="لوگوی مدیریت کارهای گمرک"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-lalezar text-base sm:text-xl lg:text-2xl font-normal leading-tight text-slate-100 tracking-wide truncate">
              مدیریت کارهای گمرک
            </h1>
            <p className="hidden sm:block text-[11px] text-slate-400 font-medium truncate">
              Customs Task Management · کنترل ورود، تجمیع و خروج
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
          {/* Active Operator Selector (Admin Only) */}
          {activeRole === 'admin' && onSwitchOperator ? (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border bg-cyan-500/15 border-cyan-400/40 text-cyan-200">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={activeOperator}
                onChange={(e) => onSwitchOperator(e.target.value as 'نظری' | 'یوسفی' | 'افسر')}
                className="bg-transparent text-cyan-200 font-bold outline-none cursor-pointer text-xs"
                title="انتخاب کاربر فعال جهت اعمال سطوح دسترسی تفکیک‌شده"
              >
                <option value="نظری" className="bg-[#0c0e14] text-slate-100">نظری (مدیر ارشد)</option>
                <option value="یوسفی" className="bg-[#0c0e14] text-slate-100">یوسفی</option>
                <option value="افسر" className="bg-[#0c0e14] text-slate-100">افسر</option>
              </select>
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full shrink-0 border ${
                activeRole === 'admin'
                  ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                  : 'bg-amber-500/15 border-amber-400/40 text-amber-200'
              }`}
            >
              {activeRole === 'admin' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-amber-400" />
              )}
              <b className="font-bold whitespace-nowrap">
                {activeRole === 'admin' ? 'مدیر' : 'ناظر'}
              </b>
            </div>
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
              title="مرکز امنیت و حریم دفاعی سامانه"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">امنیت</span>
              {isDefaultPasswordActive && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5"
                  title="کدهای پیش‌فرض فعال است - لطفاً تغییر دهید"
                />
              )}
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

        {/* Mobile Compact Top Header Controls (< md, strictly single-row <= 56px height) */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 cursor-pointer"
              aria-label="اعلان‌ها"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono tabular-nums font-black flex items-center justify-center">
                  {fa(unreadNotificationsCount)}
                </span>
              )}
            </button>
          )}

          {onOpenDailyTasks && (
            <button
              type="button"
              onClick={onOpenDailyTasks}
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/35 text-indigo-300 cursor-pointer"
              aria-label="کارهای روزانه"
            >
              <ClipboardList className="w-4 h-4" />
              {pendingTasksCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono tabular-nums font-black flex items-center justify-center ${
                    overdueTasksCount > 0 ? 'bg-rose-500 text-white' : 'bg-indigo-400 text-slate-950'
                  }`}
                >
                  {fa(pendingTasksCount)}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/8 border border-white/15 text-slate-200 cursor-pointer"
            aria-label={mobileMenuOpen ? 'بستن منو' : 'باز کردن منوی ابزارها'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Mobile Drawer Strip (Only expands when Menu toggled so idle sticky height stays <= 15%) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#070d1b] px-3 py-3 border-t border-white/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {activeRole === 'admin' && onSwitchOperator ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-cyan-500/15 border-cyan-400/40 text-cyan-200 min-h-[40px]">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <select
                    value={activeOperator}
                    onChange={(e) => onSwitchOperator(e.target.value as 'نظری' | 'یوسفی' | 'افسر')}
                    className="bg-transparent text-cyan-200 font-bold outline-none text-xs"
                  >
                    <option value="نظری" className="bg-[#0c0e14]">نظری (مدیر ارشد)</option>
                    <option value="یوسفی" className="bg-[#0c0e14]">یوسفی</option>
                    <option value="افسر" className="bg-[#0c0e14]">افسر</option>
                  </select>
                </div>
              ) : (
                <span className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 font-bold">
                  {activeRole === 'admin' ? 'مدیر' : 'ناظر'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-mono tabular-nums">
              <span className="text-cyan-300 font-bold">{timeStr}</span>
              <span className="text-slate-500">·</span>
              <span>{dateStr}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <PWAInstallButton compact />

            {onOpenSecurityCenter && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSecurityCenter();
                }}
                className="min-h-[40px] flex items-center gap-1.5 text-xs text-emerald-200 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 rounded-xl font-semibold cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>امنیت</span>
              </button>
            )}

            {onOpenSummaryModal && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSummaryModal();
                }}
                className="min-h-[40px] flex items-center gap-1.5 text-xs text-cyan-200 bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 rounded-xl font-semibold cursor-pointer"
              >
                <PieChart className="w-3.5 h-3.5 text-cyan-400" />
                <span>آمار کالاها</span>
              </button>
            )}

            {onOpenCloudDb && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenCloudDb();
                }}
                className={`min-h-[40px] flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border cursor-pointer ${
                  !isCloud
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                }`}
              >
                {!isCloud ? <CloudOff className="w-3.5 h-3.5 text-rose-400" /> : <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isCloud ? 'دیتابیس ابری' : 'اتصال ابری'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="min-h-[40px] flex items-center gap-1.5 text-xs text-rose-200 bg-rose-500/25 border border-rose-500/50 px-3 py-1.5 rounded-xl font-bold mr-auto cursor-pointer"
            >
              <span>خروج</span>
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
            </button>
          </div>
        </div>
      )}

      {/* Subtle Bottom Hairline */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/45 to-transparent" />
    </header>
  );
};
