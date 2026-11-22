import React, { useState, useEffect } from 'react';
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
  Database,
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  getSupabase,
  isSupabaseConfigured,
  getSavedSupabaseCredentials,
  saveSupabaseCredentials,
} from '../lib/supabase';
import {
  fetchOnboardingStatus,
  fetchServerHealth,
  loginWithIdentifier,
} from '../services/workspaceApi';
import { SUPABASE_SQL_SCHEMA } from '../utils/sqlSchema';

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

  const [serverAdminReady, setServerAdminReady] = useState<boolean | null>(null);
  const [hasUnclaimedLegacy, setHasUnclaimedLegacy] = useState(false);
  const [legacyCompanyName, setLegacyCompanyName] = useState('');
  const [showSetupHelper, setShowSetupHelper] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const existingCreds = getSavedSupabaseCredentials();
  const [sbUrl, setSbUrl] = useState(existingCreds.url);
  const [sbAnonKey, setSbAnonKey] = useState(existingCreds.key);
  const [clientConfigured, setClientConfigured] = useState(() => isSupabaseConfigured());

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

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchServerHealth().catch(() => ({ ok: false, supabaseConfigured: false, adminConfigured: false })),
      fetchOnboardingStatus().catch(() => ({
        adminConfigured: false,
        hasUnclaimedLegacyCompany: false,
        legacyCompanyName: '',
      })),
    ]).then(([health, status]) => {
      if (!active) return;
      setServerAdminReady(Boolean(health.adminConfigured));
      setHasUnclaimedLegacy(Boolean(status.hasUnclaimedLegacyCompany));
      setLegacyCompanyName(status.legacyCompanyName || '');
    });
    return () => {
      active = false;
    };
  }, [clientConfigured]);

  const handleSaveClientSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = saveSupabaseCredentials(sbUrl, sbAnonKey);
    if (ok) {
      setClientConfigured(true);
      setError('');
      setShowSetupHelper(false);
    } else {
      setError('آدرس یا کلید Anon Key پروژه Supabase معتبر نیست.');
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      setError('امکان کپی خودکار نبود. فایل supabase/schema.sql را مستقیماً باز کنید.');
    }
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
      setError('اتصال کلاینت Supabase هنوز تنظیم نشده است.');
      setShowSetupHelper(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (serverAdminReady) {
        const res = await loginWithIdentifier(cleanId, password);
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: res.accessToken,
          refresh_token: res.refreshToken,
        });
        if (sessErr) throw sessErr;
      } else {
        if (!cleanId.includes('@')) {
          throw new Error('برای ورود با نام کاربری باید متغیر SUPABASE_SERVICE_ROLE_KEY در سرور تنظیم شود، یا با ایمیل وارد شوید.');
        }
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: cleanId.toLowerCase(),
          password,
        });
        if (signErr) {
          throw new Error('ایمیل یا رمز عبور اشتباه است یا حساب شما غیرفعال شده است.');
        }
      }

      setIsAccessGranted(true);
      setTimeout(() => {
        onSuccess();
      }, 650);
    } catch (err: any) {
      setError(err?.message || 'خطا در احراز هویت. لطفاً اطلاعات ورود را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-clip p-3 sm:p-6 pt-safe pb-safe bg-[#040711] select-none text-slate-100 font-vazir dir-rtl">
      <div className="w-full max-w-[460px] my-auto space-y-4">
        {/* Main Auth Card */}
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
                onClick={() => onStartOnboarding('create')}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-cyan-400/35 text-cyan-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>ثبت شرکت جدید و راه‌اندازی فضای کاری</span>
              </button>

              {/* Supabase Setup Status & SQL Migration Access */}
              <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>احراز هویت امن Supabase Auth</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowSetupHelper((prev) => !prev)}
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 cursor-pointer"
                >
                  {showSetupHelper ? 'بستن راهنمای سرور' : 'پیکربندی Supabase و SQL'}
                </button>
              </div>
            </>
          )}
        </motion.div>

        {/* Collapsible Supabase Connection & SQL Migration Helper */}
        {(showSetupHelper || !clientConfigured || serverAdminReady === false) && !isLoggingOut && !isAccessGranted && (
          <div className="glass-panel p-4 sm:p-5 space-y-3.5 text-xs border border-white/12">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-200">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>وضعیت اتصال Supabase چندشرکتی</span>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="min-h-[34px] px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-cyan-200 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'اسکریپت SQL کپی شد' : 'کپی اسکریپت مهاجرت SQL'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/8">
                <span className="text-slate-400 block">اتصال کلاینت (Anon):</span>
                <span className={clientConfigured ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                  {clientConfigured ? 'متصل' : 'نیاز به تنظیم'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/8">
                <span className="text-slate-400 block">سرویس ادمین سرور:</span>
                <span className={serverAdminReady ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                  {serverAdminReady === null ? 'در حال بررسی...' : serverAdminReady ? 'آماده' : 'نیاز به تنظیم Secret'}
                </span>
              </div>
            </div>

            {serverAdminReady === false && (
              <p className="text-[11px] text-amber-200/90 leading-relaxed bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                برای ثبت شرکت جدید و ساخت فوری کاربران، متغیرهای <code className="font-mono">SUPABASE_URL</code> و{' '}
                <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> را در بخش Secrets سرور تنظیم کرده و اسکریپت SQL را در Supabase SQL Editor اجرا کنید.
              </p>
            )}

            {showSetupHelper && (
              <form onSubmit={handleSaveClientSupabase} className="space-y-2.5 pt-1 border-t border-white/10">
                <input
                  type="url"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://xxxxx.supabase.co"
                  dir="ltr"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl glass-input text-xs text-left outline-none"
                />
                <input
                  type="password"
                  value={sbAnonKey}
                  onChange={(e) => setSbAnonKey(e.target.value)}
                  placeholder="Supabase Anon Public Key"
                  dir="ltr"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl glass-input text-xs text-left outline-none"
                />
                <button
                  type="submit"
                  className="w-full min-h-[40px] rounded-xl ios-glass-btn text-cyan-200 font-bold text-xs cursor-pointer"
                >
                  ذخیره اتصال کلاینت Supabase
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
