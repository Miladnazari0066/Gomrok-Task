import React, { useState, useEffect } from 'react';
import { LogOut, Save, Percent, Sparkles } from 'lucide-react';
import { ExitDoc, Batch, JalaliDate, EntryDoc } from '../types';
import { JalaliDatePicker } from './JalaliDatePicker';
import { ComboboxField } from './ComboboxField';
import { en, todayJ, fa } from '../utils/jalali';
import {
  calculatePartialExitByPercent,
  filterStandaloneEntryDocs,
  inferMdfThickness,
  normalizeFileNumber,
} from '../utils/clearance9010';

interface ExitFormProps {
  editingDoc: ExitDoc | null;
  batches: Batch[];
  allDocs?: EntryDoc[];
  onSubmit: (data: Omit<ExitDoc, 'id' | 'createdAt' | 'route' | 'evaluator' | 'jihad' | 'lab' | 'expert' | 'gate' | 'invoice'>) => void;
  onCancelEdit: () => void;
  onSeedDemo?: () => void;
  importers: string[];
  carriers: string[];
  goodsList: string[];
  brands: string[];
  onAddImporter: (name: string) => void;
  onAddCarrier: (name: string) => void;
  onAddGoods: (name: string) => void;
  onAddBrand: (name: string) => void;
  onDeleteImporter?: (name: string) => void;
  onDeleteCarrier?: (name: string) => void;
  onDeleteGoods?: (name: string) => void;
  onDeleteBrand?: (name: string) => void;
  existingExits: ExitDoc[];
}

