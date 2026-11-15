import React, { useState } from 'react';
import {
  Truck,
  Calendar,
  Building2,
  Package,
  Tag,
  Receipt,
  FileCheck,
  Edit2,
  Trash2,
  Check,
  CheckCircle2,
  Layers,
  HelpCircle,
  MoreVertical,
  FolderKanban,
  ClipboardList,
  Lock,
  Unlock,
} from 'lucide-react';
import { EntryDoc, Batch, PhysicalExitTransaction } from '../types';
import { fa, fmtJ, esc } from '../utils/jalali';
import {
  CLEARANCE_STATUS_META,
  computePalletBalances,
  normalizeEntryClearance,
} from '../utils/clearance9010';

interface EntryCardProps {
  doc: EntryDoc;
  batch?: Batch;
  physicalExits?: PhysicalExitTransaction[];
  isHighlighted?: boolean;
  onEdit: (doc: EntryDoc) => void;
  onDelete: (id: string) => void;
  onUpdateUnloaded: (id: string, delta: number) => void;
  onToggleInvoice: (id: string, paid: boolean) => void;
  onUpdateReceipt: (id: string, number: string, count: string) => void;
  onToggleTask: (id: string, taskKey: 'bl' | 'arr' | 'tali') => void;
  onMarkComplete?: (id: string) => void;
  onOpenClearance9010?: (doc: EntryDoc) => void;
  onCreateFollowUpTask?: (doc: EntryDoc) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const EntryCard: React.FC<EntryCardProps> = ({
  doc,
  batch,
  physicalExits = [],
  isHighlighted = false,
  onEdit,
  onDelete,
  onUpdateUnloaded,
  onToggleInvoice,
  onUpdateReceipt,
  onToggleTask,
  onMarkComplete,
  onOpenClearance9010,
  onCreateFollowUpTask,
  canEdit = true,
  canDelete = true,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const clearance = normalizeEntryClearance(doc, physicalExits);
  const balances = computePalletBalances({ ...doc, clearance }, physicalExits);
  const clearanceMeta = CLEARANCE_STATUS_META[clearance.status];

  // Determine current stage & color theme
  let stage = 1;
  if (doc.unloaded < doc.trailers) stage = 1;
  else if (!doc.invoicePaid || !doc.receipt.number) stage = 2;
  else if (!(doc.tasks.bl && doc.tasks.arr && doc.tasks.tali)) stage = 3;
  else if (!batch) stage = 4;
  else stage = batch.finalized ? 6 : 5;

  const STAGE_CONFIG: Record<number, { label: string; badgeCls: string; color: string }> = {
    1: { label: 'در حال تخلیه', badgeCls: 'bg-amber-500/10 border-amber-500/40 text-amber-400', color: '#f59e0b' },
    2: { label: 'در حال تکمیل', badgeCls: 'bg-blue-500/10 border-blue-500/40 text-blue-400', color: '#3b82f6' },
    3: { label: 'در حال تکمیل', badgeCls: 'bg-blue-500/10 border-blue-500/40 text-blue-400', color: '#3b82f6' },
    4: { label: 'کامل · آماده تجمیع', badgeCls: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400', color: '#10b981' },
    5: { label: 'در تجمیع', badgeCls: 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400', color: '#06b6d4' },
    6: { label: 'آماده خروج', badgeCls: 'bg-purple-500/15 border-purple-500/50 text-purple-300', color: '#a855f7' },
  };

  const currentStageCfg = STAGE_CONFIG[stage] || STAGE_CONFIG[1];

  // Calculate percentage progress
  let progress = (doc.trailers ? doc.unloaded / doc.trailers : 0) * 30;
  if (doc.invoicePaid) progress += 10;
  if (doc.receipt.number) progress += 10;
  progress += ((doc.tasks.bl ? 1 : 0) + (doc.tasks.arr ? 1 : 0) + (doc.tasks.tali ? 1 : 0)) / 3 * 30;
  if (batch) {
    progress += 10;
    if (batch.finalized) progress += 10;
  }
  progress = Math.min(100, Math.round(progress));

  return (
    <div
      id={`entry-card-${doc.id}`}
      className={`glass-panel ios-specular p-5 sm:p-6 relative transition-all duration-300 shadow-[0_24px_50px_-15px_rgba(0,0,0,0.8)] hover:shadow-[0_32px_65px_-15px_rgba(0,0,0,0.9)] hover:border-white/30 rounded-3xl group overflow-hidden border ${
        isHighlighted
          ? 'border-amber-400 ring-2 ring-amber-400/50'
          : 'border-white/14'
      }`}
      style={{ borderRightWidth: '4px', borderRightColor: currentStageCfg.color }}
    >
      {/* Ambient background glow matching current stage */}
      <div
        className="absolute top-0 right-0 w-56 h-56 rounded-full blur-[100px] pointer-events-none opacity-15 transition-opacity group-hover:opacity-25"
        style={{ backgroundColor: currentStageCfg.color }}
      />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3.5 relative z-10">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-lalezar text-2xl text-slate-100 tracking-wide flex items-center gap-1.5 drop-shadow-sm">
            <span className="text-xs text-slate-400 font-sans font-medium">کوتاژ:</span>
            {fa(doc.cottage)}
          </span>

          {/* Highlighted File/Case Number Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/25 via-amber-400/20 to-orange-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold shadow-[0_0_14px_rgba(251,191,36,0.25)] backdrop-blur-md">
            <FolderKanban className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>پرونده:</span>
            <span className="font-mono text-amber-100 tracking-wider text-sm font-black">{fa(doc.file)}</span>
          </div>

          <span className="bg-slate-900/80 border border-cyan-500/30 px-3 py-1 rounded-xl text-xs ltr font-mono text-cyan-300 font-bold tracking-widest backdrop-blur-md shadow-xs">
            {esc(doc.bl)}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs ${currentStageCfg.badgeCls}`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse shadow-[0_0_8px_currentColor]" />
            {currentStageCfg.label}
          </span>
          {batch && (
            <span className="bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-bold px-3 py-0.5 rounded-full backdrop-blur-md shadow-xs">
              تجمیع {fa(batch.id)}
            </span>
          )}
        </div>

        {/* Action Buttons - Always Visible on All Devices */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onOpenClearance9010 && (
            <button
              onClick={() => onOpenClearance9010(doc)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-bold transition-all backdrop-blur-md active:scale-95 shadow-sm shadow-amber-500/10 cursor-pointer"
              title="مدیریت ترخیص ۹۰/۱۰، ساتا و خروج فیزیکی"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>۹۰/۱۰ و خروج</span>
            </button>
          )}
          {onCreateFollowUpTask && (
            <button
              onClick={() => onCreateFollowUpTask(doc)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-purple-400/40 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 text-xs font-bold transition-all backdrop-blur-md active:scale-95 cursor-pointer"
              title="ثبت کار روزانه برای این کوتاژ"
            >
              <ClipboardList className="w-3.5 h-3.5 text-purple-300" />
            </button>
          )}
          {stage === 1 && canEdit && onMarkComplete && (
            <button
              onClick={() => onMarkComplete(doc.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-bold transition-all backdrop-blur-md active:scale-95 shadow-sm shadow-emerald-500/10 cursor-pointer"
              title="تغییر مستقیم وضعیت سند به کامل"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>تغییر وضعیت به کامل</span>
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(doc)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-xs font-bold transition-all backdrop-blur-md active:scale-95 shadow-sm shadow-cyan-500/10 cursor-pointer"
              title="ویرایش این سند"
            >
              <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>ویرایش</span>
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(doc.id)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs font-bold transition-all backdrop-blur-md active:scale-95 shadow-sm shadow-rose-500/10 cursor-pointer"
              title="حذف این سند"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>حذف</span>
            </button>
          )}
        </div>
      </div>

      {/* Meta Badges */}
      <div className="flex items-center gap-3.5 flex-wrap text-xs text-slate-300 mb-3 relative z-10">
        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">تخلیه:</span> {fmtJ(doc.unloadDate)}
        </span>
        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
          <Building2 className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400">صاحب کالا:</span> <b className="text-slate-100">{esc(doc.importer)}</b>
        </span>
        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
          <Truck className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">شرکت حمل:</span> {esc(doc.carrier)}
        </span>
        <span className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold px-2.5 py-1 rounded-lg">
          <Package className="w-3.5 h-3.5 text-cyan-400" />
          {esc(doc.goods) || '—'}
        </span>
        {doc.mdfThickness && (
          <span className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-400/30 text-indigo-200 font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg">
            ضخامت: {esc(doc.mdfThickness)}
          </span>
        )}
        {doc.brand && (
          <span className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold px-2.5 py-1 rounded-lg">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            {esc(doc.brand)}
          </span>
        )}
        {doc.pallets > 0 && (
          <span className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 font-semibold px-2.5 py-1 rounded-lg">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            {fa(doc.pallets)} پالت
          </span>
        )}
      </div>

      {/* 90/10 Clearance & Physical Exit Summary Strip */}
      {balances.totalPallets > 0 && (
        <div
          onClick={() => onOpenClearance9010 && onOpenClearance9010(doc)}
          className={`mb-3.5 p-2.5 sm:p-3 rounded-2xl bg-slate-950/45 border border-white/10 flex items-center justify-between gap-2.5 flex-wrap text-[11px] relative z-10 ${
            onOpenClearance9010 ? 'cursor-pointer hover:border-cyan-400/40 transition-colors' : ''
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-lg border font-bold ${clearanceMeta.badgeCls}`}>
              {clearanceMeta.shortLabel}
            </span>
            <span className="text-cyan-300 font-mono tabular-nums">
              ۹۰٪: {fa(balances.firstStagePallets)} (خروج {fa(balances.firstStageExited)})
            </span>
            <span className="text-slate-500">·</span>
            <span className={`flex items-center gap-1 font-mono tabular-nums ${balances.sataConfirmed ? 'text-indigo-300' : 'text-amber-300'}`}>
              {balances.remainingStageLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 text-emerald-400" />}
              ۱۰٪: {fa(balances.remainingPallets)} ({balances.sataConfirmed ? `خروج ${fa(balances.remainingStageExited)}` : balances.sataReceived ? 'ساتا در انتظار تایید' : 'قفل'})
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span className="text-emerald-300 font-bold">خارج‌شده: {fa(balances.totalExited)}</span>
            <span className="text-slate-500">/</span>
            <span className="text-purple-300 font-bold">باقیمانده: {fa(balances.totalRemaining)}</span>
          </div>
        </div>
      )}

      {/* Progress Pipe */}
      <div className="flex items-center py-3.5 my-2.5 border-t border-b border-white/10 relative z-10">
        {[
          { label: 'تخلیه', stageIdx: 1 },
          { label: 'صورت‌حساب', stageIdx: 2 },
          { label: 'مدارک', stageIdx: 3 },
          { label: 'تجمیع', stageIdx: 4 },
          { label: 'خروج', stageIdx: 5 },
        ].map((node, i) => {
          const isDone = stage > node.stageIdx || stage === 6;
          const isCur = stage === node.stageIdx && stage < 6;

          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div
                  className={`flex-1 h-0.5 transition-all duration-500 ${
                    isDone ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/10'
                  }`}
                />
              )}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300 ${
                    isDone
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : isCur
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300 animate-pulse shadow-[0_0_14px_rgba(251,191,36,0.6)]'
                      : 'border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4 text-emerald-300 drop-shadow" /> : fa(i + 1)}
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] font-medium transition-colors ${
                    isDone ? 'text-slate-200' : isCur ? 'text-amber-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  {node.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4 relative z-10">
        {/* Stepper: Unloading */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl border border-cyan-500/15">
          <h5 className="text-xs text-slate-200 font-bold mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-cyan-400" />
              تخلیه تریلی
            </span>
            {doc.unloaded >= doc.trailers && (
              <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                تکمیل
              </span>
            )}
          </h5>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onUpdateUnloaded(doc.id, -1)}
              disabled={!canEdit || doc.unloaded <= 0}
              className="w-9 h-9 rounded-xl border border-white/10 bg-slate-800/80 text-lg font-black text-slate-300 hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/15 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-xs"
            >
              −
            </button>
            <span className="font-lalezar text-2xl min-w-[36px] text-center text-slate-100 drop-shadow">
              {fa(doc.unloaded)}
            </span>
            <button
              onClick={() => onUpdateUnloaded(doc.id, 1)}
              disabled={!canEdit || doc.unloaded >= doc.trailers}
              className="w-9 h-9 rounded-xl border border-white/10 bg-slate-800/80 text-lg font-black text-slate-300 hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/15 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-xs"
            >
              +
            </button>
            <span className="text-xs text-slate-400 mr-1">از <b className="text-slate-200 font-mono">{fa(doc.trailers)}</b> تریلی</span>
          </div>
          {doc.unloaded >= doc.trailers && (
            <div className="text-[11px] text-emerald-300 mt-2.5 flex items-center gap-1.5 font-bold">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> تمام تریلی‌ها تخلیه شدند
            </div>
          )}
        </div>

        {/* Invoice & Receipt */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl border border-emerald-500/15">
          <h5 className="text-xs text-slate-200 font-bold mb-2 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
            صورت‌حساب و قبض انبار
          </h5>

          <label className={`flex items-center gap-2 text-xs select-none mb-2.5 text-slate-200 font-medium ${canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={doc.invoicePaid}
              onChange={(e) => onToggleInvoice(doc.id, e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
            />
            <span className={doc.invoicePaid ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>
              صورت‌حساب منطقه ویژه پرداخت شد
            </span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              disabled={!canEdit || !doc.invoicePaid}
              value={doc.receipt.number}
              onChange={(e) => onUpdateReceipt(doc.id, e.target.value, doc.receipt.count)}
              placeholder="شماره قبض انبار"
              className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs ltr text-left outline-none disabled:opacity-35 font-mono"
            />
            <input
              type="text"
              disabled={!canEdit || !doc.invoicePaid}
              value={doc.receipt.count}
              onChange={(e) => onUpdateReceipt(doc.id, doc.receipt.number, e.target.value)}
              placeholder="تعداد اقلام"
              className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs outline-none disabled:opacity-35 font-mono"
            />
          </div>
        </div>

        {/* Milestones / Stamps */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl border border-amber-500/15">
          <h5 className="text-xs text-slate-200 font-bold mb-2.5 flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-amber-400" />
            تکمیل و تطبیق مدارک
          </h5>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onToggleTask(doc.id, 'bl')}
              disabled={!canEdit}
              className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                doc.tasks.bl
                  ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'border-dashed border-white/15 bg-white/5 text-slate-400 hover:border-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10'
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${doc.tasks.bl ? 'text-emerald-300' : 'text-slate-500'}`} />
              <span>بارنامه</span>
            </button>

            <button
              onClick={() => onToggleTask(doc.id, 'arr')}
              disabled={!canEdit}
              className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                doc.tasks.arr
                  ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'border-dashed border-white/15 bg-white/5 text-slate-400 hover:border-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10'
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${doc.tasks.arr ? 'text-emerald-300' : 'text-slate-500'}`} />
              <span>اعلام وصول</span>
            </button>

            <button
              onClick={() => onToggleTask(doc.id, 'tali')}
              disabled={!canEdit}
              className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                doc.tasks.tali
                  ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'border-dashed border-white/15 bg-white/5 text-slate-400 hover:border-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10'
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${doc.tasks.tali ? 'text-emerald-300' : 'text-slate-500'}`} />
              <span>تالی</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar Footer */}
      <div className="mt-4.5 pt-3 border-t border-white/10 flex items-center gap-3 relative z-10">
        <div className="flex-1 h-2.5 bg-slate-900/80 rounded-full overflow-hidden border border-white/10 p-0.5 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              progress === 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
                : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-amber-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`font-lalezar text-base min-w-[44px] text-left drop-shadow ${
          progress === 100 ? 'text-emerald-300' : 'text-cyan-200'
        }`}>
          {fa(progress)}٪
        </span>
      </div>
    </div>
  );
};
