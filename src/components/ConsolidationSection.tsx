import React, { useState } from 'react';
import { Layers, Printer, Lock, CheckCircle2, Trash2, HelpCircle, AlertCircle, X } from 'lucide-react';
import { EntryDoc, Batch, ExitDoc } from '../types';
import { fa, fmtJ, en, esc, todayJ } from '../utils/jalali';
import { printBatchReceipts } from '../utils/print';
import { groupEntryDocsByFile, normalizeFileNumber } from '../utils/clearance9010';

interface ConsolidationSectionProps {
  docs: EntryDoc[];
  batches: Batch[];
  exits?: ExitDoc[];
  companyName?: string;
  onCreateBatch: (batchId: string, docIds: string[], goods: string, file: string) => void;
  onFinalizeBatch: (batchId: string) => void;
  onDeleteBatch: (batchId: string) => void;
  getStageOf: (d: EntryDoc) => number;
  canCreateBatch?: boolean;
  canDelete?: boolean;
}

export const ConsolidationSection: React.FC<ConsolidationSectionProps> = ({
  docs,
  batches,
  exits = [],
  companyName = '',
  onCreateBatch,
  onFinalizeBatch,
  onDeleteBatch,
  getStageOf,
  canCreateBatch = true,
  canDelete = false,
}) => {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [batchNumInput, setBatchNumInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [printModalBatch, setPrintModalBatch] = useState<{ batch: Batch; memberDocs: EntryDoc[]; ownerCompany: string } | null>(null);
  const [manualExitCottage, setManualExitCottage] = useState('');
  const [manualCottageError, setManualCottageError] = useState('');

  const resolveOwnerCompany = (memberDocs: EntryDoc[]) => {
    const owners = Array.from(
      new Set(memberDocs.map((d) => String(d.importer || '').trim()).filter(Boolean))
    );
    return owners.join(' / ') || companyName || '';
  };

  const handlePrintBatchClick = (b: Batch, memberDocs: EntryDoc[]) => {
    const ownerCompany = resolveOwnerCompany(memberDocs);
    const linkedExit = exits.find((x) => String(x.batchId || '') === String(b.id));
    if (linkedExit?.cottage) {
      printBatchReceipts(b, memberDocs, {
        exitCottage: linkedExit.cottage,
        ownerCompany,
      });
      return;
    }
    setManualExitCottage('');
    setManualCottageError('');
    setPrintModalBatch({ batch: b, memberDocs, ownerCompany });
  };

  const handleConfirmManualPrint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!printModalBatch) return;
    const cleanCot = en(manualExitCottage.trim());
    if (!cleanCot) {
      setManualCottageError('لطفاً شماره کوتاژ خروج را وارد کنید.');
      return;
    }
    printBatchReceipts(printModalBatch.batch, printModalBatch.memberDocs, {
      exitCottage: cleanCot,
      ownerCompany: printModalBatch.ownerCompany,
    });
    setPrintModalBatch(null);
    setManualExitCottage('');
    setManualCottageError('');
  };

  // Eligible documents = Stage 4 (Complete) and not yet in a batch
  const eligibleDocs = docs.filter((d) => {
    const isComplete = getStageOf(d) === 4;
    const inBatch = batches.some((b) => b.docIds.includes(d.id));
    return isComplete && !inBatch;
  });

  // Keep only selected IDs that are still eligible
  const activeSelected = eligibleDocs.filter((d) => selectedDocIds.has(d.id));

  // Determine anchor file number from first selected document (consolidate strictly by File Number)
  const anchorDoc = activeSelected.length > 0 ? activeSelected[0] : null;
  const anchorFile = anchorDoc ? normalizeFileNumber(anchorDoc.file) : null;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedDocIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedDocIds(next);
    setErrorMsg('');
  };

  const handleMerge = () => {
    setErrorMsg('');
    if (activeSelected.length < 2) {
      setErrorMsg('حداقل ۲ سند کامل انتخاب کنید');
      return;
    }

    const num = en(batchNumInput.trim()).toUpperCase();
    if (!num) {
      setErrorMsg('شناسه تجمیع الزامی است');
      return;
    }

    if (!/^SEETEC\d{5}COMB\d{4}$/.test(num)) {
      setErrorMsg('قالب شناسه: SEETEC + ۵ رقم + COMB + ۴ رقم (مانند SEETEC12345COMB1234)');
      return;
    }

    if (batches.some((b) => String(b.id) === num)) {
      setErrorMsg('این شناسه تجمیع قبلاً ثبت شده است');
      return;
    }

    const distinctGoods = Array.from(
      new Set(activeSelected.map((d) => (d.goods || '').trim()).filter(Boolean))
    );
    const combinedGoods = distinctGoods.join(' / ') || anchorDoc?.goods || '';

    onCreateBatch(
      num,
      activeSelected.map((d) => d.id),
      combinedGoods,
      normalizeFileNumber(anchorDoc?.file)
    );

    setSelectedDocIds(new Set());
    setBatchNumInput('');
  };

  // Group eligible documents strictly by File Number (شماره پرونده)
  const groupedEligible = groupEntryDocsByFile<EntryDoc>(eligibleDocs);

  const totalSelectedPallets = activeSelected.reduce((a, d) => a + d.pallets, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-lalezar text-2xl font-normal text-slate-100 tracking-wide">
          تجمیع
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Eligible Documents Picker */}
        <div className="lg:col-span-5 glass-panel p-5 shadow-xl rounded-2xl">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-white/10">
            <div className="w-9 h-9 rounded-xl bg-cyan-400/15 text-cyan-400 flex items-center justify-center backdrop-blur-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-lalezar text-lg text-slate-100">
                اسناد آماده تجمیع ({fa(eligibleDocs.length)})
              </h3>
            </div>
          </div>

          {/* List of Eligible Docs */}
          <div className="space-y-4 max-h-[480px] overflow-y-auto pl-1">
            {Object.keys(groupedEligible).length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs leading-relaxed">
                هنوز سند کاملی برای تجمیع آماده نشده است.
                <br />
                سند زمانی «کامل» می‌شود که تخلیه، قبض انبار و هر سه مدرک آن ثبت شده باشد.
              </div>
            ) : (
              Object.keys(groupedEligible).map((key) => {
                const groupDocs = groupedEligible[key];
                const sample = groupDocs[0];
                const groupFile = normalizeFileNumber(sample.file);
                const isLocked = anchorFile !== null && groupFile !== anchorFile;
                const groupGoodsLabel = Array.from(
                  new Set(groupDocs.map((d) => (d.goods || '').trim()).filter(Boolean))
                ).join(' / ');

                return (
                  <div
                    key={key}
                    className={`glass-panel-subtle p-3 rounded-xl transition-all ${
                      isLocked ? 'opacity-40 border-dashed' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-2">
                      <span className="font-lalezar text-cyan-300 shrink-0">
                        پرونده {fa(sample.file)}
                      </span>
                      <span className="text-emerald-400 font-bold truncate">{groupGoodsLabel}</span>
                      <span className="text-slate-400 shrink-0">{fa(groupDocs.length)} سند</span>
                    </div>

                    <div className="space-y-1.5">
                      {groupDocs.map((d) => {
                        const isChecked = selectedDocIds.has(d.id);

                        return (
                          <label
                            key={d.id}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? 'border-cyan-400 bg-cyan-400/10 text-slate-100 shadow-sm'
                                : 'border-white/5 bg-black/20 text-slate-300 hover:border-white/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isLocked}
                              onChange={() => toggleSelect(d.id)}
                              className="w-4 h-4 accent-cyan-400 rounded cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span className="font-lalezar text-sm text-slate-100">
                              {fa(d.cottage)}
                            </span>
                            <span className="ltr font-mono text-[11px] text-cyan-300">
                              {d.bl}
                            </span>
                            <span className="text-[11px] text-slate-400 mr-auto">
                              قبض: {d.receipt.number || '—'} ({fa(d.pallets)} پالت)
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Merge Control Bar */}
          <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
            {!canCreateBatch ? (
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 font-semibold text-center">
                ثبت تجمیع جدید توسط مدیر سامانه (نظری) برای حساب شما محدود شده است.
              </div>
            ) : (
              <>
                {anchorDoc && (
                  <div className="text-xs text-slate-300 bg-cyan-400/5 border border-dashed border-cyan-400/30 rounded-xl p-3 backdrop-blur-md">
                    <div>
                      پرونده <b className="text-slate-100">{fa(anchorDoc.file)}</b>
                      <br />
                      <span className="text-emerald-400 font-bold">
                        {fa(activeSelected.length)} سند انتخاب‌شده ({fa(totalSelectedPallets)} پالت)
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={batchNumInput}
                    onChange={(e) => setBatchNumInput(e.target.value.toUpperCase())}
                    placeholder="SEETEC12345COMB1234"
                    className="glass-input w-full px-3 py-2.5 text-xs ltr text-left uppercase font-mono tracking-wider"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errorMsg}
                  </p>
                )}

                <button
                  onClick={handleMerge}
                  disabled={activeSelected.length < 2}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs hover:from-amber-300 hover:to-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                >
                  ایجاد تجمیع
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Existing Batches List */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="font-lalezar text-lg text-slate-100">
            لیست تجمیع‌های ثبت‌شده ({fa(batches.length)})
          </h3>

          {batches.length === 0 ? (
            <div className="glass-panel p-8 rounded-2xl text-center text-slate-400 text-xs">
              هیچ تجمیعی ثبت نشده است. از پانل سمت راست اسناد هم‌پرونده را انتخاب و تجمیع کنید.
            </div>
          ) : (
            batches
              .slice()
              .reverse()
              .map((b) => {
                const memberDocs = b.docIds.map((id) => docs.find((d) => d.id === id)).filter(Boolean) as EntryDoc[];
                const totalPallets = memberDocs.reduce((a, d) => a + d.pallets, 0);

                return (
                  <div
                    key={b.id}
                    className={`glass-panel p-5 rounded-2xl relative space-y-3 shadow-xl transition-all ${
                      b.finalized ? 'border-amber-400/50' : ''
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-lalezar text-xl text-cyan-300">
                          تجمیع {fa(b.id)}
                        </span>
                        <span className="bg-amber-500/15 border border-amber-400/40 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold text-amber-200">
                          پرونده {fa(b.file)}
                        </span>
                        <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-lg text-xs ltr font-mono text-cyan-400">
                          {b.id}
                        </span>
                        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold backdrop-blur-md">
                          {b.goods}
                        </span>
                        <span
                          className={`text-xs px-3 py-0.5 rounded-full border backdrop-blur-md ${
                            b.finalized
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold'
                              : 'border-white/10 text-slate-300'
                          }`}
                        >
                          {b.finalized ? 'نهایی شده' : 'در انتظار نهایی'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePrintBatchClick(b, memberDocs)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 text-xs transition-colors font-bold backdrop-blur-md cursor-pointer"
                        title="پرینت قبض‌های انبار تجمیع‌شده"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>پرینت قبض‌ها</span>
                      </button>
                    </div>

                    {/* Table of Members */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400">
                            <th className="py-2 px-2 font-medium">کوتاژ</th>
                            <th className="py-2 px-2 font-medium">بارنامه</th>
                            <th className="py-2 px-2 font-medium">قبض انبار</th>
                            <th className="py-2 px-2 font-medium">برند</th>
                            <th className="py-2 px-2 font-medium">پالت</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberDocs.map((d) => (
                            <tr key={d.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-2 px-2 font-lalezar text-sm text-slate-100">
                                {fa(d.cottage)}
                              </td>
                              <td className="py-2 px-2 ltr font-mono text-cyan-300">
                                {d.bl}
                              </td>
                              <td className="py-2 px-2 text-slate-300">
                                {d.receipt.number || '—'}
                              </td>
                              <td className="py-2 px-2 text-amber-300">
                                {d.brand || '—'}
                              </td>
                              <td className="py-2 px-2 text-slate-300">
                                {fa(d.pallets)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Summary & Actions */}
                    <div className="flex items-center justify-between gap-3 pt-2 text-xs text-cyan-300 flex-wrap">
                      <span>
                        {fa(memberDocs.length)} قبض انبار · {fa(totalPallets)} پالت مجموع
                      </span>

                      <div className="flex items-center gap-2">
                        {!b.finalized && (
                          <button
                            type="button"
                            onClick={() => onFinalizeBatch(b.id)}
                            className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-colors shadow-md cursor-pointer"
                          >
                            نهایی کردن تجمیع
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDeleteBatch(b.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-bold transition-colors backdrop-blur-md cursor-pointer"
                            title="حذف این تجمیع"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف تجمیع</span>
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

      {/* Mini Modal: Manual Exit Kootazh Entry before Printing Consolidated Receipts */}
      {printModalBatch && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl"
          onClick={() => setPrintModalBatch(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md ios-glass-modal p-6 rounded-3xl border border-cyan-400/35 shadow-[0_30px_80px_rgba(0,0,0,0.9)] space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-cyan-300">
                  <Printer className="w-5 h-5" />
                </div>
                <h3 className="font-lalezar text-xl text-slate-100 font-normal">
                  ورود شماره کوتاژ خروج جهت چاپ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalBatch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              برای این تجمیع (پرونده <b className="text-amber-300 font-mono">{fa(printModalBatch.batch.file)}</b>) هنوز سند خروجی ثبت نشده است. شماره کوتاژ خروج اختصاص‌یافته را وارد کنید تا در سربرگ «قبض‌های انبار تجمیع‌شده» چاپ شود.
            </p>

            <form onSubmit={handleConfirmManualPrint} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">
                  شماره کوتاژ خروج
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={manualExitCottage}
                  onChange={(e) => {
                    setManualExitCottage(e.target.value);
                    if (manualCottageError) setManualCottageError('');
                  }}
                  placeholder="مثلاً 1402234"
                  className={`w-full glass-input rounded-xl px-3.5 py-2.5 text-sm ltr text-center font-mono tracking-wider outline-none ${
                    manualCottageError ? 'border-rose-500' : 'border-cyan-400/40'
                  }`}
                />
                {manualCottageError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{manualCottageError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl ios-glass-btn-cyan text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ قبض‌های انبار تجمیع‌شده</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalBatch(null)}
                  className="px-4 py-2.5 rounded-xl ios-glass-btn text-slate-300 hover:text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
