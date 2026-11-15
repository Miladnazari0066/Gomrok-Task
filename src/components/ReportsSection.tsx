import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  Package,
  Layers,
  CheckCircle2,
  Printer,
  Search,
  FolderSearch,
  FileText,
  X,
  Sparkles,
  Info,
  SlidersHorizontal,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { EntryDoc, ExitDoc, Batch } from '../types';
import { fa, todayJ } from '../utils/jalali';
import { MonthlyCottageBarChart } from './MonthlyCottageBarChart';

interface ReportsSectionProps {
  docs: EntryDoc[];
  exits: ExitDoc[];
  batches: Batch[];
  getStageOf: (d: EntryDoc) => number;
  onClose?: () => void;
}

export type ReportScope = 'entry' | 'exit' | 'both';

export const ReportsSection: React.FC<ReportsSectionProps> = ({
  docs = [],
  exits = [],
  batches = [],
  getStageOf,
  onClose,
}) => {
  // Extract all distinct file numbers available in system
  const availableFileNos = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((d) => d.file && set.add(d.file.trim()));
    exits.forEach((x) => x.file && set.add(x.file.trim()));
    batches.forEach((b) => b.file && set.add(b.file.trim()));
    return Array.from(set).sort();
  }, [docs, exits, batches]);

  // Selection States
  const [selectedFileNo, setSelectedFileNo] = useState<string | null>(null);
  const [reportScope, setReportScope] = useState<ReportScope>('both');

  // Modal / Selection Form State
  const [showSelectionModal, setShowSelectionModal] = useState<boolean>(true);
  const [tempFileNo, setTempFileNo] = useState<string>('');
  const [tempScope, setTempScope] = useState<ReportScope>('both');
  const [listSearch, setListSearch] = useState<string>('');

  // Handle closing modal
  const handleModalClose = () => {
    if (selectedFileNo) {
      setShowSelectionModal(false);
    } else if (onClose) {
      onClose();
    } else {
      setSelectedFileNo('ALL');
      setShowSelectionModal(false);
    }
  };

  // Auto pre-fill with first available file number on mount
  useEffect(() => {
    if (!selectedFileNo && availableFileNos.length > 0) {
      setTempFileNo(availableFileNos[0]);
    }
  }, [availableFileNos, selectedFileNo]);

  // Handle confirming the report query
  const handleConfirmReport = () => {
    const trimmed = tempFileNo.trim();
    if (!trimmed) return;
    setSelectedFileNo(trimmed);
    setReportScope(tempScope);
    setShowSelectionModal(false);
  };

  // Filtered Data based on Selected File Number
  const fileDocs = useMemo(() => {
    if (!selectedFileNo) return [];
    if (selectedFileNo === 'ALL') return docs;
    return docs.filter((d) => d.file && d.file.trim() === selectedFileNo);
  }, [docs, selectedFileNo]);

  const fileExits = useMemo(() => {
    if (!selectedFileNo) return [];
    if (selectedFileNo === 'ALL') return exits;
    return exits.filter((x) => x.file && x.file.trim() === selectedFileNo);
  }, [exits, selectedFileNo]);

  const fileBatches = useMemo(() => {
    if (!selectedFileNo) return [];
    if (selectedFileNo === 'ALL') return batches;
    return batches.filter((b) => b.file && b.file.trim() === selectedFileNo);
  }, [batches, selectedFileNo]);

  // Secondary text search filtering inside active report
  const filteredListDocs = useMemo(() => {
    if (!listSearch.trim()) return fileDocs;
    const q = listSearch.trim().toLowerCase();
    return fileDocs.filter((d) => {
      const matchText = [
        d.cottage,
        d.bl,
        d.file,
        d.importer,
        d.carrier,
        d.goods,
        d.brand,
        d.receipt?.number,
      ]
        .join(' ')
        .toLowerCase();
      return matchText.includes(q);
    });
  }, [fileDocs, listSearch]);

  const filteredListExits = useMemo(() => {
    if (!listSearch.trim()) return fileExits;
    const q = listSearch.trim().toLowerCase();
    return fileExits.filter((x) => {
      const matchText = [
        x.cottage,
        x.bl,
        x.file,
        x.importer,
        x.carrier,
        x.goods,
        x.brand,
        x.batchId,
      ]
        .join(' ')
        .toLowerCase();
      return matchText.includes(q);
    });
  }, [fileExits, listSearch]);

  // Metrics
  const totalCottages = useMemo(() => {
    const set = new Set<string>();
    fileDocs.forEach((d) => d.cottage && set.add(d.cottage.trim()));
    fileExits.forEach((x) => x.cottage && set.add(x.cottage.trim()));
    return set.size;
  }, [fileDocs, fileExits]);

  const primaryCompany = useMemo(() => {
    if (fileDocs.length > 0) return fileDocs[0].importer;
    if (fileExits.length > 0) return fileExits[0].importer;
    return 'نامشخص';
  }, [fileDocs, fileExits]);

  const primaryCargo = useMemo(() => {
    if (fileDocs.length > 0) return fileDocs[0].goods;
    if (fileExits.length > 0) return fileExits[0].goods;
    return 'نامشخص';
  }, [fileDocs, fileExits]);

  const totalTrailers = fileDocs.reduce((a, d) => a + (d.trailers || 0), 0);
  const unloadedTrailers = fileDocs.reduce((a, d) => a + (d.unloaded || 0), 0);
  const totalPallets = fileDocs.reduce((a, d) => a + (d.pallets || 0), 0);
  const gateExitedCount = fileExits.filter((x) => x.gate?.done).length;
  const closedExitsCount = fileExits.filter((x) => x.invoice?.paid && x.gate?.done).length;
  const unloadRatio = totalTrailers > 0 ? Math.round((unloadedTrailers / totalTrailers) * 100) : 0;

  // Print execution handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* PRINT-ONLY OFFICIAL REPORT HEADER */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6 text-right font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">سامانه مدیریت گمرک و انبارداری</h1>
            <h2 className="text-sm font-semibold text-slate-700 mt-1">گزارش رسمی پرونده گمرکی</h2>
          </div>
          <div className="text-left text-xs text-slate-600 space-y-1">
            <p>
              شماره پرونده: <b>{selectedFileNo === 'ALL' ? 'تمامی پرونده‌ها' : fa(selectedFileNo || '-')}</b>
            </p>
            <p>
              نوع گزارش: <b>{reportScope === 'entry' ? 'اسناد ورود' : reportScope === 'exit' ? 'اسناد خروج' : 'ورود و خروج کامل'}</b>
            </p>
            <p>
              تاریخ تنظیم گزارش: <b>{fa(`${todayJ().jy}/${todayJ().jm}/${todayJ().jd}`)}</b>
            </p>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-300 grid grid-cols-3 text-xs text-slate-800">
          <div>
            صاحب کالا: <b>{primaryCompany}</b>
          </div>
          <div>
            نوع کالا: <b>{primaryCargo}</b>
          </div>
          <div>
            تعداد کل کوتاژها: <b>{fa(totalCottages)}</b>
          </div>
        </div>
      </div>

      {/* POP-UP SELECTION MODAL (COMPACT, SLEEK, WITH CANCEL & CLOSE BUTTON) */}
      {showSelectionModal && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0b1324] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 max-w-md w-full space-y-4 text-slate-100 shadow-2xl shadow-cyan-950/60">
            {/* Modal Header */}
            <div className="reports-modal-header border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <FolderSearch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-lalezar text-base sm:text-lg text-slate-100 leading-tight">تنظیم و صدور گزارش پرونده</h3>
                  <p className="text-[11px] text-slate-400">شماره پرونده و محدوده اسناد را انتخاب کنید</p>
                </div>
              </div>

              {/* ALWAYS-VISIBLE CLOSE BUTTON IN TOP CORNER */}
              <button
                type="button"
                onClick={handleModalClose}
                className="p-1.5 text-slate-400 hover:text-rose-300 rounded-lg bg-white/5 hover:bg-rose-500/15 border border-white/10 transition-colors cursor-pointer"
                title="بستن پنجره و بازگشت"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* STEP 1: FILE NUMBER */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                  ۱
                </span>
                <span>انتخاب یا جست‌وجوی شماره پرونده:</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={tempFileNo}
                  onChange={(e) => setTempFileNo(e.target.value)}
                  placeholder="شماره پرونده را وارد کنید (مثال: ۱۰۲۳)..."
                  className="w-full glass-input rounded-xl py-2 pr-3 pl-8 text-xs text-cyan-300 font-mono outline-none border border-cyan-500/30 focus:border-cyan-400"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400/60 text-xs font-mono">
                  #
                </div>
              </div>

              {/* Quick Chips of Available File Numbers */}
              {availableFileNos.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>پرونده‌های فعال:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-0.5">
                    {availableFileNos.map((fileNo) => (
                      <button
                        key={fileNo}
                        type="button"
                        onClick={() => setTempFileNo(fileNo)}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all border cursor-pointer ${
                          tempFileNo === fileNo
                            ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400 font-bold shadow-xs'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                        }`}
                      >
                        پرونده {fa(fileNo)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTempFileNo('ALL')}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all border cursor-pointer ${
                        tempFileNo === 'ALL'
                          ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400 font-bold shadow-xs'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      همه پرونده‌ها
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: CHOOSE SCOPE (ENTRY / EXIT / BOTH) */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                  ۲
                </span>
                <span>محدوده اسناد گزارش:</span>
              </label>

              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-white/10">
                {/* Option 1: Entry Docs */}
                <button
                  type="button"
                  onClick={() => setTempScope('entry')}
                  className={`py-2 px-1.5 rounded-lg text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    tempScope === 'entry'
                      ? 'bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px]">اسناد ورود</span>
                </button>

                {/* Option 2: Exit Docs */}
                <button
                  type="button"
                  onClick={() => setTempScope('exit')}
                  className={`py-2 px-1.5 rounded-lg text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    tempScope === 'exit'
                      ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px]">اسناد خروج</span>
                </button>

                {/* Option 3: Both (Full Report) */}
                <button
                  type="button"
                  onClick={() => setTempScope('both')}
                  className={`py-2 px-1.5 rounded-lg text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    tempScope === 'both'
                      ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px]">هر دو (کامل)</span>
                </button>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmReport}
                disabled={!tempFileNo.trim()}
                className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>مشاهده و صدور گزارش</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="py-2 px-3 rounded-xl border border-white/10 hover:border-rose-500/30 bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-200 font-bold text-xs transition-colors cursor-pointer"
              >
                انصراف و بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP CONTROL BAR: COMPACT, ELEGANT & WITH EXPLICIT CLOSE BUTTON */}
      <div className="glass-panel p-3 sm:p-4 rounded-xl border border-white/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Active File & Scope Details */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
            <FolderSearch className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-xs text-slate-400">پرونده:</span>
              <span className="font-lalezar text-base sm:text-lg text-cyan-300 tracking-wide">
                {selectedFileNo === 'ALL' ? 'تمامی پرونده‌ها' : fa(selectedFileNo || '-')}
              </span>

              {/* Scope Badge */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  reportScope === 'entry'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : reportScope === 'exit'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                }`}
              >
                {reportScope === 'entry'
                  ? 'اسناد ورود'
                  : reportScope === 'exit'
                  ? 'اسناد خروج'
                  : 'ورود و خروج کامل'}
              </span>

              <button
                onClick={() => {
                  if (selectedFileNo) setTempFileNo(selectedFileNo);
                  setTempScope(reportScope);
                  setShowSelectionModal(true);
                }}
                className="print:hidden flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 rounded-lg border border-amber-500/30 transition-all font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>تغییر پرونده</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              صاحب کالا: <b className="text-slate-200">{primaryCompany}</b> | نوع کالا:{' '}
              <b className="text-slate-200">{primaryCargo}</b> | کل کوتاژها:{' '}
              <b className="text-amber-400">{fa(totalCottages)}</b>
            </p>
          </div>
        </div>

        {/* Action Controls: PRINT and CLOSE / RETURN BUTTON */}
        <div className="print:hidden flex items-center gap-2 self-end md:self-auto shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition-all shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer"
            title="چاپ مستقیم گزارش"
          >
            <Printer className="w-3.5 h-3.5 text-slate-950" />
            <span>چاپ گزارش</span>
          </button>

          {/* EXPLICIT CLOSE / EXIT BUTTON REQUESTED BY USER */}
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-100 border border-rose-500/30 transition-all font-bold text-xs active:scale-95 cursor-pointer shadow-xs"
              title="بستن بخش گزارش‌گیری و بازگشت به ورود کالا"
            >
              <X className="w-3.5 h-3.5" />
              <span>بستن و خروج</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI METRICS CARDS BASED ON SCOPE (COMPACT & SLEEK) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {(reportScope === 'entry' || reportScope === 'both') && (
          <div className="glass-panel p-3 sm:p-3.5 shadow-md rounded-xl border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>کوتاژهای ورودی</span>
              <Package className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="font-lalezar text-xl sm:text-2xl text-slate-100">{fa(fileDocs.length)}</div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span>تخلیه‌شده:</span>
              <b className="text-cyan-400">{fa(unloadedTrailers)}</b> از <b>{fa(totalTrailers)}</b>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${unloadRatio}%` }}
              />
            </div>
          </div>
        )}

        {(reportScope === 'exit' || reportScope === 'both') && (
          <div className="glass-panel p-3 sm:p-3.5 shadow-md rounded-xl border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>اسناد خروج مرتبط</span>
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="font-lalezar text-xl sm:text-2xl text-slate-100">{fa(fileExits.length)}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              خارج‌شده: <b className="text-emerald-400">{fa(gateExitedCount)}</b> کوتاژ
            </div>
          </div>
        )}

        <div className="glass-panel p-3 sm:p-3.5 shadow-md rounded-xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>مجموع پالت‌های پرونده</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-lalezar text-xl sm:text-2xl text-slate-100">{fa(totalPallets)}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            تجمیع‌های مرتبط: <b className="text-amber-400">{fa(fileBatches.length)}</b>
          </div>
        </div>

        <div className="glass-panel p-3 sm:p-3.5 shadow-md rounded-xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>مختومه‌شده کامل</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="font-lalezar text-xl sm:text-2xl text-slate-100">{fa(closedExitsCount)}</div>
          <div className="text-[10px] text-purple-300 mt-1 font-semibold">
            تسویه حساب و خروج کامل
          </div>
        </div>
      </div>

      {/* INTERACTIVE RECHARTS BAR CHART: COTTAGE ENTRIES BY SOLAR HIJRI MONTHS */}
      {(reportScope === 'entry' || reportScope === 'both') && (
        <div className="print:hidden">
          <MonthlyCottageBarChart
            docs={docs}
            currentFileDocs={fileDocs}
            selectedFileNo={selectedFileNo}
          />
        </div>
      )}

      {/* FILTER SEARCH BAR INSIDE ACTIVE REPORT (COMPACT) */}
      <div className="print:hidden glass-panel p-2.5 sm:p-3 rounded-xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="جست‌وجو در جدول (کوتاژ، کالا، برند...)"
            className="w-full glass-input rounded-lg py-1.5 pr-9 pl-3 text-xs outline-none"
          />
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {reportScope === 'both' ? (
              <>
                ورودی: <b className="text-cyan-300">{fa(filteredListDocs.length)}</b> | خروجی:{' '}
                <b className="text-emerald-300">{fa(filteredListExits.length)}</b>
              </>
            ) : reportScope === 'entry' ? (
              <>
                اسناد ورودی یافت‌شده: <b className="text-cyan-300">{fa(filteredListDocs.length)}</b>
              </>
            ) : (
              <>
                اسناد خروجی یافت‌شده:{' '}
                <b className="text-emerald-300">{fa(filteredListExits.length)}</b>
              </>
            )}
          </span>
        </div>
      </div>

      {/* TABLE 1: ENTRY DOCUMENTS (Shown if scope is 'entry' or 'both') */}
      {(reportScope === 'entry' || reportScope === 'both') && (
        <div className="glass-panel p-3.5 sm:p-4 shadow-lg rounded-xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h3 className="font-lalezar text-base sm:text-lg text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>
                {reportScope === 'both' ? '۱. ' : ''}اسناد و کوتاژهای ورودی پرونده{' '}
                {selectedFileNo === 'ALL' ? '' : fa(selectedFileNo || '')}
              </span>
            </h3>
            <span className="text-xs text-amber-400 font-mono">
              {fa(filteredListDocs.length)} کوتاژ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-white/5 text-slate-400 text-[11px] font-bold border-b border-white/10">
                <tr>
                  <th className="p-2.5">شماره کوتاژ</th>
                  <th className="p-2.5">بارنامه (BL)</th>
                  <th className="p-2.5">شرکت صاحب کالا</th>
                  <th className="p-2.5">نوع کالا و برند</th>
                  <th className="p-2.5">تعداد تریلی</th>
                  <th className="p-2.5">تعداد پالت</th>
                  <th className="p-2.5">تاریخ تخلیه</th>
                  <th className="p-2.5">مرحله و وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredListDocs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-5 text-center text-slate-500">
                      هیچ سند ورودی برای این شماره پرونده ثبت نشده است
                    </td>
                  </tr>
                ) : (
                  filteredListDocs.map((doc) => {
                    let stage = 1;
                    try {
                      stage = typeof getStageOf === 'function' ? getStageOf(doc) : 1;
                    } catch (e) {
                      stage = 1;
                    }
                    return (
                      <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-2.5 font-mono text-cyan-300 font-bold">{fa(doc.cottage)}</td>
                        <td className="p-2.5 font-mono">{doc.bl || '-'}</td>
                        <td className="p-2.5 font-semibold text-slate-200">{doc.importer}</td>
                        <td className="p-2.5">
                          {doc.goods} ({doc.brand})
                        </td>
                        <td className="p-2.5">
                          {fa(doc.unloaded)} از {fa(doc.trailers)} تریلی
                        </td>
                        <td className="p-2.5 font-mono text-amber-300 font-bold">
                          {fa(doc.pallets)}
                        </td>
                        <td className="p-2.5 font-mono">
                          {doc.unloadDate
                            ? `${fa(doc.unloadDate.jy)}/${fa(doc.unloadDate.jm)}/${fa(
                                doc.unloadDate.jd
                              )}`
                            : '-'}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                              stage === 1
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : stage === 4
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : stage === 5
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : stage === 6
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {stage === 1
                              ? 'در حال تخلیه'
                              : stage === 4
                              ? 'کامل'
                              : stage === 5
                              ? 'در تجمیع'
                              : stage === 6
                              ? 'آماده خروج'
                              : 'در حال تکمیل'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLE 2: EXIT DOCUMENTS (Shown if scope is 'exit' or 'both') */}
      {(reportScope === 'exit' || reportScope === 'both') && (
        <div className="glass-panel p-3.5 sm:p-4 shadow-lg rounded-xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h3 className="font-lalezar text-base sm:text-lg text-slate-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>
                {reportScope === 'both' ? '۲. ' : ''}اسناد و تشریفات خروج پرونده{' '}
                {selectedFileNo === 'ALL' ? '' : fa(selectedFileNo || '')}
              </span>
            </h3>
            <span className="text-xs text-emerald-400 font-mono">
              {fa(filteredListExits.length)} سند خروج
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-white/5 text-slate-400 text-[11px] font-bold border-b border-white/10">
                <tr>
                  <th className="p-2.5">کد تجمیع</th>
                  <th className="p-2.5">شماره کوتاژ</th>
                  <th className="p-2.5">مسیر</th>
                  <th className="p-2.5">ارزیاب / جهاد</th>
                  <th className="p-2.5">آزمایشگاه</th>
                  <th className="p-2.5">صورت‌حساب</th>
                  <th className="p-2.5">درب خروج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredListExits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-5 text-center text-slate-500">
                      هیچ سند خروجی برای این شماره پرونده ثبت نشده است
                    </td>
                  </tr>
                ) : (
                  filteredListExits.map((exit) => (
                    <tr key={exit.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-2.5 font-mono text-cyan-300 font-bold">
                        {exit.batchId || '-'}
                      </td>
                      <td className="p-2.5 font-mono text-amber-300">{fa(exit.cottage)}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            exit.route === 'red'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {exit.route === 'red' ? 'قرمز' : 'زرد'}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={
                            exit.evaluator?.done ? 'text-emerald-400 font-bold' : 'text-slate-500'
                          }
                        >
                          {exit.evaluator?.done ? '✓ ارزیاب' : '✗'}
                        </span>
                      </td>
                      <td className="p-2.5">
                        {exit.lab?.needed ? (
                          <span
                            className={
                              exit.lab?.tested
                                ? 'text-emerald-400 font-bold'
                                : 'text-amber-400'
                            }
                          >
                            {exit.lab?.tested ? 'تأیید شد' : 'در آزمایشگاه'}
                          </span>
                        ) : (
                          <span className="text-slate-500">عدم نیاز</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={
                            exit.invoice?.paid
                              ? 'text-emerald-400 font-bold'
                              : 'text-rose-400'
                          }
                        >
                          {exit.invoice?.paid ? 'تسویه' : 'بدهکار'}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={
                            exit.gate?.done ? 'text-emerald-400 font-bold' : 'text-slate-500'
                          }
                        >
                          {exit.gate?.done ? 'خارج شده' : 'منتظر'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
