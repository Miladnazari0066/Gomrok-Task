import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Lock,
  Mail,
  LogIn,
  Eye,
  EyeOff,
  Building2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Loader2,
  SlidersHorizontal,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import {
  getSavedSupabaseCredentials,
  getSupabase,
  isSupabaseConfigured,
  testSupabaseConnectionLive,
  SupabaseLiveTestResult,
} from '../lib/supabase';
import { loginWithIdentifier } from '../services/workspaceApi';
import { SupabaseSetupWizard } from './SupabaseSetupWizard';

export type UserRole = 'admin' | 'viewer';

interface LoginGateProps {
  onSuccess: () => void;
  onStartOnboarding: (mode: 'create' | 'claim_legacy') => void;
  isLoggingOut?: boolean;
  onLogoutComplete?: () => void;
  externalError?: string;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  onSuccess,
  onStartOnboarding,
  isLoggingOut,
  onLogoutComplete,
  externalError,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(externalError || '');
  const [isAccessGranted, setIsAccessGranted] = useState(false);

  const [clientConfigured, setClientConfigured] = useState(() => isSupabaseConfigured());
  const [showConnectionWizard, setShowConnectionWizard] = useState(() => !isSupabaseConfigured());
  const [wizardNotice, setWizardNotice] = useState('');

