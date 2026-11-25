import React, { useState, useEffect } from 'react';
import {
  Printer,
  Edit2,
  Trash2,
  Check,
  Calendar,
  Building2,
  Truck,
  Package,
  Tag,
  Layers,
  FlaskConical,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Route,
  Search,
  Leaf,
  LogOut,
  CreditCard,
  MoreVertical,
  FolderKanban,
  Percent,
  ShieldCheck,
  Lock,
  Unlock,
  ChevronDown,
} from 'lucide-react';
import { ExitDoc, Batch, LabRecord, EntryDoc, PhysicalExitTransaction } from '../types';
import { fa, fmtJ, daysUntil, remTxt, esc, addMonthsJ } from '../utils/jalali';
import { printExitReceipts } from '../utils/print';
import { CLEARANCE_STATUS_META, computePalletBalances, deriveClearanceStatus } from '../utils/clearance9010';

interface ExitCardProps {
  doc: ExitDoc;
  batch?: Batch;
  allDocs: EntryDoc[];
  labRecords: LabRecord[];
  physicalExits?: PhysicalExitTransaction[];
  isHighlighted?: boolean;
  onEdit: (doc: ExitDoc) => void;
  onDelete: (id: string) => void;
  onUpdateExit: (doc: ExitDoc) => void;
  onAddLabRecord: (rec: LabRecord) => void;
  onOpenClearance9010?: (entryDoc: EntryDoc) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canUpdateStages?: boolean;
}

