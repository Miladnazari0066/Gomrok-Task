import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Layers,
  TrendingUp,
  Package,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
} from 'lucide-react';
import { EntryDoc } from '../types';
import { fa, JMONTHS, todayJ } from '../utils/jalali';

interface MonthlyCottageBarChartProps {
  docs: EntryDoc[];
  currentFileDocs?: EntryDoc[];
  selectedFileNo?: string | null;
}

export interface MonthData {
  monthIndex: number; // 1 to 12
  monthName: string;
  count: number;
  trailers: number;
  pallets: number;
  cottages: { cottage: string; goods: string; importer: string; day: number }[];
}

export const MonthlyCottageBarChart: React.FC<MonthlyCottageBarChartProps> = ({
  docs,
  currentFileDocs,
  selectedFileNo,
}) => {
  // Extract all available Solar years from documents
  const currentJalaliYear = todayJ().jy;
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentJalaliYear);
    docs.forEach((d) => {
      if (d.unloadDate?.jy) {
        yearsSet.add(d.unloadDate.jy);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [docs, currentJalaliYear]);

  // Selected Year state (default to current year)
  const [selectedYear, setSelectedYear] = useState<number>(currentJalaliYear);

  // Scope: 'all' (all entry docs) or 'file' (only docs belonging to active file)
  const [scope, setScope] = useState<'all' | 'file'>(
    selectedFileNo && selectedFileNo !== 'ALL' ? 'file' : 'all'
  );

  // Clicked month for interactive drilldown
  const [activeMonthIndex, setActiveMonthIndex] = useState<number | null>(null);

  // Target docs based on selected scope
  const targetDocs = useMemo(() => {
    if (scope === 'file' && currentFileDocs && selectedFileNo && selectedFileNo !== 'ALL') {
      return currentFileDocs;
    }
    return docs;
  }, [scope, currentFileDocs, selectedFileNo, docs]);

  // Aggregate data by 12 Solar Hijri months for the chosen year
  const monthlyData: MonthData[] = useMemo(() => {
    // Initialize 12 months (1 = فروردین ... 12 = اسفند)
    const months: MonthData[] = JMONTHS.map((name, idx) => ({
      monthIndex: idx + 1,
      monthName: name,
      count: 0,
      trailers: 0,
      pallets: 0,
      cottages: [],
    }));

    targetDocs.forEach((d) => {
      if (!d.unloadDate) return;
      const { jy, jm, jd } = d.unloadDate;
      // Match year
      if (jy === selectedYear && jm >= 1 && jm <= 12) {
        const item = months[jm - 1];
        item.count += 1;
        item.trailers += d.trailers || 0;
        item.pallets += d.pallets || 0;
        item.cottages.push({
          cottage: d.cottage,
          goods: d.goods,
          importer: d.importer,
          day: jd,
        });
      }
    });

    return months;
  }, [targetDocs, selectedYear]);

  // Summary Metrics
  const totalCottagesInYear = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.count, 0);
  }, [monthlyData]);

  const peakMonth = useMemo(() => {
    let max = 0;
    let peak: MonthData | null = null;
    monthlyData.forEach((m) => {
      if (m.count > max) {
        max = m.count;
        peak = m;
      }
    });
    return peak;
  }, [monthlyData]);

  const activeMonthsCount = useMemo(() => {
    return monthlyData.filter((m) => m.count > 0).length;
  }, [monthlyData]);

  const monthlyAverage = useMemo(() => {
    if (activeMonthsCount === 0) return 0;
    return (totalCottagesInYear / (activeMonthsCount || 1)).toFixed(1);
  }, [totalCottagesInYear, activeMonthsCount]);

  // Selected Month details
  const activeMonthData = useMemo(() => {
    if (activeMonthIndex === null) return null;
    return monthlyData.find((m) => m.monthIndex === activeMonthIndex) || null;
  }, [monthlyData, activeMonthIndex]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: MonthData = payload[0].payload;
      return (
        <div className="bg-[#0b1324]/95 border border-cyan-500/40 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl text-slate-100 text-xs min-w-[210px] space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-lalezar text-cyan-300 text-base flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              ماه {data.monthName} ({fa(selectedYear)})
            </span>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono font-bold border border-cyan-500/30">
              ماه {fa(data.monthIndex)}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">تعداد کوتاژ وارد شده:</span>
              <b className="font-lalezar text-amber-300 text-base">{fa(data.count)}</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">تعداد کل تریلی‌ها:</span>
              <b className="text-slate-200 font-bold">{fa(data.trailers)} تریلی</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">مجموع پالت‌ها:</span>
              <b className="text-slate-200 font-bold">{fa(data.pallets)} پالت</b>
            </div>
          </div>

          {totalCottagesInYear > 0 && (
            <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
              <span>سهم از کل سال:</span>
              <span className="text-emerald-400 font-bold">
                {fa(Math.round((data.count / totalCottagesInYear) * 100))}%
              </span>
            </div>
          )}

          <div className="text-[10px] text-cyan-400/80 text-center pt-1 border-t border-white/5">
            جهت مشاهده لیست کوتاژها کلیک کنید
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel p-4 sm:p-5 shadow-xl rounded-2xl border border-white/10 relative overflow-hidden space-y-4">
      {/* Background ambient decorative glow */}
      <div className="absolute top-0 -left-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-72 h-72 rounded-full bg-blue-500/10 blur-[90px] pointer-events-none" />

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/10 pb-3.5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/10 shrink-0">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-lalezar text-lg sm:text-xl text-slate-100 flex items-center gap-2">
              <span>نمودار تحلیلی ورودی کوتاژها</span>
              <span className="text-xs font-sans text-cyan-300 font-normal bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                ماه‌های سال شمسی
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              توزیع زمانی و آماری تعداد کوتاژهای ثبت‌شده بر اساس تاریخ تخلیه در ۱۲ ماه سال {fa(selectedYear)}
            </p>
          </div>
        </div>

        {/* Filters: Year selector & Scope toggle */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {/* File Scope Toggle (if specific file is active) */}
          {selectedFileNo && selectedFileNo !== 'ALL' && (
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setScope('file')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  scope === 'file'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                پرونده {fa(selectedFileNo)}
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  scope === 'all'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                کل انبار
              </button>
            </div>
          )}

          {/* Year Selector */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 text-[11px]">سال:</span>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setActiveMonthIndex(null);
              }}
              className="bg-transparent text-amber-300 font-bold font-mono outline-none cursor-pointer"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr} className="bg-slate-900 text-slate-100">
                  {fa(yr)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 relative z-10 text-xs">
        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
          <div className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>کل کوتاژهای سال</span>
            <Package className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="font-lalezar text-xl text-slate-100 mt-1">{fa(totalCottagesInYear)} کوتاژ</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
          <div className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>ماه اوج ورودی</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-lalezar text-base text-amber-300 mt-1 truncate">
            {peakMonth && peakMonth.count > 0
              ? `${peakMonth.monthName} (${fa(peakMonth.count)})`
              : '—'}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
          <div className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>میانگین ماهانه</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-lalezar text-xl text-emerald-300 mt-1">{fa(monthlyAverage)} کوتاژ</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
          <div className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>ماه‌های فعال</span>
            <Clock className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="font-lalezar text-xl text-purple-300 mt-1">
            {fa(activeMonthsCount)} از ۱۲ ماه
          </div>
        </div>
      </div>

      {/* Main Recharts Interactive Bar Chart Container */}
      <div className="w-full h-72 sm:h-80 pt-2 relative z-10" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={monthlyData}
            margin={{ top: 15, right: 10, left: -20, bottom: 20 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload.length) {
                const clicked = e.activePayload[0].payload as MonthData;
                setActiveMonthIndex((prev) => (prev === clicked.monthIndex ? null : clicked.monthIndex));
              }
            }}
          >
            <defs>
              {/* Cyan gradient for regular bars */}
              <linearGradient id="barGradientCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0284c7" stopOpacity={0.7} />
              </linearGradient>

              {/* Amber gradient for active/selected or peak bar */}
              <linearGradient id="barGradientAmber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
              </linearGradient>

              {/* Dimmed gradient for zero count */}
              <linearGradient id="barGradientEmpty" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#475569" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#334155" stopOpacity={0.15} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} vertical={false} />

            <XAxis
              dataKey="monthName"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={45}
            />

            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              allowDecimals={false}
              tickFormatter={(v) => fa(v)}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)', radius: 8 }}
            />

            <Bar
              dataKey="count"
              radius={[8, 8, 2, 2]}
              animationDuration={800}
              className="cursor-pointer"
            >
              {monthlyData.map((entry) => {
                const isSelected = activeMonthIndex === entry.monthIndex;
                const isPeak = peakMonth && peakMonth.count > 0 && entry.monthIndex === peakMonth.monthIndex;
                let fill = 'url(#barGradientCyan)';
                if (isSelected) fill = 'url(#barGradientAmber)';
                else if (isPeak && entry.count > 0) fill = 'url(#barGradientAmber)';
                else if (entry.count === 0) fill = 'url(#barGradientEmpty)';

                return (
                  <Cell
                    key={`cell-${entry.monthIndex}`}
                    fill={fill}
                    stroke={isSelected ? '#fbbf24' : isPeak ? '#f59e0b' : '#38bdf8'}
                    strokeWidth={isSelected ? 2 : entry.count > 0 ? 1 : 0}
                    style={{
                      filter: isSelected
                        ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))'
                        : entry.count > 0
                        ? 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.3))'
                        : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Drill-down Interactive Card: When a month bar is clicked */}
      {activeMonthData && (
        <div className="bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-transparent border border-amber-500/30 rounded-xl p-3 sm:p-4 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2 relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-lalezar text-base text-amber-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                جزئیات ورودی‌های ماه {activeMonthData.monthName} سال {fa(selectedYear)}
              </span>
              <span className="bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/40 text-[11px]">
                {fa(activeMonthData.count)} کوتاژ
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveMonthIndex(null)}
              className="text-slate-400 hover:text-slate-200 text-[11px] underline cursor-pointer"
            >
              بستن جزئیات ماه
            </button>
          </div>

          {activeMonthData.cottages.length === 0 ? (
            <div className="text-slate-400 py-2 text-center text-xs">
              هیچ کوتاژی در ماه {activeMonthData.monthName} ثبت نشده است.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto custom-scrollbar">
              {activeMonthData.cottages.map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-900/80 border border-white/10 rounded-lg p-2.5 space-y-1 hover:border-cyan-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-lalezar text-sm text-cyan-300">
                      کوتاژ: {fa(item.cottage)}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                      روز {fa(item.day)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    کالا: <b className="text-slate-200">{item.goods || '—'}</b>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    صاحب: {item.importer || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Helpful footer info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5 relative z-10 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            برای مشاهده جزئیات ریز هر ماه بر روی ستون مربوطه کلیک کنید. ستون طلایی نشانگر ماه با بیشترین ورودی است.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            <span>عادی</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>بیشترین ورودی</span>
          </span>
        </div>
      </div>
    </div>
  );
};
