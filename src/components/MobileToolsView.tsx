import React, { useState, useEffect } from 'react';
import {
  Bell,
  ClipboardList,
  PieChart,
  ShieldCheck,
  CloudCheck,
  CloudOff,
  RefreshCw,
  LogOut,
  UserCheck,
  ChevronLeft,
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

interface MobileToolsViewProps {
  onLogout: () => void;
  onOpenCloudDb?: () => void;
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

export const MobileToolsView: React.FC<MobileToolsViewProps> = ({
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
  lastCloudSyncTime = null,
  isCloudSyncing = false,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  const isCloud = isSupabaseConfigured();

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

  const lastSyncLabel = lastCloudSyncTime
    ? `آخرین همگام‌سازی ${fa(`${pad2(lastCloudSyncTime.getHours())}:${pad2(lastCloudSyncTime.getMinutes())}`)}`
    : isCloud
      ? 'متصل و آماده همگام‌سازی'
      : 'ذخیره‌سازی محلی (آفلاین)';

  return (
    <section
      aria-label="ابزارها و تنظیمات سامانه"
      className="md:hidden space-y-5 pb-6 font-vazir dir-rtl select-none"
    >
      {/* Screen Header + Live Clock */}
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-lalezar text-2xl text-slate-100 leading-tight">
            ابزارها و تنظیمات
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {dateStr}
          </p>
        </div>
        <span className="font-mono tabular-nums text-sm font-bold text-cyan-300 tracking-wider">
          {timeStr}
        </span>
      </div>

      {/* Section 1: Active Account & Company Workspace */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold text-slate-400">
          حساب کاربری و فضای کاری فعال
        </p>
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                {member?.isOwner ? (
                  <Crown className="w-5 h-5 text-amber-400" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">
                  {member?.fullName || 'کاربر سیستم'}
                </p>
                <p className="text-xs text-slate-400 truncate mt-0.5 font-mono" dir="ltr">
                  {member?.email || company?.name || ''}
                </p>
              </div>
            </div>
          </div>

          {allMemberships.length > 1 && onSwitchCompany && company && (
            <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 shrink-0">شرکت فعال:</span>
              <select
                value={company.id}
                onChange={(e) => onSwitchCompany(e.target.value)}
                aria-label="تغییر شرکت فعال"
                className="min-h-[42px] flex-1 px-3 py-2 rounded-xl bg-[#0c162b] border border-indigo-400/40 text-indigo-200 font-bold text-xs outline-none cursor-pointer"
              >
                {allMemberships.map((ms) => (
                  <option key={ms.companyId} value={ms.companyId} className="bg-[#0c0e14] text-slate-100">
                    {ms.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Notifications & Daily Tasks */}
      {(onOpenNotifications || onOpenDailyTasks) && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold text-slate-400">
            پیگیری و اعلان‌ها
          </p>
          <div className="glass-panel overflow-hidden divide-y divide-white/8">
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-right transition-colors active:bg-white/[0.06] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">
                      اعلان‌های هوشمند
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {unreadNotificationsCount > 0
                        ? `${fa(unreadNotificationsCount)} اعلان خوانده‌نشده در انتظار بررسی`
                        : 'همه اعلان‌ها بررسی شده‌اند'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {unreadNotificationsCount > 0 && (
                    <span className="min-w-[24px] h-6 px-2 rounded-full bg-rose-500 text-white text-xs font-mono tabular-nums font-bold flex items-center justify-center">
                      {fa(unreadNotificationsCount)}
                    </span>
                  )}
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </div>
              </button>
            )}

            {onOpenDailyTasks && (
              <button
                type="button"
                onClick={onOpenDailyTasks}
                className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-right transition-colors active:bg-white/[0.06] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">
                      کارهای روزانه
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {overdueTasksCount > 0
                        ? `${fa(overdueTasksCount)} کار معوق · ${fa(pendingTasksCount)} در جریان`
                        : pendingTasksCount > 0
                          ? `${fa(pendingTasksCount)} کار در دست اقدام`
                          : 'کار باز یا معوقی ثبت نشده است'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {pendingTasksCount > 0 && (
                    <span
                      className={`min-w-[24px] h-6 px-2 rounded-full text-xs font-mono tabular-nums font-bold flex items-center justify-center ${
                        overdueTasksCount > 0
                          ? 'bg-rose-500 text-white'
                          : 'bg-indigo-400 text-slate-950'
                      }`}
                    >
                      {fa(pendingTasksCount)}
                    </span>
                  )}
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Section 3: Company & System Management */}
      {(onOpenCompanySettings || onOpenSummaryModal || onOpenSecurityCenter || onOpenCloudDb) && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold text-slate-400">
            مدیریت شرکت و تنظیمات سامانه
          </p>
          <div className="glass-panel overflow-hidden divide-y divide-white/8">
            {onOpenCompanySettings && (
              <button
                type="button"
                onClick={onOpenCompanySettings}
                className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-right transition-colors active:bg-white/[0.06] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">
                      تنظیمات شرکت و کاربران
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      پروفایل، ورود/خروج، مدیریت کاربران، نقش‌ها و راه‌اندازی
                    </p>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            )}

            {onOpenSummaryModal && (
              <button
                type="button"
                onClick={onOpenSummaryModal}
                className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-right transition-colors active:bg-white/[0.06] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                    <PieChart className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">
                      آمار تفکیکی کالاها
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      نمای کلی کوتاژها، پالت‌ها و وضعیت ترخیص
                    </p>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            )}

            {onOpenSecurityCenter && (
              <button
                type="button"
                onClick={onOpenSecurityCenter}
                className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-right transition-colors active:bg-white/[0.06] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">
                      مرکز امنیت و گزارش‌ها
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      قفل خودکار نشست و گزارش رویدادهای امنیتی
                    </p>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            )}

            {onOpenCloudDb && (
              <button
                type="button"
                onClick={onOpenCloudDb}
                className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-right transition-colors active:bg-white/[0.06] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      !isCloud
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                        : isCloudSyncing
                          ? 'bg-amber-500/15 border-amber-400/35 text-amber-300'
                          : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                    }`}
                  >
                    {!isCloud ? (
                      <CloudOff className="w-5 h-5" />
                    ) : isCloudSyncing ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <CloudCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">
                      {isCloud ? 'پایگاه داده ابری' : 'اتصال به دیتابیس ابری'}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {isCloudSyncing ? 'در حال همگام‌سازی اطلاعات...' : lastSyncLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-bold ${
                      !isCloud
                        ? 'text-rose-300'
                        : isCloudSyncing
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                    }`}
                  >
                    {!isCloud ? 'آفلاین' : isCloudSyncing ? 'همگام‌سازی' : 'متصل'}
                  </span>
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Optional PWA Install Action (only renders when browser is not yet installed) */}
      <div className="flex justify-center">
        <PWAInstallButton compact />
      </div>

      {/* Section 4: Clear Full-Width Sign-Out Action */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[54px] px-4 py-3 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-200 font-bold text-sm flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98] active:bg-rose-500/25 cursor-pointer"
        >
          <LogOut className="w-5 h-5 text-rose-400" />
          <span>خروج از سامانه</span>
        </button>
      </div>
    </section>
  );
};
