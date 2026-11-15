import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, KeyRound, ShieldAlert, AlertCircle, Clock, Info } from 'lucide-react';
import {
  verifyMasterPassword,
  isAccountLocked,
  getLockoutRemainingSeconds,
  recordFailedAttempt,
  resetFailedAttempts,
  isUsingDefaultPasswords,
  logSecurityEvent,
} from '../utils/security';

interface PasswordModalProps {
  isOpen: boolean;
  message: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  message,
  onSuccess,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [lockoutSec, setLockoutSec] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setShake(false);
      setLockoutSec(getLockoutRemainingSeconds());
    }
  }, [isOpen]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = password.trim();

    if (isAccountLocked()) {
      const rem = getLockoutRemainingSeconds();
      setLockoutSec(rem);
      setError(`سامانه به دلیل تلاش‌های مکرر به مدت ${rem} ثانیه مسدود است.`);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!clean) {
      setError('لطفاً رمز دسترسی مدیریت را وارد فرمایید.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const isValid = verifyMasterPassword(clean);

    if (isValid) {
      resetFailedAttempts();
      logSecurityEvent({
        type: 'login_success',
        user: 'مدیر',
        role: 'admin',
        description: 'تأیید موفقیت‌آمیز رمز مدیریت جهت انجام عملیات حساس',
        severity: 'info',
      });
      onSuccess();
    } else {
      const attempt = recordFailedAttempt('تأیید عملیات حساس');
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);

      if (attempt.locked) {
        setLockoutSec(attempt.remainingSeconds);
        setError(`حساب به دلیل ۵ بار اشتباه به مدت ${attempt.remainingSeconds} ثانیه قفل شد.`);
      } else {
        setError(`رمز مدیریت نادرست است. (${attempt.attemptsLeft} تلاش مجاز باقی‌مانده)`);
      }
    }
  };

  const isLocked = lockoutSec > 0;
  const isDefault = isUsingDefaultPasswords();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl font-vazir dir-rtl select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`w-full max-w-md ios-glass-modal p-6 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.9)] rounded-3xl border border-white/20 ${
              shake ? 'animate-shake' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-lg shadow-amber-500/15 backdrop-blur-xl">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-lalezar text-2xl font-normal text-slate-100">
                تأیید مجوز مدیریت
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">{message}</p>

            {isLocked ? (
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs text-center space-y-2 mb-4 backdrop-blur-xl">
                <div className="flex items-center justify-center gap-1.5 font-bold text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>سیستم موقتاً مسدود است</span>
                </div>
                <div className="flex items-center justify-center gap-1 font-mono text-sm font-bold text-rose-300">
                  <Clock className="w-4 h-4 animate-spin text-rose-400" />
                  <span>{lockoutSec} ثانیه</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز دسترسی مدیریت را وارد کنید"
                    autoFocus
                    disabled={isLocked}
                    className="glass-input w-full py-3.5 pr-10 pl-4 text-center ltr tracking-widest text-sm rounded-2xl font-mono disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="text-xs text-rose-300 bg-rose-500/20 border border-rose-400/30 p-2.5 rounded-xl font-medium text-center backdrop-blur-md flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                {isDefault && (
                  <div className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl text-center backdrop-blur-md flex items-center justify-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>رمز پیش‌فرض اولیه: milad یا 12345 (قابل تغییر در امنیت)</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isLocked || !password}
                    className="flex-1 py-3 px-4 rounded-xl ios-glass-btn-primary font-bold text-sm cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-40"
                  >
                    تأیید و ادامه
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 px-4 rounded-xl ios-glass-btn text-slate-300 hover:text-slate-100 text-sm font-semibold cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