export const ExitCard: React.FC<ExitCardProps> = ({
  doc,
  batch,
  allDocs,
  labRecords,
  physicalExits = [],
  isHighlighted = false,
  onEdit,
  onDelete,
  onUpdateExit,
  onAddLabRecord,
  onOpenClearance9010,
  canEdit = true,
  canDelete = true,
  canUpdateStages = true,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    if (isHighlighted) {
      setMobileExpanded(true);
    }
  }, [isHighlighted]);

  const linkedEntryDoc = React.useMemo(() => {
    if (doc.entryDocId) {
      const byId = allDocs.find((d) => d.id === doc.entryDocId);
      if (byId) return byId;
    }
    if (batch && batch.docIds.length > 0) {
      const byBatch = allDocs.find((d) => d.id === batch.docIds[0]);
      if (byBatch) return byBatch;
    }
    return allDocs.find((d) => d.cottage === doc.cottage);
  }, [allDocs, batch, doc.entryDocId, doc.cottage]);

  const linkedBalance = React.useMemo(() => {
    if (!linkedEntryDoc) return null;
    return computePalletBalances(linkedEntryDoc, physicalExits);
  }, [linkedEntryDoc, physicalExits]);

  const linkedStatus = React.useMemo(() => {
    if (!linkedEntryDoc) return null;
    return deriveClearanceStatus(linkedEntryDoc, physicalExits);
  }, [linkedEntryDoc, physicalExits]);

  // Calculate current stage (0 to 7)
  const isLabDone = !!(doc.lab.reusedFrom || doc.lab.tested);

  let stage = 0;
  if (!doc.route) stage = 0;
  else if (doc.route === 'red' && !doc.evaluator.done) stage = 1;
  else if (!doc.jihad.done) stage = 2;
  else if (doc.lab.needed && !isLabDone) stage = 3;
  else if (!doc.expert.done) stage = 4;
  else if (!doc.gate.done) stage = 5;
  else if (!doc.invoice.paid) stage = 6;
  else stage = 7; // Customs Exit Procedures Done

  const isPartialDoc = Boolean(doc.partialExit?.isPartial);
  const isPhysicallyAndFinanciallyClosed = isPartialDoc
    ? (linkedEntryDoc ? Boolean(linkedEntryDoc.clearance?.closure?.closed) : true)
    : true;

  const STAGES_CONFIG: Record<number, { label: string; badgeCls: string; color: string }> = {
    0: { label: 'در انتظار تعیین مسیر', badgeCls: 'bg-amber-500/10 border-amber-500/40 text-amber-400', color: '#f59e0b' },
    1: { label: 'در انتظار ارزیاب گمرک', badgeCls: 'bg-rose-500/10 border-rose-500/40 text-rose-400', color: '#f43f5e' },
    2: { label: 'در انتظار جهاد کشاورزی', badgeCls: 'bg-blue-500/10 border-blue-500/40 text-blue-400', color: '#3b82f6' },
    3: { label: 'در انتظار آزمایشگاه', badgeCls: 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400', color: '#06b6d4' },
    4: { label: 'در انتظار کارشناس مجازی', badgeCls: 'bg-blue-500/10 border-blue-500/40 text-blue-400', color: '#3b82f6' },
    5: { label: 'آماده خروج از درب', badgeCls: 'bg-teal-500/10 border-teal-500/40 text-teal-300', color: '#14b8a6' },
    6: { label: 'در انتظار پرداخت صورت‌حساب', badgeCls: 'bg-amber-500/15 border-amber-500/50 text-amber-300', color: '#f59e0b' },
    7: isPhysicallyAndFinanciallyClosed
      ? { label: 'پرونده مختومه شد ✓', badgeCls: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300', color: '#10b981' }
      : { label: 'تشریفات خروج تکمیل — در انتظار اختتام ۹۰/۱۰', badgeCls: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200', color: '#06b6d4' },
  };

  const currentCfg = STAGES_CONFIG[stage] || STAGES_CONFIG[0];

  // Find valid reusable lab record for the same goods
  const validLabRecord = React.useMemo(() => {
    if (!doc.goods) return null;
    for (let i = labRecords.length - 1; i >= 0; i--) {
      const r = labRecords[i];
      if (r.goods === doc.goods) {
        const days = daysUntil(addMonthsJ(r.sampleDate, r.validity));
        if (days > 0) {
          return { rec: r, days };
        }
      }
    }
    return null;
  }, [doc.goods, labRecords]);

  // Handle updates
  const updateRoute = (r: 'red' | 'yellow') => {
    onUpdateExit({
      ...doc,
      route: r,
    });
  };

  const handlePrint = () => {
    const memberDocs = batch
      ? (batch.docIds.map((id) => allDocs.find((d) => d.id === id)).filter(Boolean) as EntryDoc[])
      : [];
    printExitReceipts(doc, batch, memberDocs);
  };

  const handleLabTestedToggle = (tested: boolean) => {
    let recId = doc.lab.recordId;
    if (tested && !recId) {
      const newRec: LabRecord = {
        id: `lab-${Date.now()}`,
        goods: doc.goods,
        brand: doc.brand || '',
        sampleDate: doc.lab.sampleDate || doc.unloadDate,
        validity: doc.lab.validity || 6,
        comment: doc.lab.comment || 'نتیجه آزمایشگاه: مطابق استانداردهای لازم',
        exitId: doc.id,
        createdAt: Date.now(),
      };
      onAddLabRecord(newRec);
      recId = newRec.id;
    }

    onUpdateExit({
      ...doc,
      lab: {
        ...doc.lab,
        tested,
        recordId: recId,
      },
    });
  };

  const reuseLabRecord = (recId: string) => {
    onUpdateExit({
      ...doc,
      lab: {
        ...doc.lab,
        reusedFrom: recId,
      },
    });
  };

  return (
    <div
      id={`exit-card-${doc.id}`}
      className={`glass-panel ios-specular p-4 sm:p-6 relative transition-colors duration-200 rounded-3xl overflow-hidden border border-white/14 ${
        stage === 7 && isPhysicallyAndFinanciallyClosed ? 'border-emerald-500/40' : ''
      } ${isHighlighted ? 'ring-2 ring-cyan-400 border-cyan-400/70' : ''}`}
      style={{ borderRightWidth: '4px', borderRightColor: currentCfg.color }}
    >
      {/* Top Header */}
      <div className="flex items-start sm:items-center justify-between gap-2.5 sm:gap-3 flex-wrap mb-2.5 md:mb-3.5 relative z-10">
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          <span className="font-lalezar text-lg sm:text-2xl text-slate-100 tracking-wide flex items-center gap-1.5">
            <span className="text-[11px] sm:text-xs text-slate-400 font-sans font-medium">کوتاژ:</span>
            {fa(doc.cottage)}
          </span>

          {/* Highlighted File/Case Number Badge */}
          <div className="flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-400/45 text-amber-200 text-[11px] sm:text-xs font-bold">
            <FolderKanban className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">پرونده:</span>
            <span className="font-mono text-amber-100 tracking-wider text-xs sm:text-sm font-black">{fa(doc.file)}</span>
          </div>

          <span className="hidden md:inline-block bg-slate-900/90 border border-cyan-500/30 px-2.5 sm:px-3 py-1 rounded-xl text-xs ltr font-mono text-cyan-300 font-bold tracking-widest">
            {doc.bl}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold border ${currentCfg.badgeCls}`}>
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current" />
            {currentCfg.label}
          </span>
          {batch && (
            <span className="hidden md:inline-block bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-bold px-3 py-0.5 rounded-full">
              تجمیع {doc.batchId}
            </span>
          )}
          {doc.partialExit?.isPartial ? (
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-emerald-500/15 border border-amber-400/50 text-amber-200 text-xs font-bold">
              <Percent className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>خروج {fa(doc.partialExit.exitPercent)}٪</span>
              <span className="text-emerald-300 font-mono">({fa(doc.partialExit.exitPallets)} پالت)</span>
              <span className="text-slate-500 font-normal">|</span>
              <span className="text-amber-300/90 font-medium">مانده: {fa(doc.partialExit.remainingPercent)}٪ ({fa(doc.partialExit.remainingPallets)} پالت)</span>
            </span>
          ) : (
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
              خروج کامل ۱۰۰٪
            </span>
          )}
        </div>

        {/* Action Buttons (always visible on md+, revealed when expanded on mobile) */}
        <div className={`${mobileExpanded ? 'flex' : 'hidden'} md:flex items-center gap-2 flex-wrap shrink-0 w-full md:w-auto pt-1 md:pt-0`}>
          {linkedEntryDoc && onOpenClearance9010 && (
            <button
              type="button"
              onClick={() => onOpenClearance9010(linkedEntryDoc)}
              className="hidden md:flex min-h-[38px] items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-bold transition-colors active:scale-95 cursor-pointer"
              title="مدیریت ۹۰/۱۰، ساتا و خروج فیزیکی کوتاژ مرجع"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>۹۰/۱۰ و خروج</span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[42px] md:min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-xs font-bold transition-colors active:scale-95 cursor-pointer"
            title="پرینت قبض‌های خروج"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>پرینت</span>
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(doc)}
              className="min-h-[42px] md:min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-blue-400/40 bg-blue-500/15 hover:bg-blue-500/25 text-blue-200 text-xs font-bold transition-colors active:scale-95 cursor-pointer"
              title="ویرایش این سند خروج"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-400" />
              <span>ویرایش</span>
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="min-h-[42px] md:min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs font-bold transition-colors active:scale-95 cursor-pointer"
              title="حذف این سند خروج"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>حذف</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Mobile Summary & Quick Actions (< md) */}
      <div className="md:hidden space-y-2.5 relative z-10">
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-300">
          <span className="font-bold text-slate-100 truncate max-w-[155px]">{esc(doc.importer)}</span>
          <span className="text-slate-500">·</span>
          <span className="text-cyan-300 font-semibold truncate max-w-[135px]">{esc(doc.goods)}</span>
          {doc.pallets > 0 && (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-purple-300 font-mono font-bold">{fa(doc.pallets)} پالت</span>
            </>
          )}
        </div>

        {isPartialDoc && linkedEntryDoc && linkedBalance && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/65 border border-white/10 text-[11px]">
            <span className="font-mono text-emerald-300">
              خروج: {fa(linkedBalance.totalExited)}/{fa(linkedBalance.totalPallets)} پالت
            </span>
            {linkedBalance.remainingPallets > 0 ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  linkedBalance.sataConfirmed
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                {linkedBalance.sataConfirmed ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                {linkedBalance.sataConfirmed ? '۱۰٪ آزاد' : '۱۰٪ قفل ساتا'}
              </span>
            ) : (
              <span className="text-amber-300 font-mono">مانده: {fa(linkedBalance.totalRemaining)}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {linkedEntryDoc && onOpenClearance9010 && (
            <button
              type="button"
              onClick={() => onOpenClearance9010(linkedEntryDoc)}
              className="min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-bold transition-colors active:scale-95 shrink-0 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>۹۰/۱۰ و خروج</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileExpanded((prev) => !prev)}
            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/12 flex items-center justify-between text-xs font-bold text-slate-200 transition-colors active:scale-[0.99] cursor-pointer"
          >
            <span>{mobileExpanded ? 'بستن مراحل' : 'مراحل و جزئیات'}</span>
            <ChevronDown
              className={`w-4 h-4 text-blue-400 transition-transform duration-200 ${mobileExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Collapsible Full Details on Mobile (Always Expanded on md+) */}
      <div className={`${mobileExpanded ? 'block mt-3 pt-3 border-t border-white/10' : 'hidden'} md:block`}>
      {/* Meta Bar */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap text-xs text-slate-300 mb-4 relative z-10">
        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400">پرونده:</span> <b className="font-mono text-slate-100">{fa(doc.file)}</b>
        </span>
        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
          <Building2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">صاحب کالا:</span> <b className="text-slate-100">{esc(doc.importer)}</b>
        </span>
        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
          <Truck className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">حمل:</span> {esc(doc.carrier)}
        </span>
        <span className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold px-2.5 py-1 rounded-lg">
          <Package className="w-3.5 h-3.5 text-cyan-400" />
          {esc(doc.goods)}
        </span>
        {(doc.mdfThickness || linkedEntryDoc?.mdfThickness) && (
          <span className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-400/30 text-indigo-200 font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg">
            ضخامت: {esc(doc.mdfThickness || linkedEntryDoc?.mdfThickness || '')}
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
            {fa(doc.pallets)} پالت {doc.partialExit?.isPartial ? `(از ${fa(doc.partialExit.totalPallets)} کل)` : ''}
          </span>
        )}
      </div>

      {/* Linked EntryDoc 90/10 Status Strip (only for partial exits) */}
      {isPartialDoc && linkedEntryDoc && linkedBalance && linkedStatus && (
        <div className="mb-4 p-3 rounded-2xl bg-slate-950/65 border border-white/10 flex items-center justify-between gap-2.5 flex-wrap text-xs relative z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400">کوتاژ مرجع {fa(linkedEntryDoc.cottage)}:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${CLEARANCE_STATUS_META[linkedStatus].badgeCls}`}>
              {CLEARANCE_STATUS_META[linkedStatus].shortLabel}
            </span>
            <span className="text-[11px] font-mono text-emerald-300">
              خروج فیزیکی: {fa(linkedBalance.totalExited)} / {fa(linkedBalance.totalPallets)} پالت
            </span>
            <span className="text-[11px] font-mono text-amber-300">
              مانده: {fa(linkedBalance.totalRemaining)} پالت
            </span>
          </div>
          <div className="flex items-center gap-2">
            {linkedBalance.remainingPallets > 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  linkedBalance.sataConfirmed
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                {linkedBalance.sataConfirmed ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {linkedBalance.sataConfirmed ? '۱۰٪ آزاد' : '۱۰٪ قفل ساتا'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Partial Exit Status Banner */}
      {doc.partialExit?.isPartial && (
        <div className="w-full bg-slate-950/70 border border-amber-500/30 rounded-xl p-3 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10 shadow-inner">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1 text-amber-300 font-bold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              <span>پارت‌بندی درصدی بار تجمیع:</span>
            </div>
            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold px-2.5 py-0.5 rounded-md">
              خارج‌شده: {fa(doc.partialExit.exitPercent)}٪ ({fa(doc.partialExit.exitPallets)} پالت)
            </span>
            <span className="bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold px-2.5 py-0.5 rounded-md">
              باقی‌مانده در انبار گمرک: {fa(doc.partialExit.remainingPercent)}٪ ({fa(doc.partialExit.remainingPallets)} پالت)
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              (مجموع کل بار: {fa(doc.partialExit.totalPallets)} پالت)
            </span>
          </div>

          {/* Dual Progress Bar in Exit Card */}
          <div className="w-full sm:w-48 flex items-center gap-2 shrink-0">
            <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
              <div
                className="bg-emerald-400 h-full"
                style={{ width: `${Math.min(100, Math.max(0, doc.partialExit.exitPercent))}%` }}
                title={`خارج‌شده: ${fa(doc.partialExit.exitPercent)}٪`}
              />
              <div
                className="bg-amber-400 h-full"
                style={{ width: `${Math.min(100, Math.max(0, doc.partialExit.remainingPercent))}%` }}
                title={`باقی‌مانده: ${fa(doc.partialExit.remainingPercent)}٪`}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-300 shrink-0 font-bold">
              {fa(doc.partialExit.exitPercent)}٪ / {fa(doc.partialExit.remainingPercent)}٪
            </span>
          </div>
        </div>
      )}

      {/* Pipe Diagram */}
      <div className="flex items-center py-3.5 my-2.5 border-t border-b border-white/10 relative z-10 overflow-x-auto no-scrollbar">
        {[
          { label: 'مسیر', icon: Route, done: !!doc.route, skip: false },
          { label: 'ارزیاب', icon: Search, done: doc.evaluator.done, skip: doc.route === 'yellow' },
          { label: 'جهاد', icon: Leaf, done: doc.jihad.done, skip: false },
          { label: 'آزمایشگاه', icon: FlaskConical, done: isLabDone, skip: !doc.lab.needed },
          { label: 'کارشناس', icon: UserCheck, done: doc.expert.done, skip: false },
          { label: 'درب خروج', icon: LogOut, done: doc.gate.done, skip: false },
          { label: 'پرداخت', icon: CreditCard, done: doc.invoice.paid, skip: false },
        ].map((node, i) => {
          const NodeIcon = node.icon;
          const isCur = stage === i;

          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div
                  className={`flex-1 min-w-[16px] h-0.5 transition-all duration-500 ${
                    node.done || node.skip ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/10'
                  }`}
                />
              )}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs border transition-all duration-300 ${
                    node.done
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : node.skip
                      ? 'border-dashed border-white/20 text-slate-500 opacity-50'
                      : isCur
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                      : 'border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <NodeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] font-medium transition-colors whitespace-nowrap ${
                    node.done
                      ? 'text-slate-200'
                      : isCur
                      ? 'text-amber-300 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {node.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Stage Control Blocks */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4 text-xs relative z-10 ${!canUpdateStages ? 'pointer-events-none opacity-85 select-none' : ''}`}>
        {/* 1. Customs Route */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl space-y-2.5 border border-amber-500/15">
          <h5 className="font-bold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5 text-amber-400" />
              مسیر کوتاژ
            </span>
            {doc.route && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                doc.route === 'red'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
              }`}>
                {doc.route === 'red' ? 'مسیر قرمز' : 'مسیر زرد'}
              </span>
            )}
          </h5>

          <div className="flex gap-2">
            <button
              onClick={() => updateRoute('red')}
              className={`flex-1 py-2.5 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer ${
                doc.route === 'red'
                  ? 'border-rose-500/80 text-rose-200 bg-rose-500/25 shadow-[0_0_14px_rgba(244,63,94,0.35)]'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              مسیر قرمز (فیزیکی)
            </button>
            <button
              onClick={() => updateRoute('yellow')}
              className={`flex-1 py-2.5 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer ${
                doc.route === 'yellow'
                  ? 'border-amber-400/80 text-amber-200 bg-amber-500/25 shadow-[0_0_14px_rgba(251,191,36,0.35)]'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              مسیر زرد (اسنادی)
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
            {doc.route === 'red'
              ? 'مسیر قرمز: نیازمند تاییدیه ارزیاب فیزیکی گمرک'
              : doc.route === 'yellow'
              ? 'مسیر زرد: مرحله ارزیابی فیزیکی حذف می‌شود'
              : 'مسیر گمرکی را تعیین کنید'}
          </p>
        </div>

        {/* 2. Evaluator (If Red Route) */}
        {doc.route === 'red' && (
          <div className="glass-panel-subtle p-3.5 rounded-2xl space-y-2.5 border border-rose-500/15">
            <h5 className="font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-rose-400" />
                ارزیاب گمرک
              </span>
              {doc.evaluator.done && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  تایید شد
                </span>
              )}
            </h5>

            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-medium">
              <input
                type="checkbox"
                checked={doc.evaluator.done}
                onChange={(e) =>
                  onUpdateExit({
                    ...doc,
                    evaluator: { ...doc.evaluator, done: e.target.checked },
                  })
                }
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span className={doc.evaluator.done ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
                تاییدیه ارزیاب فیزیکی ثبت شد
              </span>
            </label>

            <textarea
              value={doc.evaluator.comment}
              onChange={(e) =>
                onUpdateExit({
                  ...doc,
                  evaluator: { ...doc.evaluator, comment: e.target.value },
                })
              }
              placeholder="کامنت و توضیحات ارزیاب..."
              rows={2}
              className="w-full glass-input rounded-xl p-2.5 text-xs outline-none resize-none font-sans"
            />
          </div>
        )}

        {/* 3. Jihad Agriculture */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl space-y-2.5 border border-emerald-500/15">
          <h5 className="font-bold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-emerald-400" />
              جهاد کشاورزی
            </span>
            {doc.jihad.done && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                تایید شد
              </span>
            )}
          </h5>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-medium">
            <input
              type="checkbox"
              checked={doc.jihad.done}
              onChange={(e) =>
                onUpdateExit({
                  ...doc,
                  jihad: { ...doc.jihad, done: e.target.checked },
                })
              }
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
            <span className={doc.jihad.done ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
              تاییدیه جهاد کشاورزی دریافت شد
            </span>
          </label>

          <textarea
            value={doc.jihad.comment}
            onChange={(e) =>
              onUpdateExit({
                ...doc,
                jihad: { ...doc.jihad, comment: e.target.value },
              })
            }
            placeholder="توضیحات و مجوزهای جهاد کشاورزی..."
            rows={2}
            className="w-full glass-input rounded-xl p-2.5 text-xs outline-none resize-none font-sans"
          />
        </div>

        {/* 4. Lab Testing Block (Wide) */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl space-y-2.5 lg:col-span-3 border border-cyan-500/20">
          <h5 className="font-bold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
              آزمایشگاه و قرنطینه
            </span>
            {isLabDone && (
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold">
                تکمیل و معتبر
              </span>
            )}
          </h5>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-medium">
            <input
              type="checkbox"
              checked={doc.lab.needed}
              onChange={(e) =>
                onUpdateExit({
                  ...doc,
                  lab: { ...doc.lab, needed: e.target.checked },
                })
              }
              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
            />
            <span className={doc.lab.needed ? 'text-cyan-300 font-semibold' : 'text-slate-300'}>
              این کالا نیاز به نمونه‌برداری و آزمایشگاه دارد
            </span>
          </label>

          {doc.lab.needed && (
            <div className="pt-2 space-y-2.5">
              {doc.lab.reusedFrom ? (
                <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/15 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2.5 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">از سابقه آزمایشگاهی معتبر قبلی استفاده شد (صرفه‌جویی در هزینه و زمان)</span>
                </div>
              ) : (
                <>
                  {validLabRecord && !doc.lab.tested && (
                    <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-indigo-500/15 border border-dashed border-cyan-400/50 rounded-xl p-3.5 flex items-center justify-between gap-3 flex-wrap shadow-md">
                      <div className="text-xs text-cyan-200">
                        <span className="font-bold flex items-center gap-1.5 text-cyan-100">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          سابقه معتبر آزمایشگاهی برای کالای «{esc(doc.goods)}» موجود است!
                        </span>
                        <span className="text-[11px] text-slate-300 block mt-1">
                          تاریخ نمونه‌برداری: {fmtJ(validLabRecord.rec.sampleDate)} — اعتبار باقی‌مانده:{' '}
                          <b className="text-amber-300 font-bold">{remTxt(validLabRecord.days)}</b>
                        </span>
                      </div>
                      <button
                        onClick={() => reuseLabRecord(validLabRecord.rec.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 font-bold text-xs transition-all active:scale-95 shadow-sm cursor-pointer"
                      >
                        استفاده از این سابقه
                      </button>
                    </div>
                  )}

                  <div className="flex gap-4 flex-wrap pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-medium">
                      <input
                        type="checkbox"
                        checked={doc.lab.sampled}
                        onChange={(e) =>
                          onUpdateExit({
                            ...doc,
                            lab: {
                              ...doc.lab,
                              sampled: e.target.checked,
                              sampleDate: e.target.checked ? doc.unloadDate : null,
                            },
                          })
                        }
                        className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                      />
                      <span className={doc.lab.sampled ? 'text-cyan-300' : 'text-slate-300'}>نمونه‌برداری انجام شد</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-medium">
                      <input
                        type="checkbox"
                        checked={doc.lab.sent}
                        onChange={(e) =>
                          onUpdateExit({
                            ...doc,
                            lab: { ...doc.lab, sent: e.target.checked },
                          })
                        }
                        className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                      />
                      <span className={doc.lab.sent ? 'text-cyan-300' : 'text-slate-300'}>ارسال به آزمایشگاه</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-medium">
                      <input
                        type="checkbox"
                        checked={doc.lab.tested}
                        onChange={(e) => handleLabTestedToggle(e.target.checked)}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                      />
                      <span className={doc.lab.tested ? 'text-emerald-300 font-bold' : 'text-slate-300'}>نتیجه و تست آزمایشگاه نهایی شد</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <textarea
                      value={doc.lab.comment}
                      onChange={(e) =>
                        onUpdateExit({
                          ...doc,
                          lab: { ...doc.lab, comment: e.target.value },
                        })
                      }
                      placeholder="کامنت / نتیجه آزمایشگاه..."
                      rows={2}
                      className="sm:col-span-2 glass-input rounded-xl p-2.5 text-xs outline-none resize-none font-sans"
                    />

                    <div className="flex flex-col justify-center gap-1 bg-white/5 p-2.5 rounded-xl border border-white/10">
                      <span className="text-[11px] text-slate-300 font-medium">مدت اعتبار سابقه (ماه):</span>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={doc.lab.validity}
                        onChange={(e) =>
                          onUpdateExit({
                            ...doc,
                            lab: {
                              ...doc.lab,
                              validity: parseInt(e.target.value, 10) || 6,
                            },
                          })
                        }
                        className="w-24 glass-input rounded-lg px-2.5 py-1 text-xs outline-none font-mono"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 5. Virtual Expert */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl space-y-2.5 border border-blue-500/15">
          <h5 className="font-bold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              کارشناس مجازی
            </span>
            {doc.expert.done && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                تایید شد
              </span>
            )}
          </h5>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-medium">
            <input
              type="checkbox"
              checked={doc.expert.done}
              onChange={(e) =>
                onUpdateExit({
                  ...doc,
                  expert: { done: e.target.checked },
                })
              }
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
            <span className={doc.expert.done ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
              تاییدیه کارشناس مجازی گمرک ثبت شد
            </span>
          </label>
        </div>

        {/* 6. Gate Exit */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl space-y-2.5 border border-teal-500/15">
          <h5 className="font-bold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5 text-teal-400" />
              درب خروج
            </span>
            {doc.gate.done && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                خارج شد
              </span>
            )}
          </h5>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-medium">
            <input
              type="checkbox"
              checked={doc.gate.done}
              onChange={(e) =>
                onUpdateExit({
                  ...doc,
                  gate: { done: e.target.checked },
                })
              }
              className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
            />
            <span className={doc.gate.done ? 'text-teal-300 font-bold' : 'text-slate-300'}>
              کالا از درب گمرک خارج شد
            </span>
          </label>
        </div>

        {/* 7. Customs Invoice */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl space-y-2.5 border border-amber-500/15">
          <h5 className="font-bold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              صورت‌حساب گمرک
            </span>
            {doc.invoice.paid && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                پرداخت شد
              </span>
            )}
          </h5>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-medium">
            <input
              type="checkbox"
              checked={doc.invoice.paid}
              onChange={(e) =>
                onUpdateExit({
                  ...doc,
                  invoice: { paid: e.target.checked },
                })
              }
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
            <span className={doc.invoice.paid ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
              صورت‌حساب گمرک پرداخت شد
            </span>
          </label>

          {stage === 7 && (
            <div
              className={`text-center font-bold p-3 rounded-xl text-xs mt-2 flex items-center justify-center gap-2 border ${
                isPhysicallyAndFinanciallyClosed
                  ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-amber-500/15 border-cyan-400/50 text-cyan-200'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${isPhysicallyAndFinanciallyClosed ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <span>
                {isPhysicallyAndFinanciallyClosed
                  ? 'پرونده این خروج مختومه شد — بار با موفقیت خارج گردید'
                  : `تشریفات گمرکی سند خروج تکمیل شد (باقی‌مانده خروج فیزیکی / اختتام ۹۰/۱۰: ${fa(linkedBalance?.totalRemaining || 0)} پالت)`}
              </span>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
