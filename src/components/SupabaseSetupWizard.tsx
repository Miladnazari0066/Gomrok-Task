import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Database,
  Globe,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ShieldCheck,
  Clock,
  RotateCcw,
} from 'lucide-react';
import {
  clearSupabaseCredentials,
  getSavedSupabaseCredentials,
  getSupabaseConnectionSource,
  getSupabaseKeyKind,
  hasCustomSupabaseOverride,
  isSupabaseConfigured,
  saveSupabaseCredentialsDetailed,
  testSupabaseConnectionLive,
  SupabaseConnectionSource,
  SupabaseDiagnosticStep,
  SupabaseLiveTestResult,
} from '../lib/supabase';
import { SUPABASE_SQL_SCHEMA } from '../utils/sqlSchema';

interface SupabaseSetupWizardProps {
  onReady: (result: SupabaseLiveTestResult) => void;
  onCancel?: () => void;
  canCancel?: boolean;
  initialNotice?: string;
}

const StepStatusIcon: React.FC<{ status: SupabaseDiagnosticStep['status'] }> = ({ status }) => {
  if (status === 'ok') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
  }
  if (status === 'warn') {
    return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
  }
  if (status === 'error') {
    return <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
  }
  return <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />;
};

export const SupabaseSetupWizard: React.FC<SupabaseSetupWizardProps> = ({
  onReady,
  onCancel,
  canCancel = false,
  initialNotice,
}) => {
  const saved = getSavedSupabaseCredentials();
  const [urlInput, setUrlInput] = useState(saved.url);
  const [keyInput, setKeyInput] = useState(saved.key);
  const [showKey, setShowKey] = useState(false);
  const [showWhereToFind, setShowWhereToFind] = useState(!saved.url || !saved.key);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const [testing, setTesting] = useState(false);
  const [formError, setFormError] = useState('');
  const [testResult, setTestResult] = useState<SupabaseLiveTestResult | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [hasCustomOverride, setHasCustomOverride] = useState(() => hasCustomSupabaseOverride());
  const [connectionSource, setConnectionSource] = useState<SupabaseConnectionSource>(() =>
    getSupabaseConnectionSource()
  );

  const detectedKeyKind = useMemo(() => getSupabaseKeyKind(keyInput), [keyInput]);

  // Run an initial live diagnostic if valid credentials are already present
  useEffect(() => {
    let active = true;
    if (isSupabaseConfigured()) {
      setTesting(true);
      testSupabaseConnectionLive(saved.url, saved.key)
        .then((res) => {
          if (active) setTestResult(res);
        })
        .finally(() => {
          if (active) setTesting(false);
        });
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveAndTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError('');
    setShowTechDetails(false);

    const saveRes = saveSupabaseCredentialsDetailed(urlInput, keyInput);
    if (!saveRes.ok) {
      setFormError(saveRes.error || 'آدرس پروژه یا کلید عمومی معتبر نیست.');
      return;
    }

    const normalizedUrl = saveRes.normalizedUrl || urlInput.trim();
    const normalizedKey = saveRes.normalizedKey || keyInput.trim();
    setUrlInput(normalizedUrl);
    setKeyInput(normalizedKey);
    setHasCustomOverride(hasCustomSupabaseOverride());
    setConnectionSource(getSupabaseConnectionSource());

    setTesting(true);
    try {
      const liveRes = await testSupabaseConnectionLive(normalizedUrl, normalizedKey);
      setTestResult(liveRes);
    } finally {
      setTesting(false);
    }
  };

  const handleRecheckOnly = async () => {
    setFormError('');
    setTesting(true);
    try {
      const liveRes = await testSupabaseConnectionLive(urlInput, keyInput);
      setTestResult(liveRes);
    } finally {
      setTesting(false);
    }
  };

  const handleResetToDefault = async () => {
    clearSupabaseCredentials();
    const fallback = getSavedSupabaseCredentials();
    setUrlInput(fallback.url);
    setKeyInput(fallback.key);
    setFormError('');
    setHasCustomOverride(false);
    setConnectionSource(fallback.source);
    if (fallback.url && fallback.key) {
      setTesting(true);
      try {
        const liveRes = await testSupabaseConnectionLive(fallback.url, fallback.key);
        setTestResult(liveRes);
      } finally {
        setTesting(false);
      }
    } else {
      setTestResult(null);
      setShowWhereToFind(true);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      setFormError('کپی خودکار انجام نشد. لطفاً فایل supabase/schema.sql را مستقیماً باز کنید.');
    }
  };

  const canProceedToLogin = Boolean(testResult?.connectionOk);
  const allGreen = Boolean(testResult?.connectionOk && testResult?.schemaReady);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="ios-glass-card p-5 sm:p-7 border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.85)] space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-lalezar text-xl sm:text-2xl text-slate-100 leading-tight">
              اتصال به پایگاه‌داده Supabase
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              پشتیبانی کامل از کلید جدید <span className="text-cyan-300 font-semibold">Publishable Key</span> و کلید Anon
            </p>
          </div>
        </div>
        {canCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>بازگشت</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {connectionSource === 'default' && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 px-3.5 py-2.5 text-xs text-emerald-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-relaxed">
            اتصال پیش‌فرض پروژه شما با کلید عمومی <b>Publishable Key</b> به‌صورت خودکار فعال است. در صورت نیاز می‌توانید پروژه دیگری وارد کنید.
          </span>
        </div>
      )}

      {initialNotice && !testResult && (
        <div className="rounded-xl bg-cyan-500/12 border border-cyan-400/35 px-3.5 py-2.5 text-xs text-cyan-100 leading-relaxed">
          {initialNotice}
        </div>
      )}

      {/* Collapsible Where-to-find Guide for New Supabase Dashboard */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowWhereToFind((prev) => !prev)}
          className="w-full min-h-[42px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-cyan-200 hover:bg-white/[0.03] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>راهنمای یافتن Project URL و Publishable Key در Supabase</span>
          </span>
          {showWhereToFind ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        </button>

        {showWhereToFind && (
          <div className="px-3.5 pb-3.5 pt-1 text-[11px] text-slate-300 space-y-2 border-t border-white/8 leading-relaxed">
            <ol className="list-decimal pr-4 space-y-1.5">
              <li>
                در داشبورد Supabase وارد پروژه خود شوید و از منوی سمت چپ <b className="text-slate-100">Project Settings</b> را باز کنید.
              </li>
              <li>
                برای آدرس پروژه: از بخش <span className="text-cyan-300 font-mono" dir="ltr">Data API</span> مقدار <b className="text-slate-100">Project URL</b> را کپی کنید.
              </li>
              <li>
                برای کلید عمومی: از بخش <span className="text-cyan-300 font-mono" dir="ltr">API Keys</span> مقدار <b className="text-emerald-300">Publishable key</b> (با شروع <span className="font-mono" dir="ltr">sb_publishable_...</span>) یا از تب Legacy کلید <span className="font-mono" dir="ltr">anon public</span> را کپی کنید.
              </li>
            </ol>
            <p className="text-[10.5px] text-amber-200/90 flex items-center gap-1.5 pt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>هرگز کلید محرمانه (Secret Key) را وارد نکنید؛ تنها کلید عمومی Publishable/Anon مجاز است.</span>
            </p>
          </div>
        )}
      </div>

      {/* Step 1: Input Form */}
      <form onSubmit={handleSaveAndTest} className="space-y-3.5">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-200">
            ۱. آدرس پروژه Supabase (Project URL)
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder="https://xxxxx.supabase.co"
              dir="ltr"
              className="w-full min-h-[46px] pr-10 pl-3.5 py-2.5 rounded-xl glass-input text-xs sm:text-sm text-left outline-none font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-semibold text-slate-200">
              ۲. کلید عمومی (Publishable Key یا Anon Key)
            </label>
            {keyInput.trim().length > 0 && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  detectedKeyKind === 'publishable'
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                    : detectedKeyKind === 'anon_jwt'
                      ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                      : detectedKeyKind === 'secret'
                        ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                        : 'bg-white/5 border-white/15 text-slate-300'
                }`}
              >
                {detectedKeyKind === 'publishable'
                  ? 'Publishable Key (جدید)'
                  : detectedKeyKind === 'anon_jwt'
                    ? 'Anon Key (قدیمی)'
                    : detectedKeyKind === 'secret'
                      ? 'کلید Secret (غیرمجاز!)'
                      : 'در حال تایپ...'}
              </span>
            )}
          </div>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showKey ? 'text' : 'password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder="sb_publishable_... یا eyJhbGciOi..."
              dir="ltr"
              className="w-full min-h-[46px] pr-10 pl-11 py-2.5 rounded-xl glass-input text-xs sm:text-sm text-left outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
              aria-label={showKey ? 'مخفی کردن کلید' : 'نمایش کلید'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {formError && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-200 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{formError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="submit"
            disabled={testing}
            className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl ios-glass-btn-cyan text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال اجرای تست زنده ۳ مرحله‌ای...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>ذخیره و اجرای تست زنده اتصال</span>
              </>
            )}
          </button>

          {hasCustomOverride && (
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={testing}
              className="min-h-[46px] px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="حذف تنظیم دستی و بازگشت به اتصال پیش‌فرض پروژه"
            >
              <RotateCcw className="w-4 h-4" />
              <span>بازگشت به پیش‌فرض</span>
            </button>
          )}
        </div>
      </form>

      {/* Step 2: Live 3-Stage Diagnostic Checklist */}
      {testResult && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-200">نتیجه تست زنده ۳ مرحله‌ای:</p>
            <button
              type="button"
              onClick={handleRecheckOnly}
              disabled={testing}
              className="text-[11px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>تست مجدد</span>
            </button>
          </div>

          <div className="space-y-2">
            {[testResult.steps.connection, testResult.steps.authConfig, testResult.steps.schema].map(
              (step, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-3 border text-xs space-y-1 ${
                    step.status === 'ok'
                      ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-100'
                      : step.status === 'warn'
                        ? 'bg-amber-500/10 border-amber-400/35 text-amber-100'
                        : step.status === 'error'
                          ? 'bg-rose-500/12 border-rose-500/40 text-rose-100'
                          : 'bg-white/[0.02] border-white/8 text-slate-400'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <StepStatusIcon status={step.status} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-[12px]">{step.title}</p>
                      <p className="text-[11px] opacity-90 leading-relaxed">{step.message}</p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Technical error details toggle (helps pinpoint exact network/key/HTTP cause) */}
          {(testResult.steps.connection.technicalDetail || testResult.steps.schema.technicalDetail) && (
            <div>
              <button
                type="button"
                onClick={() => setShowTechDetails((prev) => !prev)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-4 cursor-pointer"
              >
                {showTechDetails ? 'مخفی کردن جزئیات فنی خطا' : 'مشاهده جزئیات فنی خطا (برای عیب‌یابی)'}
              </button>
              {showTechDetails && (
                <pre
                  dir="ltr"
                  className="mt-2 p-2.5 rounded-xl bg-black/50 border border-white/10 text-[10.5px] text-rose-200 font-mono whitespace-pre-wrap break-all text-left"
                >
                  {[
                    testResult.steps.connection.technicalDetail
                      ? `Connection: ${testResult.steps.connection.technicalDetail}`
                      : '',
                    testResult.steps.schema.technicalDetail
                      ? `Schema RPC: ${testResult.steps.schema.technicalDetail}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </pre>
              )}
            </div>
          )}

          {/* Actionable 4-Step Guide to Turn Off Confirm Email when currently ON */}
          {testResult.connectionOk && testResult.emailAutoconfirm === false && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-400/35 p-3.5 space-y-2 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-amber-200">
                  راهنمای خاموش کردن Confirm email برای ورود فوری پس از ثبت شرکت:
                </p>
                <button
                  type="button"
                  onClick={handleRecheckOnly}
                  disabled={testing}
                  className="min-h-[30px] px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                  <span>بررسی مجدد</span>
                </button>
              </div>
              <ol className="list-decimal pr-4 space-y-1 text-slate-200 leading-relaxed">
                <li>در داشبورد Supabase از منوی سمت چپ وارد بخش <b className="text-amber-100">Authentication</b> شوید.</li>
                <li>گزینه <b className="text-amber-100">Sign In / Providers</b> (یا <b>Providers</b>) را باز کرده و روی <b className="text-amber-100">Email</b> کلیک کنید.</li>
                <li>تیک گزینه <b className="text-amber-100">Confirm email</b> را خاموش (OFF) کنید و دکمه <b className="text-amber-100">Save</b> را بزنید.</li>
                <li>به همین صفحه برگردید و دکمه <b>«بررسی مجدد»</b> را بزنید تا مرحله دوم نیز سبز شود.</li>
              </ol>
            </div>
          )}

          {/* Actionable SQL Migration Panel when Connection is OK but SQL v5.1 isn't installed yet */}
          {testResult.connectionOk && !testResult.schemaReady && (
            <div className="rounded-2xl bg-cyan-500/10 border border-cyan-400/35 p-3.5 space-y-2.5 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-cyan-200">
                  گام پایانی: اجرای یک‌باره اسکریپت SQL چندشرکتی (v5.1)
                </p>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/45 text-cyan-100 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'اسکریپت SQL کپی شد!' : 'کپی کامل اسکریپت SQL'}</span>
                </button>
              </div>
              <ol className="list-decimal pr-4 space-y-1 text-slate-200 leading-relaxed">
                <li>دکمه <b>«کپی کامل اسکریپت SQL»</b> را بزنید.</li>
                <li>در داشبورد Supabase بخش <b>SQL Editor → New query</b> را باز کنید، کد را بچسبانید و <b>Run</b> را بزنید.</li>
                <li>به این صفحه برگردید و دکمه <b>«تست مجدد»</b> را بزنید تا هر ۳ مرحله سبز شوند.</li>
              </ol>
            </div>
          )}

          {/* Continue to Login / Company Registration CTA */}
          {canProceedToLogin && (
            <button
              type="button"
              onClick={() => onReady(testResult)}
              className={`w-full min-h-[48px] px-5 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                allGreen
                  ? 'ios-glass-btn-primary'
                  : 'bg-white/10 hover:bg-white/15 border border-white/20 text-slate-100'
              }`}
            >
              <span>
                {allGreen
                  ? 'همه مراحل تایید شد — ورود به صفحه لاگین و ثبت شرکت'
                  : 'ورود به صفحه لاگین (اجرای SQL بعداً انجام شود)'}
              </span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};
