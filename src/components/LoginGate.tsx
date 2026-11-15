import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogIn,
  Eye,
  EyeOff,
  Sparkles,
  Clock,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  checkAccessCodeRole,
  isAccountLocked,
  getLockoutRemainingSeconds,
  recordFailedAttempt,
  resetFailedAttempts,
  logSecurityEvent,
  isUsingDefaultPasswords,
  createSessionToken,
} from '../utils/security';

export type UserRole = 'admin' | 'viewer';

export interface LoginResult {
  role: UserRole;
  displayName: string;
}

interface LoginGateProps {
  onSuccess: (role: UserRole) => void;
  isLoggingOut?: boolean;
  onLogoutComplete?: () => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  onSuccess,
  isLoggingOut,
  onLogoutComplete,
}) => {
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isAccessGranted, setIsAccessGranted] = useState(false);
  const [shake, setShake] = useState(false);

  // Lockout countdown timer
  const [lockoutSec, setLockoutSec] = useState<number>(() => getLockoutRemainingSeconds());

  useEffect(() => {
    if (lockoutSec <= 0) return;
    const interval = setInterval(() => {
      const remaining = getLockoutRemainingSeconds();
      setLockoutSec(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setError('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSec]);

  // Auto trigger completion on logout (1.5 seconds)
  useEffect(() => {
    if (isLoggingOut) {
      const timer = setTimeout(() => {
        if (onLogoutComplete) onLogoutComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoggingOut, onLogoutComplete]);

  const triggerSuccess = (role: UserRole) => {
    createSessionToken(role);
    logSecurityEvent({
      type: 'login_success',
      user: role === 'admin' ? 'مدیر' : 'بازدیدکننده',
      role,
      description: `ورود موفق به سامانه با دسترسی ${role === 'admin' ? 'مدیریت کل' : 'ناظر (فقط مشاهده و پرینت)'}`,
      severity: 'info',
    });

    setIsAccessGranted(true);
    setError('');

    setTimeout(() => {
      onSuccess(role);
    }, 1100);
  };

  const handleVerify = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    if (isAccountLocked()) {
      const rem = getLockoutRemainingSeconds();
      setLockoutSec(rem);
      setError(`سامانه به دلیل تلاش‌های مکرر قفل است. لطفاً ${rem} ثانیه دیگر مجدداً تلاش فرمایید.`);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const detectedRole = checkAccessCodeRole(cleanCode);

    if (detectedRole) {
      triggerSuccess(detectedRole);
    } else {
      const attemptRes = recordFailedAttempt('گیت ورودی');
      setShake(true);
      setTimeout(() => setShake(false), 500);

      if (attemptRes.locked) {
        setLockoutSec(attemptRes.remainingSeconds);
        setError(`حساب به مدت ${attemptRes.remainingSeconds} ثانیه به دلیل ۵ تلاش ناموفق مسدود گردید.`);
      } else {
        setError(
          `کد دسترسی نامعتبر است. (${attemptRes.attemptsLeft} تلاش مجاز تا قفل موقت سیستم باقی‌مانده است)`
        );
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setAccessCode(val);
    setError('');

    // If matches a role immediately
    if (val.length >= 4 && !isAccountLocked()) {
      const role = checkAccessCodeRole(val);
      if (role) {
        triggerSuccess(role);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode) {
      setError('لطفاً کد دسترسی را وارد نمایید.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    handleVerify(accessCode);
  };

  const isLocked = lockoutSec > 0;
  const isDefault = isUsingDefaultPasswords();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-[#05070d] select-none text-slate-100 font-vazir dir-rtl">
      {/* 3D Horizon Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,_var(--tw-gradient-stops))] from-cyan-950/40 via-[#05070d] to-[#020305]" />
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(6, 182, 212, 0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.25) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          transform: 'perspective(600px) rotateX(65deg) translateY(-80px) scale(2.2)',
        }}
      />

      {/* Floating 3D Depth Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/6 w-64 h-64 rounded-full bg-cyan-500/10 blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/6 w-80 h-80 rounded-full bg-amber-500/10 blur-[120px] animate-pulse" />
      </div>

      {/* RETRACTABLE 3D HYDRAULIC CUSTOMS DOORS */}
      <motion.div
        initial={isLoggingOut ? { x: '-102%', rotateY: -15 } : false}
        animate={isAccessGranted ? { x: '-102%', rotateY: -15 } : { x: 0, rotateY: 0 }}
        transition={{ duration: 1.2, ease: [0.77, 0, 0.175, 1], delay: isLoggingOut ? 0.1 : 0.4 }}
        className="absolute top-0 bottom-0 left-0 w-[50.5%] z-30 bg-gradient-to-r from-[#0a0e17] via-[#0d1320] to-[#080c14] border-r-2 border-cyan-500/40 pointer-events-none shadow-[20px_0_50px_rgba(0,0,0,0.9)] overflow-hidden"
        style={{ perspective: '1000px' }}
      >
        <div className="absolute top-0 bottom-0 right-0 w-3 bg-[repeating-linear-gradient(45deg,#f59e0b,#f59e0b_10px,#0f172a_10px,#0f172a_20px)] opacity-80 border-l border-amber-500/40" />
      </motion.div>

      <motion.div
        initial={isLoggingOut ? { x: '102%', rotateY: 15 } : false}
        animate={isAccessGranted ? { x: '102%', rotateY: 15 } : { x: 0, rotateY: 0 }}
        transition={{ duration: 1.2, ease: [0.77, 0, 0.175, 1], delay: isLoggingOut ? 0.1 : 0.4 }}
        className="absolute top-0 bottom-0 right-0 w-[50.5%] z-30 bg-gradient-to-l from-[#0a0e17] via-[#0d1320] to-[#080c14] border-l-2 border-cyan-500/40 pointer-events-none shadow-[-20px_0_50px_rgba(0,0,0,0.9)] overflow-hidden"
        style={{ perspective: '1000px' }}
      >
        <div className="absolute top-0 bottom-0 left-0 w-3 bg-[repeating-linear-gradient(45deg,#f59e0b,#f59e0b_10px,#0f172a_10px,#0f172a_20px)] opacity-80 border-r border-amber-500/40" />
      </motion.div>

      {/* CENTRAL 3D FLOATING CARD MODAL */}
      <div className="relative z-40 w-full max-w-[430px] mx-4 px-2" style={{ perspective: '1200px' }}>
        <AnimatePresence mode="wait">
          {isLoggingOut ? (
            /* LOGOUT GATE CLOSING MODAL CARD */
            <motion.div
              key="logout-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-slate-900/90 border border-rose-500/40 backdrop-blur-3xl rounded-3xl p-8 text-center shadow-[0_25px_60px_-15px_rgba(244,63,94,0.3)] text-slate-100 space-y-6"
            >
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl animate-pulse" />
                <div className="relative w-full h-full rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.6)]">
                  <Lock className="w-10 h-10 text-rose-400" />
                </div>
              </div>

              <div>
                <span className="inline-block px-3.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 border border-rose-400/40 text-rose-300 mb-2">
                  خروج امن
                </span>
                <h2 className="font-lalezar text-2xl text-slate-100 tracking-wide">
                  بستن گیت‌های راهبند گمرک...
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  قفل شدن ایمن راهبندهای مرزی، ابطال نشست و ثبت در لاگ
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-rose-500/30">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-400 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.9)]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (onLogoutComplete) onLogoutComplete();
                  }}
                  className="w-full mt-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 text-slate-950 font-black text-xs hover:from-cyan-300 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>ورود مجدد به سامانه</span>
                </button>
              </div>
            </motion.div>
          ) : !isAccessGranted ? (
            /* UNIFIED ACCESS CODE LOGIN CARD - iOS 27 VisionOS Glass Card */
            <motion.div
              key="login-card"
              initial={{ opacity: 0, scale: 0.92, rotateX: 10, y: 20 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, rotateX: -10, y: -30 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`ios-glass-card ios-specular rounded-3xl p-6 sm:p-8 text-center shadow-[0_30px_70px_-15px_rgba(0,0,0,0.95)] overflow-hidden border border-white/20 ${
                shake ? 'animate-shake' : ''
              }`}
            >
              {/* Header Badge */}
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-cyan-400/15 border border-cyan-400/40 text-cyan-200 text-xs font-semibold shadow-[0_0_15px_rgba(6,182,212,0.2)] backdrop-blur-xl">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>دیواره امنیتی ورود به سامانه گمرک</span>
                </div>
              </div>

              {/* Sleek 3D Metallic Emblem */}
              <div className="relative w-18 h-18 mx-auto mb-3" style={{ transformStyle: 'preserve-3d' }}>
                <div className="absolute inset-0 rounded-2xl blur-2xl bg-cyan-500/35" />
                <div className="relative w-full h-full rounded-2xl bg-gradient-to-tr from-slate-700/80 via-slate-800/90 to-slate-700/80 border border-white/25 p-0.5 shadow-2xl flex items-center justify-center backdrop-blur-xl">
                  <div className="w-full h-full bg-[#060a14]/90 rounded-[14px] flex items-center justify-center text-cyan-300 shadow-inner">
                    <KeyRound className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                  </div>
                </div>
              </div>

              <h1 className="font-lalezar text-2xl sm:text-3xl font-normal text-slate-100 tracking-wide drop-shadow-sm">
                احراز هویت و ورود
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                کد دسترسی خود را برای ورود امن به سامانه وارد نمایید
              </p>

              {/* Lockout Notification Banner */}
              {isLocked ? (
                <div className="mt-5 p-4 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs space-y-2 backdrop-blur-xl animate-pulse">
                  <div className="flex items-center justify-center gap-2 font-bold text-rose-300">
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                    <span>حساب به دلیل حملات بروت‌فورس موقتاً قفل است</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    لطفاً تا پایان زمان شمارنده زیر صبور باشید:
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono text-sm font-bold">
                    <Clock className="w-4 h-4 text-rose-400 animate-spin" />
                    <span>{lockoutSec} ثانیه</span>
                  </div>
                </div>
              ) : (
                /* Access Code Input Form */
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="text-right space-y-1.5">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={accessCode}
                        onChange={handleInput}
                        placeholder="کد دسترسی (رمز عبور)..."
                        autoFocus
                        disabled={isLocked}
                        maxLength={20}
                        className="w-full bg-slate-950/70 border border-white/20 rounded-2xl py-3.5 px-4 pl-11 text-center text-lg font-bold text-cyan-300 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] tracking-widest backdrop-blur-xl disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1 transition-colors"
                        title={showPassword ? 'مخفی کردن' : 'نمایش'}
                      >
                        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5 text-cyan-400" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-center gap-1.5 text-xs text-rose-200 bg-rose-500/20 border border-rose-500/40 py-2.5 px-3 rounded-2xl font-medium shadow-md backdrop-blur-xl"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={!accessCode || isLocked}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 text-slate-950 font-black text-sm hover:from-cyan-300 hover:to-blue-500 transition-all shadow-[0_10px_30px_rgba(6,182,212,0.35),inset_0_1.5px_0_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-97 cursor-pointer"
                  >
                    <span>احراز هویت و ورود</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Default Credentials Helper Note (Only if Default is active) */}
              {isDefault && !isLocked && (
                <div className="mt-4 p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 space-y-1 text-right backdrop-blur-md">
                  <div className="flex items-center gap-1 text-cyan-300 font-bold">
                    <Info className="w-3.5 h-3.5" />
                    <span>کدهای ورود پیش‌فرض سیستم:</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-300 pt-0.5">
                    <span>مدیر (دسترسی کامل): <strong className="text-cyan-300 font-mono">12345</strong></span>
                    <span>ناظر (مشاهده): <strong className="text-amber-300 font-mono">54321</strong></span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    * پس از ورود می‌توانید از بخش امنیت، این کدها را به رمزهای شخصی تغییر دهید.
                  </p>
                </div>
              )}

              {/* Minimalist Security Note */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>محافظت‌شده با رمزنگاری SHA-256 و فایروال محلی</span>
              </div>
            </motion.div>
          ) : (
            /* SLEEK SUCCESS LOADING STATE */
            <motion.div
              key="loading-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="bg-slate-900/90 border border-emerald-500/40 backdrop-blur-3xl rounded-3xl p-8 text-center shadow-[0_25px_60px_-15px_rgba(16,185,129,0.3)] text-slate-100 space-y-6"
            >
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-ping" />
                <div className="relative w-full h-full rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
              </div>

              <div>
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 mb-2 shadow-sm">
                  احراز هویت موفق
                </span>
                <h2 className="font-lalezar text-2xl text-slate-100 tracking-wide">
                  مجوز ورود صادر شد...
                </h2>
                <p className="text-xs text-slate-400 mt-1">تأیید امضای دیجیتال و بارگذاری دسترسی‌ها</p>
              </div>

              <div className="space-y-2">
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-emerald-500/30">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.9)]"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
