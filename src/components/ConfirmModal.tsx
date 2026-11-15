import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  text: string;
  okLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  text,
  okLabel = 'تأیید',
  cancelLabel = 'انصراف',
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-md ios-glass-modal p-6 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.9)] rounded-3xl border border-white/20"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-lg shadow-amber-500/15 backdrop-blur-xl">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="font-lalezar text-2xl font-normal text-slate-100">
                {title}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">{text}</p>
            <div className="flex gap-3">
              <button
                onClick={onConfirm}
                className="flex-1 py-3 px-4 rounded-xl ios-glass-btn-primary font-bold text-sm cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {okLabel}
              </button>
              <button
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-xl ios-glass-btn text-slate-300 hover:text-slate-100 text-sm font-semibold cursor-pointer"
              >
                {cancelLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