  const [checkingLive, setCheckingLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<SupabaseLiveTestResult | null>(null);
  const [showConfirmEmailGuide, setShowConfirmEmailGuide] = useState(false);

  useEffect(() => {
    if (externalError) setError(externalError);
  }, [externalError]);

  useEffect(() => {
    if (isLoggingOut) {
      const timer = setTimeout(() => {
        if (onLogoutComplete) onLogoutComplete();
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isLoggingOut, onLogoutComplete]);

  const runBackgroundCheck = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setClientConfigured(false);
      setLiveStatus(null);
      setShowConnectionWizard(true);
      return;
    }
    const { url, key } = getSavedSupabaseCredentials();
    setClientConfigured(true);
    setCheckingLive(true);
    try {
      const res = await testSupabaseConnectionLive(url, key);
      setLiveStatus(res);
    } catch {
      setLiveStatus(null);
    } finally {
      setCheckingLive(false);
    }
  }, []);

  useEffect(() => {
    if (!showConnectionWizard && clientConfigured && !isLoggingOut && !isAccessGranted) {
      runBackgroundCheck();
    }
  }, [showConnectionWizard, clientConfigured, isLoggingOut, isAccessGranted, runBackgroundCheck]);

  const handleWizardReady = (result: SupabaseLiveTestResult) => {
    setClientConfigured(isSupabaseConfigured());
    setLiveStatus(result);
    setWizardNotice('');
    setError('');
    setShowConnectionWizard(false);
  };

  const handleStartNewCompany = () => {
    if (!isSupabaseConfigured()) {
      setWizardNotice('برای ثبت شرکت جدید، ابتدا اتصال پروژه Supabase را تکمیل و تست کنید.');
      setShowConnectionWizard(true);
      return;
    }
    if (liveStatus && !liveStatus.connectionOk) {
      setWizardNotice('اتصال به پروژه Supabase دارای خطا است. لطفاً ابتدا آدرس یا Publishable Key را اصلاح و تست کنید.');
      setShowConnectionWizard(true);
      return;
    }
    if (liveStatus && !liveStatus.schemaReady) {
      setWizardNotice('پیش از ثبت شرکت، ابتدا اسکریپت SQL نسخه ۵.۱ را کپی کرده و در Supabase SQL Editor اجرا کنید.');
      setShowConnectionWizard(true);
      return;
    }
    onStartOnboarding('create');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setError('لطفاً ایمیل یا نام کاربری و رمز عبور خود را وارد کنید.');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setWizardNotice('اتصال پروژه Supabase هنوز تنظیم نشده است.');
      setShowConnectionWizard(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await loginWithIdentifier(cleanId, password);
      setIsAccessGranted(true);
      setTimeout(() => {
        onSuccess();
      }, 650);
    } catch (err: any) {
      if (err?.code === 'SCHEMA_NOT_READY' || err?.code === 'INVALID_API_KEY') {
        setWizardNotice(err?.message || 'لطفاً تنظیمات اتصال Supabase را بررسی کنید.');
        setShowConnectionWizard(true);
      } else {
        setError(err?.message || 'خطا در احراز هویت. لطفاً اطلاعات ورود را بررسی کنید.');
      }
    } finally {
      setLoading(false);
    }
  };

  const hasUnclaimedLegacy = Boolean(liveStatus?.hasUnclaimedLegacyCompany);
  const legacyCompanyName = liveStatus?.legacyCompanyName || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-clip p-3 sm:p-6 pt-safe pb-safe bg-[#040711] select-none text-slate-100 font-vazir dir-rtl">
      <div className="w-full max-w-[480px] my-auto space-y-4">
        {showConnectionWizard && !isLoggingOut && !isAccessGranted ? (
          <SupabaseSetupWizard
            onReady={handleWizardReady}
            canCancel={clientConfigured}
            onCancel={() => {
              setWizardNotice('');
              setShowConnectionWizard(false);
            }}
            initialNotice={wizardNotice}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="ios-glass-card p-6 sm:p-8 border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.85)] space-y-6"
          >
            {/* Brand Header */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-cyan-400/45 bg-[#071A21] shadow-lg shadow-cyan-500/15 flex items-center justify-center">
                <img
                  src="pwa-192x192.png"
                  alt="لوگوی مدیریت کارهای گمرک"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="font-lalezar text-2xl sm:text-3xl text-slate-100 tracking-wide">
                  مدیریت کارهای گمرک
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  پلتفرم چندشرکتی مدیریت ورود، تجمیع، خروج و ترخیص ۹۰/۱۰
                </p>
              </div>
            </div>

            {isLoggingOut ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-sm font-bold text-slate-200">در حال خروج امن از فضای کاری...</p>
              </div>
            ) : isAccessGranted ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <p className="font-lalezar text-xl text-emerald-300">ورود تایید شد</p>
                <p className="text-xs text-slate-400">در حال بارگذاری فضای کاری شرکت شما...</p>
              </div>
            ) : (
              <>
                {/* Unclaimed Legacy Company Migration Callout */}
                {hasUnclaimedLegacy && (
                  <div className="rounded-2xl bg-amber-500/12 border border-amber-400/40 p-4 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-amber-200">
                          داده‌های قبلی سامانه شناسایی شد
                        </p>
                        <p className="text-slate-300 leading-relaxed">
                          سوابق موجود به فضای کاری «{legacyCompanyName || 'شرکت اولیه'}» منتقل شده‌اند. برای حفظ و دسترسی به تمام اسناد قبلی، حساب مالک شرکت را تکمیل کنید.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStartOnboarding('claim_legacy')}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl ios-glass-btn-primary text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>تکمیل راه‌اندازی و ثبت مالک شرکت قبلی</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      ایمیل یا نام کاربری
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          if (error) setError('');
                        }}
                        autoComplete="username"
                        placeholder="name@company.com یا نام کاربری"
                        dir="ltr"
                        className="w-full min-h-[46px] pr-10 pl-3.5 py-2.5 rounded-xl glass-input text-sm text-left outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      رمز عبور
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError('');
                        }}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        dir="ltr"
                        className="w-full min-h-[46px] pr-10 pl-11 py-2.5 rounded-xl glass-input text-sm text-left outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
                        aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] px-5 py-3 rounded-xl ios-glass-btn-cyan text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>در حال ورود...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>ورود به فضای کاری</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative py-1">
                  <div className="h-px bg-white/10" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 bg-[#09101f] text-[11px] text-slate-400 whitespace-nowrap">
                    شرکت جدید هستید؟
                  </span>
                </div>

                {/* Register New Company CTA */}
                <button
                  type="button"
                  onClick={handleStartNewCompany}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-cyan-400/35 text-cyan-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>ثبت شرکت جدید و راه‌اندازی فضای کاری</span>
                </button>

                {/* Live Confirm Email Guide (auto-hides once Confirm email is turned OFF in Supabase) */}
                {liveStatus?.connectionOk && liveStatus?.emailAutoconfirm === false && (
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-400/35 overflow-hidden text-[11px]">
                    <button
                      type="button"
                      onClick={() => setShowConfirmEmailGuide((prev) => !prev)}
                      className="w-full min-h-[42px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-right hover:bg-amber-500/5 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-amber-200 font-bold leading-snug">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>راهنمای ورود فوری ثبت شرکت (Confirm email روشن است)</span>
                      </span>
                      {showConfirmEmailGuide ? (
                        <ChevronUp className="w-4 h-4 text-amber-300 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-amber-300 shrink-0" />
                      )}
                    </button>

                    {showConfirmEmailGuide && (
                      <div className="px-3.5 pb-3.5 pt-2 border-t border-amber-400/20 space-y-2.5 text-slate-200 leading-relaxed">
                        <p className="text-amber-100/90">
                          برای اینکه پس از ثبت شرکت جدید بدون نیاز به لینک تایید ایمیل بلافاصله وارد سامانه شوید، این ۴ قدم کوتاه را یک‌بار در داشبورد Supabase انجام دهید:
                        </p>
                        <ol className="list-decimal pr-4 space-y-1">
                          <li>در داشبورد Supabase وارد بخش <b className="text-white">Authentication</b> شوید.</li>
                          <li>گزینه <b className="text-white">Sign In / Providers</b> (یا <b>Providers</b>) را باز کرده و روی <b className="text-white">Email</b> کلیک کنید.</li>
                          <li>گزینه <b className="text-white">Confirm email</b> را خاموش (<span dir="ltr" className="font-mono text-amber-200">OFF</span>) کنید و دکمه <b className="text-white">Save</b> را بزنید.</li>
                          <li>دکمه «بررسی مجدد وضعیت» زیر را بزنید تا این اعلان به‌صورت خودکار بسته شود.</li>
                        </ol>
                        <button
                          type="button"
                          onClick={runBackgroundCheck}
                          disabled={checkingLive}
                          className="min-h-[34px] px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingLive ? 'animate-spin' : ''}`} />
                          <span>{checkingLive ? 'در حال بررسی...' : 'بررسی مجدد وضعیت'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Clean Compact Supabase Status Strip */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    {checkingLive ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                        <span className="text-slate-400">در حال بررسی اتصال Supabase...</span>
                      </>
                    ) : liveStatus?.connectionOk && liveStatus?.schemaReady ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-emerald-300 font-semibold truncate">
                          متصل به Supabase ({liveStatus.keyKind === 'publishable' ? 'Publishable' : 'Anon'}) · آماده
                        </span>
                      </>
                    ) : liveStatus?.connectionOk && !liveStatus?.schemaReady ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-amber-200 font-semibold">
                          متصل · نیاز به اجرای اسکریپت SQL
                        </span>
                      </>
                    ) : liveStatus && !liveStatus.connectionOk ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="text-rose-300 font-semibold">
                          خطا در اتصال Supabase
                        </span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="text-slate-400">احراز هویت امن Supabase Auth</span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWizardNotice('');
                      setShowConnectionWizard(true);
                    }}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/12 text-cyan-200 font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>تنظیمات و تست اتصال</span>
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
