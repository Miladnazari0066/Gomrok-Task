import React, { useState, useMemo } from 'react';
import {
  X,
  Package,
  Truck,
  Layers,
  Search,
  PieChart,
  Building2,
  Tag,
  FileText,
  Boxes,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { EntryDoc, ExitDoc, Batch } from '../types';
import { fa } from '../utils/jalali';

interface CommoditySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  docs: EntryDoc[];
  exits: ExitDoc[];
  batches: Batch[];
}

type GroupByMode = 'goods_brand' | 'importer' | 'file';

interface CommodityGroupItem {
  id: string;
  goods: string;
  brand: string;
  importer: string;
  files: string[];
  entryDocsCount: number;
  entryCottages: string[];
  totalTrailers: number;
  unloadedTrailers: number;
  totalPallets: number;
  exitDocsCount: number;
  exitCottages: string[];
  gateExitedCount: number;
}

export const CommoditySummaryModal: React.FC<CommoditySummaryModalProps> = ({
  isOpen,
  onClose,
  docs,
  exits,
  batches,
}) => {
  const [groupBy, setGroupBy] = useState<GroupByMode>('goods_brand');
  const [searchQuery, setSearchQuery] = useState('');

  // Grouping Logic
  const groupedData = useMemo(() => {
    const map = new Map<string, CommodityGroupItem>();

    // 1. Process Entry Docs
    (docs || []).forEach((doc) => {
      const gKey =
        groupBy === 'goods_brand'
          ? `${doc.goods || 'نامشخص'}|||${doc.brand || 'نامشخص'}|||${doc.importer || 'نامشخص'}`
          : groupBy === 'importer'
          ? `${doc.importer || 'نامشخص'}`
          : `${doc.file || 'بدون پرونده'}`;

      if (!map.has(gKey)) {
        map.set(gKey, {
          id: gKey,
          goods: doc.goods || 'نامشخص',
          brand: doc.brand || 'نامشخص',
          importer: doc.importer || 'نامشخص',
          files: doc.file ? [doc.file.trim()] : [],
          entryDocsCount: 0,
          entryCottages: [],
          totalTrailers: 0,
          unloadedTrailers: 0,
          totalPallets: 0,
          exitDocsCount: 0,
          exitCottages: [],
          gateExitedCount: 0,
        });
      }

      const item = map.get(gKey)!;
      item.entryDocsCount += 1;
      if (doc.cottage && !item.entryCottages.includes(doc.cottage)) {
        item.entryCottages.push(doc.cottage);
      }
      if (doc.file && !item.files.includes(doc.file.trim())) {
        item.files.push(doc.file.trim());
      }
      item.totalTrailers += doc.trailers || 0;
      item.unloadedTrailers += doc.unloaded || 0;
      item.totalPallets += doc.pallets || 0;
    });

    // 2. Process Exit Docs
    (exits || []).forEach((exitDoc) => {
      const gKey =
        groupBy === 'goods_brand'
          ? `${exitDoc.goods || 'نامشخص'}|||${exitDoc.brand || 'نامشخص'}|||${exitDoc.importer || 'نامشخص'}`
          : groupBy === 'importer'
          ? `${exitDoc.importer || 'نامشخص'}`
          : `${exitDoc.file || 'بدون پرونده'}`;

      if (!map.has(gKey)) {
        map.set(gKey, {
          id: gKey,
          goods: exitDoc.goods || 'نامشخص',
          brand: exitDoc.brand || 'نامشخص',
          importer: exitDoc.importer || 'نامشخص',
          files: exitDoc.file ? [exitDoc.file.trim()] : [],
          entryDocsCount: 0,
          entryCottages: [],
          totalTrailers: 0,
          unloadedTrailers: 0,
          totalPallets: 0,
          exitDocsCount: 0,
          exitCottages: [],
          gateExitedCount: 0,
        });
      }

      const item = map.get(gKey)!;
      item.exitDocsCount += 1;
      if (exitDoc.cottage && !item.exitCottages.includes(exitDoc.cottage)) {
        item.exitCottages.push(exitDoc.cottage);
      }
      if (exitDoc.file && !item.files.includes(exitDoc.file.trim())) {
        item.files.push(exitDoc.file.trim());
      }
      if (exitDoc.gate?.done) {
        item.gateExitedCount += 1;
      }
    });

    return Array.from(map.values());
  }, [docs, exits, groupBy]);

  // Filter Search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return groupedData;
    const q = searchQuery.trim().toLowerCase();
    return groupedData.filter((item) => {
      const combined = [
        item.goods,
        item.brand,
        item.importer,
        ...item.files,
        ...item.entryCottages,
        ...item.exitCottages,
      ]
        .join(' ')
        .toLowerCase();
      return combined.includes(q);
    });
  }, [groupedData, searchQuery]);

  // Overall Totals
  const totalEntryDocs = (docs || []).length;
  const totalExitDocs = (exits || []).length;
  const totalPalletsOverall = (docs || []).reduce((a, d) => a + (d.pallets || 0), 0);
  const totalGroupsCount = groupedData.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl animate-in fade-in">
      <div className="ios-glass-modal rounded-3xl p-5 sm:p-7 max-w-4xl w-full max-h-[90vh] flex flex-col space-y-5 text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.9)] border border-white/20 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/25 to-blue-500/20 border border-cyan-400/40 text-cyan-300 shadow-lg shadow-cyan-500/15 backdrop-blur-xl">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-lalezar text-xl sm:text-2xl text-slate-100">
                آمار و خلاصه تفکیکی کالاها و اسناد
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تعداد اسناد و کوتاژها به صورت تفکیک‌شده بر اساس نوع کالا، برند و پرونده
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="ios-glass-card p-3 rounded-2xl border border-white/15 text-right">
            <div className="text-[11px] text-slate-400">تنوع گروه/کالاها</div>
            <div className="font-lalezar text-2xl text-cyan-300 mt-0.5">
              {fa(totalGroupsCount)} <span className="text-xs font-sans text-slate-400">گروه</span>
            </div>
          </div>

          <div className="ios-glass-card p-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 text-right">
            <div className="text-[11px] text-amber-300">کل اسناد ورودی</div>
            <div className="font-lalezar text-2xl text-amber-300 mt-0.5">
              {fa(totalEntryDocs)} <span className="text-xs font-sans text-amber-400/80">کوتاژ</span>
            </div>
          </div>

          <div className="ios-glass-card p-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-right">
            <div className="text-[11px] text-emerald-300">کل اسناد خروجی</div>
            <div className="font-lalezar text-2xl text-emerald-300 mt-0.5">
              {fa(totalExitDocs)} <span className="text-xs font-sans text-emerald-400/80">کوتاژ</span>
            </div>
          </div>

          <div className="ios-glass-card p-3 rounded-2xl border border-purple-400/30 bg-purple-500/10 text-right">
            <div className="text-[11px] text-purple-300">مجموع پالت‌ها</div>
            <div className="font-lalezar text-2xl text-purple-300 mt-0.5">
              {fa(totalPalletsOverall)} <span className="text-xs font-sans text-purple-400/80">پالت</span>
            </div>
          </div>
        </div>

        {/* Group By Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 pt-2 border-t border-white/10">
          {/* Tabs for Grouping */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-2xl border border-white/10 w-full sm:w-auto backdrop-blur-xl">
            <button
              onClick={() => setGroupBy('goods_brand')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                groupBy === 'goods_brand'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>نوع کالا و برند</span>
            </button>

            <button
              onClick={() => setGroupBy('importer')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                groupBy === 'importer'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>صاحب کالا</span>
            </button>

            <button
              onClick={() => setGroupBy('file')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                groupBy === 'file'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>شماره پرونده</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جست‌وجوی کالا، برند یا پرونده..."
              className="w-full glass-input rounded-xl py-2 pr-8 pl-3 text-xs outline-none"
            />
          </div>
        </div>

        {/* Scrollable Grouped Items */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 min-h-[300px]">
          {filteredData.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white/5 rounded-2xl border border-white/5">
              هیچ کالا یا سندی با این اطلاعات ثبت نشده است.
            </div>
          ) : (
            filteredData.map((item) => (
              <div
                key={item.id}
                className="ios-glass-card p-4.5 rounded-2xl border border-white/15 hover:border-cyan-400/50 transition-all space-y-3"
              >
                {/* Title & Badge */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      {groupBy === 'goods_brand' && (
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <span>{item.goods}</span>
                          <span className="text-xs text-amber-300 font-mono bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-400/30">
                            برند: {item.brand}
                          </span>
                        </h4>
                      )}
                      {groupBy === 'importer' && (
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <span>{item.importer}</span>
                        </h4>
                      )}
                      {groupBy === 'file' && (
                        <h4 className="text-sm font-bold text-cyan-300 font-mono flex items-center gap-2">
                          <span>پرونده شماره: {fa(item.goods === 'نامشخص' ? item.id : item.id)}</span>
                        </h4>
                      )}

                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        {groupBy !== 'importer' && (
                          <span>
                            صاحب کالا: <b className="text-slate-300">{item.importer}</b>
                          </span>
                        )}
                        {groupBy !== 'goods_brand' && (
                          <span>
                            کالا و برند: <b className="text-slate-300">{item.goods} ({item.brand})</b>
                          </span>
                        )}
                        {item.files.length > 0 && (
                          <span>
                            | شماره پرونده:{' '}
                            <b className="text-cyan-300 font-mono">
                              {item.files.map(fa).join(' ، ')}
                            </b>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/40">
                      ورودی: {fa(item.entryDocsCount)} کوتاژ
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                      خروجی: {fa(item.exitDocsCount)} کوتاژ
                    </span>
                  </div>
                </div>

                {/* Quantitative Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="text-[10px] text-slate-400">تعداد تریلی‌ها</div>
                    <div className="font-bold text-slate-200 mt-0.5 font-mono">
                      {fa(item.unloadedTrailers)} از {fa(item.totalTrailers)}
                    </div>
                  </div>

                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="text-[10px] text-slate-400">مجموع پالت‌ها</div>
                    <div className="font-bold text-amber-300 mt-0.5 font-mono">
                      {fa(item.totalPallets)}
                    </div>
                  </div>

                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="text-[10px] text-slate-400">کوتاژ ورودی</div>
                    <div className="font-bold text-cyan-300 mt-0.5 font-mono">
                      {item.entryCottages.length > 0
                        ? item.entryCottages.map(fa).join(' ، ')
                        : '-'}
                    </div>
                  </div>

                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="text-[10px] text-slate-400">کوتاژ خروجی</div>
                    <div className="font-bold text-emerald-300 mt-0.5 font-mono">
                      {item.exitCottages.length > 0
                        ? item.exitCottages.map(fa).join(' ، ')
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            نمایش آمار کاملاً بر اساس اطلاعات ثبت‌شده تفکیک شده است.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl ios-glass-btn text-slate-200 font-bold text-xs cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
