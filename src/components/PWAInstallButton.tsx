import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) return;
      return;
    }
    setShowGuide(true);
  };

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAction}
        className={`flex items-center gap-1.5 text-xs font-bold text-cyan-200 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
          compact ? 'px-3 py-1.5 rounded-xl' : 'px-3.5 py-1.5 rounded-full'
        }`}
        title="نصب مدیریت کارهای گمرک روی دستگاه"
      >
        <Download className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
        <span>نصب اپلیکیشن</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-vazir dir-rtl">
          <div className="glass-panel max-w-sm w-full p-6 space-y-4 text-right border border-white/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="pwa-192x192.png"
                  alt="مدیریت کارهای گمرک"
                  className="w-10 h-10 rounded-xl border border-cyan-400/40 object-cover"
                />
                <div>
                  <h3 className="font-lalezar text-lg text-slate-100">نصب مدیریت کارهای گمرک</h3>
                  <p className="text-[11px] text-slate-400">Customs Task Management</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p className="flex items-center gap-2">
                  <Share className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>۱. در نوار پایین مرورگر سافاری روی دکمه اشتراک‌گذاری (Share) بزنید.</span>
                </p>
                <p className="flex items-center gap-2">
                  <PlusSquare className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>۲. گزینه «Add to Home Screen» را انتخاب و تایید کنید.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>از منوی بالای مرورگر گزینه «Install app» یا «Add to Home screen» را انتخاب کنید.</span>
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl ios-glass-btn-cyan text-xs font-bold cursor-pointer"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
