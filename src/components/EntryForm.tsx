import React, { useState, useEffect } from 'react';
import { HelpCircle, FilePlus, Save, TestTube } from 'lucide-react';
import { EntryDoc, JalaliDate } from '../types';
import { JalaliDatePicker } from './JalaliDatePicker';
import { ComboboxField } from './ComboboxField';
import { en, parseJ, todayJ, fa } from '../utils/jalali';
import { calculateSplit9010, inferMdfThickness } from '../utils/clearance9010';

interface EntryFormProps {
  editingDoc: EntryDoc | null;
  onSubmit: (data: Omit<EntryDoc, 'id' | 'createdAt' | 'unloaded' | 'invoicePaid' | 'receipt' | 'tasks'>) => void;
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
  existingDocs: EntryDoc[];
}

export const EntryForm: React.FC<EntryFormProps> = ({
  editingDoc,
  onSubmit,
  onCancelEdit,
  onSeedDemo,
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
  existingDocs,
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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeHint, setActiveHint] = useState<string | null>(null);

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
      setErrors({});
    }
  }, [editingDoc]);

  const validate = () => {
    const errs: Record<string, string> = {};
    const cot = en(cottage.trim());
    const blVal = bl.trim().toUpperCase();
    const fileVal = en(file.trim());

    if (!/^\d{7}$/.test(cot)) {
      errs.cottage = 'شماره کوتاژ باید دقیقاً ۷ رقم عددی باشد';
    } else if (existingDocs.some((d) => d.cottage === cot && d.id !== editingDoc?.id)) {
      errs.cottage = 'این شماره کوتاژ قبلاً ثبت شده است';
    }

    if (!/^SEETEC\d{5}$/.test(blVal)) {
      errs.bl = 'بارنامه باید SEETEC + ۵ رقم باشد (مانند SEETEC05022)';
    } else if (existingDocs.some((d) => d.bl === blVal && d.id !== editingDoc?.id)) {
      errs.bl = 'این شماره بارنامه قبلاً ثبت شده است';
    }

    if (!/^\d{6}$/.test(fileVal)) {
      errs.file = 'شماره پرونده باید دقیقاً ۶ رقم باشد';
    }

    if (!importer) errs.importer = 'شرکت واردکننده را انتخاب کنید';
    if (!carrier) errs.carrier = 'شرکت حمل‌ونقل را انتخاب کنید';
    if (!goods) errs.goods = 'نوع کالا را انتخاب کنید';

    const trNum = parseInt(en(trailers), 10);
    if (isNaN(trNum) || trNum < 1) {
      errs.trailers = 'تعداد تریلی حداقل ۱ باشد';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const totalPalletsInt = Math.max(0, Math.floor(Number(en(pallets)) || 0));

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
      pallets: totalPalletsInt,
    });

    // Reset form inputs after submitting
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
    setErrors({});
  };

  const previewSplit = calculateSplit9010(Math.max(0, Math.floor(Number(en(pallets)) || 0)));

  return (
    <aside className="ios-glass-card ios-specular p-5 sm:p-6 rounded-3xl border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] sticky top-24 backdrop-blur-3xl">
      <div className="flex items-center gap-3 pb-4 mb-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/25 to-orange-500/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/15 backdrop-blur-xl">
          <FilePlus className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-lalezar text-xl text-slate-100 font-normal tracking-wide">
            {editingDoc ? 'ویرایش سند ورود کالا' : 'ثبت سند ورود کالا'}
          </h3>
          <p className="text-[11px] text-slate-400">
            کوتاژ و بارنامه از طریق شماره پرونده متصل می‌شوند
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Cottage & BL */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1">
              شماره کوتاژ <span className="text-amber-400">*</span>
              <button
                type="button"
                onClick={() => setActiveHint(activeHint === 'cottage' ? null : 'cottage')}
                className="text-cyan-400 border border-dashed border-cyan-400/50 rounded-full text-[10px] px-1 hover:bg-cyan-400/10"
              >
                ؟
              </button>
            </label>
            {activeHint === 'cottage' && (
              <p className="text-[10px] text-cyan-200 bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-400/30 backdrop-blur-md">
                شناسه ۷ رقمی عددی و یکتا برای اظهارنامه گمرکی
              </p>
            )}
            <input
              type="text"
              inputMode="numeric"
              maxLength={7}
              value={cottage}
              onChange={(e) => setCottage(e.target.value)}
              placeholder="1402234"
              className={`w-full glass-input rounded-xl px-3 py-2.5 text-sm ltr text-left outline-none ${
                errors.cottage ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
              }`}
            />
            {errors.cottage && <p className="text-[10px] text-rose-400 font-medium">{errors.cottage}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1">
              شماره بارنامه <span className="text-amber-400">*</span>
              <button
                type="button"
                onClick={() => setActiveHint(activeHint === 'bl' ? null : 'bl')}
                className="text-cyan-400 border border-dashed border-cyan-400/50 rounded-full text-[10px] px-1 hover:bg-cyan-400/10"
              >
                ؟
              </button>
            </label>
            {activeHint === 'bl' && (
              <p className="text-[10px] text-cyan-200 bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-400/30 backdrop-blur-md">
                با SEETEC شروع می‌شود و با ۵ رقم تمام می‌شود
              </p>
            )}
            <input
              type="text"
              maxLength={11}
              value={bl}
              onChange={(e) => setBl(e.target.value.toUpperCase())}
              placeholder="SEETEC05022"
              className={`w-full glass-input rounded-xl px-3 py-2.5 text-sm ltr text-left outline-none uppercase font-mono ${
                errors.bl ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
              }`}
            />
            {errors.bl && <p className="text-[10px] text-rose-400 font-medium">{errors.bl}</p>}
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
                errors.file ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
              }`}
            />
            {errors.file && <p className="text-[10px] text-rose-400 font-medium">{errors.file}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              تاریخ تخلیه <span className="text-amber-400">*</span>
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
              className={`w-full glass-input rounded-xl px-3 py-2.5 text-sm outline-none ${
                errors.trailers ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
              }`}
            />
            {errors.trailers && <p className="text-[10px] text-rose-400 font-medium">{errors.trailers}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">تعداد کل پالت (عدد صحیح)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={pallets}
              onChange={(e) => setPallets(e.target.value.replace(/[^\d۰-۹]/g, ''))}
              placeholder="مثلاً 101"
              className="w-full glass-input rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
            />
          </div>
        </div>

        {/* MDF Thickness & Live 90/10 Allocation Preview */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-300">
                ضخامت MDF (میلی‌متر)
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {['16mm', '18mm', '8mm', '3mm'].map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => setMdfThickness(th)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
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
              placeholder="مثلاً 16mm یا 18mm (در صورت خالی بودن از نام کالا تشخیص داده می‌شود)"
              className="w-full glass-input rounded-xl px-3 py-2 text-xs ltr text-left outline-none font-mono"
            />
          </div>

          {/* 90/10 Integer Allocation Preview */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">محاسبه خودکار سهمیه ۹۰٪ / ۱۰٪ (عدد صحیح):</span>
              <span className="font-mono font-bold text-slate-200">{fa(previewSplit.totalPallets)} پالت</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2">
                <span className="text-[10px] text-emerald-300 block">مرحله اول (۹۰٪)</span>
                <b className="font-mono text-sm text-emerald-200">{fa(previewSplit.firstStagePallets)} پالت</b>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-2">
                <span className="text-[10px] text-amber-300 block">باقی‌مانده ۱۰٪ (قفل ساتا)</span>
                <b className="font-mono text-sm text-amber-200">{fa(previewSplit.remainingPallets)} پالت</b>
              </div>
            </div>
          </div>
        </div>

        {/* Submit / Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl ios-glass-btn-primary flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Save className="w-4 h-4" />
            <span>{editingDoc ? 'بروزرسانی سند ورود' : 'ذخیره سند ورود'}</span>
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
