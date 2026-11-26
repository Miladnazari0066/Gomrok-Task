import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Lock, AlertCircle, Trash2 } from 'lucide-react';
import { verifyDeletePassword, DELETE_WRONG_PASSWORD_MESSAGE } from '../utils/deleteGuard';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  text: string;
  okLabel?: string;
  cancelLabel?: string;
  requireDeletePassword?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  text,
  okLabel = 'تأیید',
  cancelLabel = 'انصراف',
  requireDeletePassword = false,
  onConfirm,
  onCancel,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPasswordInput('');
      setPasswordError('');
      if (requireDeletePassword) {
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    }
  }, [isOpen, requireDeletePassword]);

  const handleConfirmClick = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (requireDeletePassword) {
      if (!verifyDeletePassword(passwordInput)) {
        setPasswordError(DELETE_WRONG_PASSWORD_MESSAGE);
        setPasswordInput('');
        inputRef.current?.focus();
        return;
      }
    }
    onConfirm();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md ios-glass-modal p-6 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.9)] rounded-3xl border ${
              requireDeletePassword ? 'border-rose-500/35' : 'border-white/20'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`p-2.5 rounded-2xl border shadow-lg backdrop-blur-xl ${
                  requireDeletePassword
                    ? 'bg-rose-500/20 border-rose-400/40 text-rose-300 shadow-rose-500/15'
                    : 'bg-amber-500/20 border-amber-400/40 text-amber-300 shadow-amber-500/15'
                }`}
              >
                {requireDeletePassword ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <HelpCircle className="w-5 h-5" />
                )}
              </div>
              <h3 className="font-lalezar text-2xl font-normal text-slate-100">
                {title}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
              {text}
            </p>

            <form onSubmit={handleConfirmClick} className="space-y-4">
              {requireDeletePassword && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-rose-200">
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    <span>رمز تایید حذف (اختصاصی حساب میلاد نظری)</span>
                  </label>
                  <input
                    ref={inputRef}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) setPasswordError('');
                    }}
                    placeholder="رمز تایید حذف را وارد کنید..."
                    className={`w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-center font-mono tracking-widest outline-none ${
                      passwordError ? 'border-rose-500' : 'border-rose-400/30'
                    }`}
                  />
                  {passwordError && (
                    <p className="text-xs text-rose-300 flex items-center gap-1.5 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>{passwordError}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm cursor-pointer shadow-lg transition-all ${
                    requireDeletePassword
                      ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-rose-500/25'
                      : 'ios-glass-btn-primary shadow-amber-500/20'
                  }`}
                >
                  {okLabel}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-3 px-4 rounded-xl ios-glass-btn text-slate-300 hover:text-slate-100 text-sm font-semibold cursor-pointer"
                >
                  {cancelLabel}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
