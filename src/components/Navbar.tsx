import React, { useState, useEffect } from 'react';
import {
  LogOut,
  ShieldCheck,
  CloudCheck,
  CloudOff,
  RefreshCw,
  PieChart,
  Eye,
  Lock,
  ShieldAlert,
  Bell,
  ClipboardList,
  UserCheck,
} from 'lucide-react';
import { toJalali, WDN, JMONTHS, fa, pad2 } from '../utils/jalali';
import { isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from './LoginGate';

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
  currentUser,
  userRole,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

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
    <>
      <header className="sticky top-0 z-40 bg-[#050a16]/85 backdrop-blur-2xl border-b border-white/12 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85)] ios-specular transition-colors duration-200 transform-gpu will-change-transform font-vazir dir-rtl select-none">
        {/* Main Desktop & Mobile Header Row */}
        <div className="max-w-[1460px] mx-auto px-3 sm:px-7 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-300 animate-aura" />
              <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 p-[1px] shadow-2xl flex items-center justify-center shrink-0 backdrop-blur-xl">
                <div className="w-full h-full bg-[#070d1c]/90 rounded-[15px] flex items-center justify-center text-cyan-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-lalezar text-lg sm:text-2xl font-normal leading-none text-transparent bg-clip-text bg-gradient-to-l from-slate-100 via-white to-cyan-200 tracking-wide drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
                  سامانه جامع مدیریت گمرک
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 font-mono shadow-[0_0_12px_rgba(6,182,212,0.2)] backdrop-blur-xl">
                  <span>iOS 27</span>
                  <span className="opacity-60">•</span>
                  <span>v4.0</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400/90 font-medium">
                کنترل شیشه‌ای ورود، تجمیع و ترخیص نهایی کالا
              </p>
            </div>
          </div>

          {/* Live Jalali Clock (Desktop / Tablet) - iOS Dynamic Glass Capsule */}
          <div className="hidden md:flex items-center gap-2.5 text-xs text-slate-200 bg-[#0c1426]/70 backdrop-blur-2xl border border-white/15 px-4 py-1.5 rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-slate-300">{dateStr}</span>
            <span className="w-px h-3.5 bg-white/20" />
            <span className="font-lalezar text-xs sm:text-sm text-cyan-300 tracking-wider font-normal drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
              {timeStr}
            </span>
          </div>

          {/* Controls Bar - Desktop Controls */}
          <div className="hidden md:flex items-center gap-2 sm:gap-2.5">
            {/* Active Operator Selector (Admin Only) */}
            {activeRole === 'admin' && onSwitchOperator ? (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-cyan-500/15 border-cyan-400/40 text-cyan-200 backdrop-blur-xl">
                <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[11px] text-slate-300">اپراتور:</span>
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
                className={`flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-full shrink-0 border shadow-sm transition-all backdrop-blur-xl ${
                  activeRole === 'admin'
                    ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'bg-amber-500/15 border-amber-400/40 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]'
                }`}
              >
                {activeRole === 'admin' ? (
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Eye className="w-4 h-4 text-amber-400" />
                )}
                <b className="font-bold">
                  {activeRole === 'admin' ? 'مدیر (دسترسی کامل)' : 'ناظر (فقط مشاهده و پرینت)'}
                </b>
              </div>
            )}

            {/* Notification Bell Button */}
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="relative flex items-center gap-1.5 text-xs text-amber-200 bg-gradient-to-b from-amber-500/20 to-orange-600/15 hover:from-amber-500/30 hover:to-orange-600/25 border border-amber-400/40 px-3 py-1.5 rounded-full transition-all active:scale-95 shadow-[0_8px_20px_rgba(0,0,0,0.4)] cursor-pointer font-bold shrink-0 backdrop-blur-xl"
                title="مرکز اعلان‌های هوشمند"
              >
                <Bell className={`w-3.5 h-3.5 text-amber-400 ${unreadNotificationsCount > 0 ? 'animate-pulse' : ''}`} />
                <span className="hidden xl:inline">اعلان‌ها</span>
                {unreadNotificationsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono tabular-nums font-black shadow-sm">
                    {fa(unreadNotificationsCount)}
                  </span>
                )}
              </button>
            )}

            {/* Daily Tasks Button */}
            {onOpenDailyTasks && (
              <button
                onClick={onOpenDailyTasks}
                className="relative flex items-center gap-1.5 text-xs text-indigo-200 bg-gradient-to-b from-indigo-500/20 to-blue-600/15 hover:from-indigo-500/30 hover:to-blue-600/25 border border-indigo-400/40 px-3 py-1.5 rounded-full transition-all active:scale-95 shadow-[0_8px_20px_rgba(0,0,0,0.4)] cursor-pointer font-bold shrink-0 backdrop-blur-xl"
                title="مدیریت کارهای روزانه"
              >
                <ClipboardList className="w-3.5 h-3.5 text-indigo-300" />
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
                onClick={onOpenSecurityCenter}
                className="relative flex items-center gap-1.5 text-xs text-emerald-200 bg-gradient-to-b from-emerald-500/20 to-teal-600/15 hover:from-emerald-500/30 hover:to-teal-600/25 border border-emerald-400/40 px-3.5 py-1.5 rounded-full transition-all active:scale-95 shadow-[0_8px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] cursor-pointer font-bold shrink-0 backdrop-blur-xl"
                title="مرکز امنیت و حریم دفاعی سامانه"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                <span>امنیت</span>
                {isDefaultPasswordActive && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5"
                    title="کدهای پیش‌فرض فعال است - لطفاً تغییر دهید"
                  />
                )}
              </button>
            )}

            {/* Commodity & Docs Summary Button */}
            {onOpenSummaryModal && (
              <button
                onClick={onOpenSummaryModal}
                className="flex items-center gap-1.5 text-xs text-cyan-200 bg-gradient-to-b from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 border border-cyan-400/40 px-3.5 py-1.5 rounded-full transition-all active:scale-95 shadow-[0_8px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] cursor-pointer font-bold shrink-0 backdrop-blur-xl"
                title="مشاهده خلاصه و آمار اسناد تفکیکی کالاها"
              >
                <PieChart className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                <span>آمار تفکیکی</span>
              </button>
            )}

            {/* Cloud Status Icon Button */}
            {onOpenCloudDb && (
              <button
                onClick={onOpenCloudDb}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95 shadow-md backdrop-blur-xl ${
                  !isCloud
                    ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : isCloudSyncing
                    ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6),inset_0_1px_0_rgba(255,255,255,0.3)] animate-pulse'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.25)]'
                }`}
              >
                {!isCloud ? (
                  <CloudOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : isCloudSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" />
                ) : (
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span>{isCloud ? 'دیتابیس ابری' : 'آفلاین'}</span>
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-rose-200 bg-gradient-to-b from-rose-500/20 to-red-600/15 hover:from-rose-500/30 hover:to-red-600/25 border border-rose-500/40 px-4 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer font-bold shrink-0 shadow-[0_8px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl"
              title="خروج از سامانه"
            >
              <span>خروج</span>
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
            </button>
          </div>

          {/* Mobile Top Header Right Controls (< md) */}
          <div className="flex md:hidden items-center gap-1.5">
            {/* Active User Badge */}
            <div
              className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full shrink-0 border ${
                activeRole === 'admin'
                  ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                  : 'bg-amber-500/15 border-amber-400/40 text-amber-200'
              }`}
            >
              {activeRole === 'admin' ? (
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
              ) : (
                <Eye className="w-3 h-3 text-amber-400" />
              )}
              <b className="font-bold">
                {activeRole === 'admin' ? 'مدیر' : 'ناظر'}
              </b>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-[11px] text-rose-200 bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/50 px-3 py-1 rounded-full transition-all active:scale-95 cursor-pointer font-bold shrink-0 shadow-sm shadow-rose-500/20"
              title="خروج از سامانه"
            >
              <span>خروج</span>
              <LogOut className="w-3 h-3 text-rose-400" />
            </button>
          </div>
        </div>

        {/* Mobile Dedicated Controls Strip (< md) */}
        <div className="md:hidden bg-slate-950/80 px-3 py-2 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Notification Bell (Mobile) */}
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="flex items-center gap-1.5 text-xs text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 rounded-xl transition-all active:scale-95 font-semibold shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>اعلان</span>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold">
                  {fa(unreadNotificationsCount)}
                </span>
              )}
            </button>
          )}

          {/* Daily Tasks (Mobile) */}
          {onOpenDailyTasks && (
            <button
              onClick={onOpenDailyTasks}
              className="flex items-center gap-1.5 text-xs text-indigo-200 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 px-3 py-1.5 rounded-xl transition-all active:scale-95 font-semibold shrink-0"
            >
              <ClipboardList className="w-3.5 h-3.5 text-indigo-300" />
              <span>کارها</span>
              {pendingTasksCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${overdueTasksCount > 0 ? 'bg-rose-500 text-white' : 'bg-indigo-400 text-slate-950'}`}>
                  {fa(pendingTasksCount)}
                </span>
              )}
            </button>
          )}

          {/* Security Center Button */}
          {onOpenSecurityCenter && (
            <button
              onClick={onOpenSecurityCenter}
              className="flex items-center gap-1.5 text-xs text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3 py-1.5 rounded-xl transition-all active:scale-95 font-semibold shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>امنیت</span>
              {isDefaultPasswordActive && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          )}

          {/* Summary Stats Button */}
          {onOpenSummaryModal && (
            <button
              onClick={onOpenSummaryModal}
              className="flex items-center gap-1.5 text-xs text-cyan-200 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 px-3 py-1.5 rounded-xl transition-all active:scale-95 font-semibold shrink-0"
            >
              <PieChart className="w-3.5 h-3.5 text-cyan-400" />
              <span>آمار کالاها</span>
            </button>
          )}

          {/* Cloud DB Status */}
          {onOpenCloudDb && (
            <button
              onClick={onOpenCloudDb}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 shrink-0 ${
                !isCloud
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : isCloudSyncing
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
              }`}
            >
              {!isCloud ? (
                <CloudOff className="w-3.5 h-3.5 text-rose-400" />
              ) : isCloudSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              ) : (
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{isCloud ? 'دیتابیس ابری' : 'اتصال ابری'}</span>
            </button>
          )}

          {/* Date and Time Chip */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl shrink-0 mr-auto">
            <span className="font-lalezar text-cyan-400 text-xs">{timeStr}</span>
            <span className="text-slate-400">|</span>
            <span>{dateStr}</span>
          </div>
        </div>

        {/* Glowing Strip */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      </header>
    </>
  );
};
