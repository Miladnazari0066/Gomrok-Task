import React, { useState } from 'react';
import {
  X,
  Bell,
  Check,
  CheckCheck,
  Archive,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
} from 'lucide-react';
import { AppNotification, NotificationPriority } from '../types';
import { fa, fmtJ } from '../utils/jalali';

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  canManage: boolean;
  onMarkRead: (dedupeKey: string) => void;
  onMarkAllRead: () => void;
  onToggleArchive: (dedupeKey: string, archived: boolean) => void;
  onNavigateToRecord: (notif: AppNotification) => void;
}

const PRIORITY_LABELS: Record<NotificationPriority, { label: string; cls: string }> = {
  critical: { label: 'بحرانی', cls: 'bg-rose-500/20 border-rose-500/40 text-rose-300' },
  high: { label: 'بالا', cls: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  medium: { label: 'متوسط', cls: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
  low: { label: 'کم', cls: 'bg-slate-500/20 border-slate-500/40 text-slate-300' },
};

export const NotificationCenterDrawer: React.FC<NotificationCenterDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  canManage,
  onMarkRead,
  onMarkAllRead,
  onToggleArchive,
  onNavigateToRecord,
}) => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'unread' | 'archived'>('active');
  const [priorityFilter, setPriorityFilter] = useState<'all' | NotificationPriority>('all');

  if (!isOpen) return null;

  const activeNotifs = notifications.filter((n) => !n.archived);
  const unreadCount = activeNotifs.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (statusFilter === 'active' && n.archived) return false;
    if (statusFilter === 'unread' && (n.archived || n.read)) return false;
    if (statusFilter === 'archived' && !n.archived) return false;
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-md animate-in fade-in font-vazir dir-rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg h-[100dvh] pt-safe-top pb-safe-bar ios-glass-modal border-r border-white/20 flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.9)] text-slate-100"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-500/25 to-cyan-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-lalezar text-lg sm:text-xl text-slate-100 flex items-center gap-2 flex-wrap">
                <span>مرکز اعلان‌های هوشمند</span>
                {unreadCount > 0 && (
                  <span className="text-xs font-mono tabular-nums px-2 py-0.5 rounded-full bg-rose-500/25 border border-rose-400/50 text-rose-200">
                    {fa(unreadCount)} نخوانده
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                پایش لحظه‌ای ساتا، خروج فیزیکی، انقضای آزمایشگاه و سررسید کارها
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-white/15 shrink-0 cursor-pointer"
            aria-label="بستن اعلان‌ها"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Mark All Read */}
        <div className="px-5 py-3 border-b border-white/10 bg-slate-950/40 space-y-2.5 shrink-0 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'active', label: `فعال (${fa(activeNotifs.length)})` },
                { id: 'unread', label: `نخوانده (${fa(unreadCount)})` },
                { id: 'archived', label: `بایگانی (${fa(notifications.length - activeNotifs.length)})` },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id as any)}
                  className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-bold ${
                    statusFilter === s.id
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {canManage && unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 cursor-pointer font-bold"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>خواندن همه</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 ml-1">اولویت:</span>
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] border cursor-pointer transition-all ${
                  priorityFilter === p
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-bold'
                    : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === 'all' ? 'همه' : PRIORITY_LABELS[p].label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
                <Bell className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-300">اعلانی در این فیلتر وجود ندارد</p>
              <p className="text-xs">با تغییر وضعیت اسناد، ساتا یا تاریخ‌های آزمایشگاه اعلان‌ها به‌طور خودکار نمایش داده می‌شوند.</p>
            </div>
          ) : (
            filtered.map((n) => {
              const pMeta = PRIORITY_LABELS[n.priority];
              return (
                <div
                  key={n.dedupeKey}
                  className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                    n.read
                      ? 'bg-white/[0.03] border-white/10 opacity-80'
                      : 'bg-slate-900/75 border-cyan-400/35 shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {n.priority === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                        ) : n.priority === 'high' ? (
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Info className="w-4 h-4 text-cyan-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-100 leading-snug">{n.title}</h4>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{n.description}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${pMeta.cls}`}>
                      {pMeta.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px]">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtJ(n.jalaliDate)}
                      </span>
                      {n.cottage && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-cyan-300">کوتاژ {fa(n.cottage)}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {n.relatedRecordId && (
                        <button
                          type="button"
                          onClick={() => onNavigateToRecord(n)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-bold cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{n.actionLabel || 'مشاهده'}</span>
                        </button>
                      )}

                      {canManage && !n.read && (
                        <button
                          type="button"
                          onClick={() => onMarkRead(n.dedupeKey)}
                          className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 cursor-pointer"
                          title="علامت به عنوان خوانده‌شده"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onToggleArchive(n.dedupeKey, !n.archived)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                          title={n.archived ? 'بازگردانی از بایگانی' : 'بایگانی کردن'}
                        >
                          {n.archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