export const ExitForm: React.FC<ExitFormProps> = ({
  editingDoc,
  batches,
  allDocs = [],
  onSubmit,
  onCancelEdit,
  importers,
  carriers,
  goodsList,
  brands,
  onAddImporter,
  onAddCarrier,
  onAddGoods,
  onAddBrand,
  onDeleteImporter,
  onDeleteCarrier,
  onDeleteGoods,
  onDeleteBrand,
  existingExits,
}) => {
  const [cottage, setCottage] = useState('');
  const [bl, setBl] = useState('');
  const [file, setFile] = useState('');
  const [importer, setImporter] = useState('');
  const [carrier, setCarrier] = useState('');
  const [goods, setGoods] = useState('');
  const [brand, setBrand] = useState('');
  const [mdfThickness, setMdfThickness] = useState('');
  const [unloadDate, setUnloadDate] = useState<JalaliDate>(todayJ());
  const [trailers, setTrailers] = useState('5');
  const [pallets, setPallets] = useState('40');
  const [batchId, setBatchId] = useState('');
  const [entryDocId, setEntryDocId] = useState('');

  // Partial / Percentage Exit States (default: OFF = 100% complete exit)
  const [isPartialExit, setIsPartialExit] = useState(false);
  const [totalPallets, setTotalPallets] = useState('40');
  const [exitPercent, setExitPercent] = useState('90');
  const [exitPallets, setExitPallets] = useState('36');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const finalizedBatches = batches.filter((b) => b.finalized);
  const pendingBatches = batches.filter((b) => !b.finalized);
  // Strictly exclude EntryDocs that are already consolidated into any batch
  const standaloneDocs = filterStandaloneEntryDocs(allDocs, batches, editingDoc?.entryDocId);

  const getBatchMetrics = (b: Batch) => {
    const memberDocs = allDocs.filter((d) => b.docIds.includes(d.id));
    const sumPallets = memberDocs.reduce((acc, d) => acc + Math.max(0, Math.floor(d.pallets || 0)), 0);
    const sumTrailers = memberDocs.reduce((acc, d) => acc + Math.max(0, Math.floor(d.trailers || 0)), 0);
    return { memberDocs, sumPallets, sumTrailers };
  };

  useEffect(() => {
    if (editingDoc) {
      setCottage(editingDoc.cottage);
      setBl(editingDoc.bl);
      setFile(editingDoc.file);
      setImporter(editingDoc.importer);
      setCarrier(editingDoc.carrier);
      setGoods(editingDoc.goods);
      setBrand(editingDoc.brand || '');
      setMdfThickness(editingDoc.mdfThickness || inferMdfThickness(editingDoc.goods || ''));
      setUnloadDate(editingDoc.unloadDate);
      setTrailers(String(editingDoc.trailers));
      setPallets(String(editingDoc.pallets || '0'));
      setBatchId(editingDoc.batchId || '');
      setEntryDocId(editingDoc.entryDocId || '');

      if (editingDoc.partialExit?.isPartial) {
        setIsPartialExit(true);
        const tot = Math.max(0, Math.floor(editingDoc.partialExit.totalPallets || editingDoc.pallets || 0));
        const pct = editingDoc.partialExit.exitPercent || 90;
        const exP = Math.max(0, Math.floor(editingDoc.partialExit.exitPallets ?? editingDoc.pallets ?? 0));
        setTotalPallets(String(tot));
        setExitPercent(String(pct));
        setExitPallets(String(exP));
      } else {
        setIsPartialExit(false);
        const totVal = Math.max(0, Math.floor(editingDoc.pallets || 0));
        setTotalPallets(String(totVal));
        setExitPercent('90');
        setExitPallets(String(calculatePartialExitByPercent(totVal, 90).exitPallets));
      }
      setErrors({});
    } else {
      setCottage('');
      setBl('');
      setFile('');
      setImporter('');
      setCarrier('');
      setGoods('');
      setBrand('');
      setMdfThickness('');
      setUnloadDate(todayJ());
      setTrailers('5');
      setPallets('40');
      setBatchId('');
      setEntryDocId('');
      setIsPartialExit(false);
      setTotalPallets('40');
      setExitPercent('90');
      setExitPallets('36');
      setErrors({});
    }
  }, [editingDoc]);

  const applyPalletsFromSource = (totP: number) => {
    const cleanTot = Math.max(0, Math.floor(totP));
    setTotalPallets(String(cleanTot));
    const parsedPct = parseFloat(en(exitPercent));
    const safePct = parsedPct > 0 && parsedPct < 100 ? parsedPct : 90;
    const calc = calculatePartialExitByPercent(cleanTot, safePct);
    setExitPallets(String(calc.exitPallets));
    // Default (OFF) = 100% complete exit; ON = floored partial exit
    setPallets(String(isPartialExit ? calc.exitPallets : cleanTot));
  };

  // Unified top selector: Consolidated Batch OR non-consolidated standalone File
  // Never overwrites manual Exit Kootazh (cottage) or Exit B/L (bl)
  const sourceSelectValue = batchId ? `batch:${batchId}` : entryDocId ? `doc:${entryDocId}` : '';

  const handleSourceSelect = (val: string) => {
    setErrors((prev) => {
      if (!prev.batchId) return prev;
      const next = { ...prev };
      delete next.batchId;
      return next;
    });

    if (!val) {
      setBatchId('');
      setEntryDocId('');
      return;
    }

    if (val.startsWith('batch:')) {
      const bId = val.slice('batch:'.length);
      setBatchId(bId);
      setEntryDocId('');

      const selectedBatch = batches.find((b) => String(b.id) === bId);
      if (!selectedBatch) return;

      const { memberDocs, sumPallets, sumTrailers } = getBatchMetrics(selectedBatch);
      const batchFile = normalizeFileNumber(selectedBatch.file || memberDocs[0]?.file);
      if (batchFile) setFile(batchFile);

      const distinctGoods = Array.from(
        new Set(memberDocs.map((d) => (d.goods || '').trim()).filter(Boolean))
      ).join(' / ');
      const resolvedGoods = selectedBatch.goods || distinctGoods;
      if (resolvedGoods) setGoods(resolvedGoods);

      const firstImporter = memberDocs.find((d) => d.importer)?.importer;
      if (firstImporter) setImporter(firstImporter);

      const firstCarrier = memberDocs.find((d) => d.carrier)?.carrier;
      if (firstCarrier) setCarrier(firstCarrier);

      const distinctBrands = Array.from(
        new Set(memberDocs.map((d) => (d.brand || '').trim()).filter(Boolean))
      ).join(' / ');
      if (distinctBrands) setBrand(distinctBrands);

      const firstThickness =
        memberDocs.find((d) => d.mdfThickness)?.mdfThickness || inferMdfThickness(resolvedGoods);
      if (firstThickness) setMdfThickness(firstThickness);

      if (sumTrailers > 0) setTrailers(String(sumTrailers));
      applyPalletsFromSource(sumPallets);
      return;
    }

    if (val.startsWith('doc:')) {
      const docId = val.slice('doc:'.length);
      setEntryDocId(docId);
      setBatchId('');

      const matched = allDocs.find((d) => d.id === docId);
      if (!matched) return;

      if (matched.file) setFile(normalizeFileNumber(matched.file));
      if (matched.importer) setImporter(matched.importer);
      if (matched.carrier) setCarrier(matched.carrier);
      if (matched.goods) setGoods(matched.goods);
      if (matched.brand) setBrand(matched.brand);
      const thick = matched.mdfThickness || inferMdfThickness(matched.goods);
      if (thick) setMdfThickness(thick);
      if (matched.trailers > 0) setTrailers(String(matched.trailers));

      applyPalletsFromSource(matched.pallets || 0);
    }
  };

  // Sync full 100% pallets input with totalPallets when partial exit is OFF
  const handleFullPalletsChange = (val: string) => {
    setPallets(val);
    const cleanTot = Math.max(0, Math.floor(parseFloat(en(val)) || 0));
    setTotalPallets(String(cleanTot));
    const parsedPct = parseFloat(en(exitPercent));
    const safePct = parsedPct > 0 && parsedPct < 100 ? parsedPct : 90;
    setExitPallets(String(calculatePartialExitByPercent(cleanTot, safePct).exitPallets));
  };

  // Sync Percentage and Pallets (exact floor-rounded whole numbers)
  const handleTotalPalletsChange = (val: string) => {
    setTotalPallets(val);
    const tot = Math.max(0, Math.floor(parseFloat(en(val)) || 0));
    const pct = Math.min(100, Math.max(0, parseFloat(en(exitPercent)) || 0));
    const calc = calculatePartialExitByPercent(tot, pct);
    setExitPallets(String(calc.exitPallets));
    setPallets(String(calc.exitPallets));
  };

  const handleExitPercentChange = (val: string) => {
    setExitPercent(val);
    const pct = Math.min(100, Math.max(0, parseFloat(en(val)) || 0));
    const tot = Math.max(0, Math.floor(parseFloat(en(totalPallets)) || 0));
    const calc = calculatePartialExitByPercent(tot, pct);
    setExitPallets(String(calc.exitPallets));
    setPallets(String(calc.exitPallets));
  };

  const handleExitPalletsChange = (val: string) => {
    const tot = Math.max(0, Math.floor(parseFloat(en(totalPallets)) || 0));
    if (val === '') {
      setExitPallets('');
      setPallets('');
      setExitPercent('0');
      return;
    }
    const rawExP = Math.max(0, Math.floor(parseFloat(en(val)) || 0));
    const clampedExP = tot > 0 ? Math.min(tot, rawExP) : rawExP;
    setExitPallets(String(clampedExP));
    setPallets(String(clampedExP));
    if (tot > 0) {
      const calculatedPct = Math.min(100, Math.max(0, Math.round((clampedExP / tot) * 1000) / 10));
      setExitPercent(String(calculatedPct));
    }
  };

  const handleApplyPreset = (pct: number) => {
    const tot = Math.max(0, Math.floor(parseFloat(en(totalPallets)) || 0));
    const calc = calculatePartialExitByPercent(tot, pct);
    setExitPercent(String(calc.exitPercent));
    setExitPallets(String(calc.exitPallets));
    setPallets(String(calc.exitPallets));
  };

  // Toggle Partial Exit (OFF = 100% complete exit, ON = floored percentage partial exit)
  const handleTogglePartialExit = () => {
    const nextState = !isPartialExit;
    setIsPartialExit(nextState);
    if (nextState) {
      const currentFull = Math.max(0, Math.floor(parseFloat(en(pallets)) || 0));
      const fallbackTot = Math.max(0, Math.floor(parseFloat(en(totalPallets)) || 0));
      const tot = currentFull > 0 ? currentFull : fallbackTot;
      const parsedPct = parseFloat(en(exitPercent));
      const pct = parsedPct > 0 && parsedPct < 100 ? parsedPct : 90;
      const calc = calculatePartialExitByPercent(tot, pct);
      setTotalPallets(String(tot));
      setExitPercent(String(calc.exitPercent));
      setExitPallets(String(calc.exitPallets));
      setPallets(String(calc.exitPallets));
    } else {
      // Restore pallets back to 100% (totalPallets)
      const tot = Math.max(0, Math.floor(parseFloat(en(totalPallets)) || 0));
      setPallets(String(tot));
      setErrors((prev) => {
        if (!prev.partialExit) return prev;
        const next = { ...prev };
        delete next.partialExit;
        return next;
      });
    }
  };

  // Calculated values for comparison preview
  const numTotalPallets = Math.max(0, parseInt(en(totalPallets), 10) || 0);
  const numExitPallets = Math.min(numTotalPallets, Math.max(0, parseInt(en(exitPallets), 10) || 0));
  const numExitPercent = Math.min(100, Math.max(0, Math.round((parseFloat(en(exitPercent)) || 0) * 10) / 10));
  const numRemPercent = Math.max(0, Math.round((100 - numExitPercent) * 10) / 10);
  const numRemPallets = Math.max(0, numTotalPallets - numExitPallets);

  const validate = () => {
    const errs: Record<string, string> = {};
    const cot = en(cottage.trim());
    const blVal = bl.trim().toUpperCase();
    const fileVal = en(file.trim());

    if (!/^\d{7}$/.test(cot)) {
      errs.cottage = 'شماره کوتاژ خروج باید ۷ رقم باشد';
    } else if (existingExits.some((x) => x.cottage === cot && x.id !== editingDoc?.id)) {
      errs.cottage = 'این کوتاژ خروج قبلاً ثبت شده است';
    }

    if (!/^SEETEC\d{5}$/.test(blVal)) {
      errs.bl = 'بارنامه باید SEETEC + ۵ رقم باشد';
    } else if (existingExits.some((x) => x.bl === blVal && x.id !== editingDoc?.id)) {
      errs.bl = 'این بارنامه خروج قبلاً ثبت شده است';
    }

    if (!/^\d{6}$/.test(fileVal)) {
      errs.file = 'شماره پرونده باید ۶ رقم باشد';
    }

    if (!importer) errs.importer = 'شرکت واردکننده را انتخاب کنید';
    if (!carrier) errs.carrier = 'شرکت حمل‌ونقل را انتخاب کنید';
    if (!goods) errs.goods = 'نوع کالا را انتخاب کنید';
    if (!batchId && !entryDocId) errs.batchId = 'تجمیع یا پرونده مرجع را انتخاب کنید';

    const trNum = parseInt(en(trailers), 10);
    if (isNaN(trNum) || trNum < 1) {
      errs.trailers = 'تعداد تریلی حداقل ۱ باشد';
    }

    if (isPartialExit) {
      if (numTotalPallets < 1) {
        errs.partialExit = 'مجموع کل پالت‌ها برای خروج درصدی باید حداقل ۱ باشد';
      } else if (numExitPercent <= 0 || numExitPercent >= 100) {
        errs.partialExit = 'درصد خروج در حالت پارت‌بندی باید بین ۱ تا ۹۹ درصد باشد (برای خروج کامل ۱۰۰٪ گزینه درصدی را خاموش کنید)';
      } else if (numExitPallets < 0 || numExitPallets > numTotalPallets) {
        errs.partialExit = 'تعداد پالت خروجی نمی‌تواند بیشتر از مجموع کل پالت‌ها باشد';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const actualPallets = isPartialExit ? numExitPallets : (parseInt(en(pallets), 10) || 0);

    onSubmit({
      cottage: en(cottage.trim()),
      bl: bl.trim().toUpperCase(),
      file: en(file.trim()),
      importer,
      carrier,
      goods,
      brand,
      mdfThickness: mdfThickness.trim() || inferMdfThickness(goods),
      unloadDate,
      trailers: parseInt(en(trailers), 10) || 1,
      pallets: actualPallets,
      batchId: batchId || null,
      entryDocId: entryDocId || undefined,
      partialExit: isPartialExit
        ? {
            isPartial: true,
            exitPercent: numExitPercent,
            exitPallets: numExitPallets,
            remainingPercent: numRemPercent,
            remainingPallets: numRemPallets,
            totalPallets: numTotalPallets,
          }
        : undefined,
    });

    // Reset form inputs after submit
    setCottage('');
    setBl('');
    setFile('');
    setImporter('');
    setCarrier('');
    setGoods('');
    setBrand('');
    setMdfThickness('');
    setUnloadDate(todayJ());
    setTrailers('5');
    setPallets('40');
    setBatchId('');
    setEntryDocId('');
    setIsPartialExit(false);
    setTotalPallets('40');
    setExitPercent('90');
    setExitPallets('36');
    setErrors({});
  };

  return (
    <aside className="ios-glass-card ios-specular p-4 sm:p-6 rounded-3xl border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] lg:sticky lg:top-20">
      <div className="flex items-center gap-3 pb-4 mb-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/25 to-blue-500/15 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/15">
          <LogOut className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-lalezar text-xl text-slate-100 font-normal tracking-wide">
            {editingDoc ? 'ویرایش کوتاژ خروجی' : 'ثبت کوتاژ خروجی جدید'}
          </h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Unified Reference Picker: Consolidated Batch OR non-consolidated standalone File */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            انتخاب تجمیع یا پرونده مرجع <span className="text-amber-400">*</span>
          </label>
          <select
            value={sourceSelectValue}
            onChange={(e) => handleSourceSelect(e.target.value)}
            className={`w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none ${
              errors.batchId ? 'border-rose-500' : ''
            }`}
          >
            <option value="" className="bg-[#0c0e14] text-slate-300">
              — انتخاب تجمیع یا پرونده مرجع —
            </option>

            {finalizedBatches.length > 0 && (
              <optgroup label="تجمیع‌های نهایی‌شده (بر اساس شماره پرونده)" className="bg-[#0c0e14] text-cyan-300">
                {finalizedBatches.map((b) => {
                  const { memberDocs, sumPallets } = getBatchMetrics(b);
                  return (
                    <option key={`batch:${b.id}`} value={`batch:${b.id}`} className="bg-[#0c0e14] text-slate-100">
                      تجمیع {b.id} — پرونده {fa(b.file)} ({fa(memberDocs.length)} کوتاژ · {fa(sumPallets)} پالت)
                    </option>
                  );
                })}
              </optgroup>
            )}

            {pendingBatches.length > 0 && (
              <optgroup label="تجمیع‌های ثبت‌شده (در انتظار نهایی)" className="bg-[#0c0e14] text-amber-300">
                {pendingBatches.map((b) => {
                  const { memberDocs, sumPallets } = getBatchMetrics(b);
                  return (
                    <option key={`batch:${b.id}`} value={`batch:${b.id}`} className="bg-[#0c0e14] text-slate-200">
                      تجمیع {b.id} — پرونده {fa(b.file)} ({fa(memberDocs.length)} کوتاژ · {fa(sumPallets)} پالت)
                    </option>
                  );
                })}
              </optgroup>
            )}

            {standaloneDocs.length > 0 && (
              <optgroup label="پرونده‌های تکی (تجمیع‌نشده)" className="bg-[#0c0e14] text-emerald-300">
                {standaloneDocs.map((d) => (
                  <option key={`doc:${d.id}`} value={`doc:${d.id}`} className="bg-[#0c0e14] text-slate-200">
                    پرونده {fa(d.file)} — کوتاژ {fa(d.cottage)} ({d.goods} · {fa(d.pallets || 0)} پالت)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {errors.batchId && <p className="text-[10px] text-rose-400">{errors.batchId}</p>}
        </div>

        {/* Row 1: Cottage & BL */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              شماره کوتاژ خروج <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={7}
              value={cottage}
              onChange={(e) => setCottage(e.target.value)}
              placeholder="1402234"
              className={`w-full glass-input rounded-xl px-3 py-2.5 text-sm ltr text-left outline-none ${
                errors.cottage ? 'border-rose-500' : ''
              }`}
            />
            {errors.cottage && <p className="text-[10px] text-rose-400">{errors.cottage}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              شماره بارنامه خروج <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              maxLength={11}
              value={bl}
              onChange={(e) => setBl(e.target.value.toUpperCase())}
              placeholder="SEETEC05022"
              className={`w-full glass-input rounded-xl px-3 py-2.5 text-sm ltr text-left outline-none uppercase ${
                errors.bl ? 'border-rose-500' : ''
              }`}
            />
            {errors.bl && <p className="text-[10px] text-rose-400">{errors.bl}</p>}
          </div>
        </div>

        {/* Row 2: File & Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              شماره پرونده <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={file}
              onChange={(e) => setFile(e.target.value)}
              placeholder="405101"
              className={`w-full glass-input rounded-xl px-3 py-2.5 text-sm ltr text-left outline-none ${
                errors.file ? 'border-rose-500' : ''
              }`}
            />
            {errors.file && <p className="text-[10px] text-rose-400">{errors.file}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              تاریخ خروج <span className="text-amber-400">*</span>
            </label>
            <JalaliDatePicker value={unloadDate} onChange={setUnloadDate} />
          </div>
        </div>

        {/* Comboboxes */}
        <ComboboxField
          label="شرکت واردکننده"
          required
          value={importer}
          onChange={setImporter}
          options={importers}
          onAddNew={onAddImporter}
          onDeleteOption={onDeleteImporter}
          placeholder="— انتخاب واردکننده —"
          error={errors.importer}
        />

        <ComboboxField
          label="شرکت حمل‌ونقل"
          required
          value={carrier}
          onChange={setCarrier}
          options={carriers}
          onAddNew={onAddCarrier}
          onDeleteOption={onDeleteCarrier}
          placeholder="— انتخاب شرکت حمل —"
          error={errors.carrier}
        />

        <ComboboxField
          label="نوع کالا"
          required
          value={goods}
          onChange={setGoods}
          options={goodsList}
          onAddNew={onAddGoods}
          onDeleteOption={onDeleteGoods}
          placeholder="— انتخاب نوع کالا —"
          error={errors.goods}
        />

        <ComboboxField
          label="برند کالا"
          value={brand}
          onChange={setBrand}
          options={brands}
          onAddNew={onAddBrand}
          onDeleteOption={onDeleteBrand}
          placeholder="— انتخاب برند کالا —"
        />

        {/* Row 3: Trailers & Pallets */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              تعداد تریلی <span className="text-amber-400">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={trailers}
              onChange={(e) => setTrailers(e.target.value)}
              placeholder="مثلاً 5"
              className="w-full glass-input rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </div>

          {!isPartialExit && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">تعداد پالت (۱۰۰٪ خروج کامل)</label>
              <input
                type="number"
                min={0}
                value={pallets}
                onChange={(e) => handleFullPalletsChange(e.target.value)}
                placeholder="مثلاً 40"
                className="w-full glass-input rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>
          )}
        </div>

        {/* MDF Thickness (Exit Phase Only) */}
        <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="block text-xs font-medium text-slate-300">ضخامت MDF (میلی‌متر)</label>
            <div className="flex items-center gap-1 flex-wrap">
              {['16mm', '18mm', '8mm', '3mm'].map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => setMdfThickness(th)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                    mdfThickness === th
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {th}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={mdfThickness}
            onChange={(e) => setMdfThickness(e.target.value)}
            placeholder="مثلاً 16mm یا 18mm (در صورت خالی بودن از کالا استنتاج می‌شود)"
            className="w-full glass-input rounded-xl px-3 py-2 text-xs ltr text-left outline-none font-mono min-h-[40px]"
          />
        </div>

        {/* ========================================================================= */}
        {/* OPTION: PERCENTAGE EXIT (خروج به صورت درصدی مثلاً ۹۰٪ و ۱۰٪ مانده)          */}
        {/* ========================================================================= */}
        <div className={`rounded-2xl border transition-all duration-200 p-3.5 space-y-3 ${
          isPartialExit
            ? 'border-amber-400/60 bg-gradient-to-b from-amber-500/15 via-orange-500/10 to-transparent shadow-lg shadow-amber-500/5'
            : 'border-white/10 bg-white/5 hover:border-white/20'
        }`}>
          {/* Header Toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
                isPartialExit
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-sm shadow-amber-500/20'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}>
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <label
                  onClick={handleTogglePartialExit}
                  className="text-xs font-bold text-white cursor-pointer flex items-center gap-1.5 flex-wrap select-none"
                >
                  <span>خروج به صورت درصدی (پارت‌بندی بار)</span>
                  {isPartialExit ? (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.2 rounded font-bold">
                      فعال
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 px-1.5 py-0.2 rounded font-bold">
                      خروج کامل ۱۰۰٪
                    </span>
                  )}
                </label>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  {isPartialExit
                    ? 'محاسبه دقیق عدد صحیح با گرد کردن به پایین (مثلاً ۹۰٪ از ۱۰۱ پالت = ۹۰ پالت خروجی)'
                    : 'حالت پیش‌فرض خروج کامل ۱۰۰٪ است؛ در صورت خروج درصدی (مثلاً ۹۰٪) این گزینه را فعال کنید'}
                </p>
              </div>
            </div>

            {/* Switch button */}
            <button
              type="button"
              onClick={handleTogglePartialExit}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                isPartialExit ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isPartialExit ? '-translate-x-6' : '-translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Expanded Percentage Inputs & Live Breakdown */}
          {isPartialExit && (
            <div className="pt-3 border-t border-amber-500/20 space-y-3 animate-in fade-in slide-in-from-top-1">
              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  الگوهای سریع:
                </span>
                {[
                  { label: '۹۰٪ خروج / ۱۰٪ مانده', pct: 90 },
                  { label: '۸۰٪ خروج / ۲۰٪ مانده', pct: 80 },
                  { label: '۷۵٪ خروج / ۲۵٪ مانده', pct: 75 },
                  { label: '۵۰٪ خروج / ۵۰٪ مانده', pct: 50 },
                ].map((item) => (
                  <button
                    key={item.pct}
                    type="button"
                    onClick={() => handleApplyPreset(item.pct)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      parseFloat(exitPercent) === item.pct
                        ? 'bg-amber-500/30 text-amber-200 border-amber-400 shadow-sm'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {/* 1. Total Pallets */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-slate-300">
                    مجموع کل پالت‌ها
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalPallets}
                    onChange={(e) => handleTotalPalletsChange(e.target.value)}
                    className="w-full glass-input rounded-xl px-2.5 py-2 text-xs text-center font-mono font-bold text-white outline-none"
                    placeholder="100"
                  />
                </div>

                {/* 2. Exit Percent */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-slate-300">
                    درصد خروج (این پارت)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={exitPercent}
                      onChange={(e) => handleExitPercentChange(e.target.value)}
                      className="w-full glass-input rounded-xl px-2.5 py-2 text-xs text-center font-mono font-black text-amber-300 outline-none"
                      placeholder="90"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-400/80 pointer-events-none font-bold">
                      ٪
                    </span>
                  </div>
                </div>

                {/* 3. Exit Pallets */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-slate-300">
                    تعداد پالت خروجی
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={exitPallets}
                    onChange={(e) => handleExitPalletsChange(e.target.value)}
                    className="w-full glass-input rounded-xl px-2.5 py-2 text-xs text-center font-mono font-black text-emerald-300 outline-none"
                    placeholder="90"
                  />
                </div>
              </div>

              {/* Visual Breakdown Cards & Bar */}
              <div className="bg-slate-950/80 rounded-xl p-3 border border-white/10 space-y-2.5">
                {/* Dual Color Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-emerald-400 font-bold">خارج‌شده: {fa(numExitPercent)}٪</span>
                    <span className="text-amber-400 font-bold">باقی‌مانده: {fa(numRemPercent)}٪</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, numExitPercent))}%` }}
                      title={`خارج‌شده: ${fa(numExitPercent)}٪ (${fa(numExitPallets)} پالت)`}
                    />
                    <div
                      className="bg-gradient-to-r from-amber-500 to-orange-400 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, numRemPercent))}%` }}
                      title={`باقی‌مانده در انبار: ${fa(numRemPercent)}٪ (${fa(numRemPallets)} پالت)`}
                    />
                  </div>
                </div>

                {/* 2-Col Box */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                  <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-emerald-400 block font-medium">پارت خروجی (این کوتاژ)</span>
                    <div className="flex items-baseline justify-center gap-1 my-0.5">
                      <span className="text-base font-black text-emerald-300 font-mono">{fa(numExitPallets)}</span>
                      <span className="text-[10px] text-emerald-400/90">پالت</span>
                    </div>
                    <span className="text-[10px] text-emerald-300/80 bg-emerald-500/20 px-1.5 py-0.2 rounded font-mono font-bold inline-block">
                      {fa(numExitPercent)}٪ کل بار
                    </span>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-amber-400 block font-medium">باقی‌مانده در انبار گمرک</span>
                    <div className="flex items-baseline justify-center gap-1 my-0.5">
                      <span className="text-base font-black text-amber-300 font-mono">{fa(numRemPallets)}</span>
                      <span className="text-[10px] text-amber-400/90">پالت</span>
                    </div>
                    <span className="text-[10px] text-amber-300/80 bg-amber-500/20 px-1.5 py-0.2 rounded font-mono font-bold inline-block">
                      {fa(numRemPercent)}٪ کل بار
                    </span>
                  </div>
                </div>
              </div>

              {errors.partialExit && (
                <p className="text-[11px] text-rose-400 font-semibold">{errors.partialExit}</p>
              )}
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl ios-glass-btn-cyan flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Save className="w-4 h-4" />
            <span>{editingDoc ? 'بروزرسانی کوتاژ خروجی' : 'ثبت کوتاژ خروجی'}</span>
          </button>

          {editingDoc && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="w-full py-2.5 px-4 rounded-xl ios-glass-btn text-slate-300 hover:text-white transition-all text-xs font-semibold cursor-pointer"
            >
              انصراف از ویرایش
            </button>
          )}
        </div>
      </form>
    </aside>
  );
};
