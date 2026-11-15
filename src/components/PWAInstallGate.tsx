import React, { useState } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { DeviceEnvironment } from '../hooks/useDeviceEnvironment';

interface PWAInstallGateProps {
  device: DeviceEnvironment;
  onBypassPreview: () => void;
}

export const PWAInstallGate: React.FC<PWAInstallGateProps> = ({
  device,
  onBypassPreview,
}) => {
  const { isInstallable, isIOS, isAndroid, install } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [promptDeclined, setPromptDeclined] = useState(false);

  const handleInstallClick = async () => {
    setInstalling(true);
    setPromptDeclined(false);
    try {
      const ok = await install();
      if (!ok) {
        setPromptDeclined(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-[100svh] w-full bg-[#040711] text-slate-100 flex items-center justify-center p-4 sm:p-6 pt-safe pb-safe font-vazir"
    >
      <div className="glass-panel max-w-md w-full p-6 sm:p-8 space-y-6 text-right border border-white/18">
        {/* App Logo & Bilingual Identity */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-24 h-24 rounded-3xl overflow-hidden border border-cyan-400/40 shadow-[0_16px_40px_rgba(6,182,212,0.25)] bg-[#071A21] flex items-center justify-center">
            <img
              src="pwa-192x192.png"
              alt="Customs Task Management Logo"
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <h1 className="font-lalezar text-2xl sm:text-3xl text-slate-100 tracking-wide">
              مدیریت کارهای گمرک
            </h1>
            <p className="text-xs font-mono text-cyan-300 tracking-wide mt-0.5">
              Customs Task Management
            </p>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
            برای اجرای پایدار، بدون پرش صفحه، تمام‌صفحه و دسترسی سریع روی موبایل، ابتدا این وب‌اپلیکیشن را روی صفحه اصلی دستگاه خود نصب کنید و سپس از آیکون نصب‌شده وارد شوید.
          </p>
        </div>

        {/* Device Detection Summary */}
        <div className="glass-panel-subtle p-3.5 rounded-2xl border border-white/10 flex items-center justify-between text-xs">
          <span className="text-slate-400">محیط شناسایی‌شده:</span>
          <span className="font-bold text-cyan-200 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>
              {device.os === 'ios'
                ? 'آیفون / آیپد (iOS Safari)'
                : device.os === 'android'
                ? 'اندروید (Mobile Web)'
                : 'مرورگر موبایل'}
            </span>
          </span>
        </div>

        {/* OS-Specific Install Instructions / Native Trigger */}
        {isIOS ? (
          <div className="space-y-3 bg-slate-950/70 border border-cyan-500/25 rounded-2xl p-4 text-xs text-slate-200">
            <h2 className="font-bold text-cyan-300 text-sm">مراحل نصب در سافاری (iOS):</h2>
            <div className="flex items-start gap-2.5 leading-relaxed">
              <Share className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>۱. در نوار پایین مرورگر Safari، دکمه اشتراک‌گذاری (Share) را لمس کنید.</span>
            </div>
            <div className="flex items-start gap-2.5 leading-relaxed">
              <PlusSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>۲. به پایین اسکرول کرده و گزینه «Add to Home Screen» را انتخاب و Add را بزنید.</span>
            </div>
            <div className="flex items-start gap-2.5 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>۳. سپس برنامه را از آیکون «کارهای گمرک» در صفحه اصلی گوشی باز کنید.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isInstallable ? (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl ios-glass-btn-cyan text-sm font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{installing ? 'در حال آماده‌سازی نصب...' : 'نصب و افزودن به صفحه اصلی'}</span>
              </button>
            ) : (
              <div className="space-y-2.5 bg-slate-950/70 border border-cyan-500/25 rounded-2xl p-4 text-xs text-slate-200 leading-relaxed">
                <h2 className="font-bold text-cyan-300 text-sm">
                  {isAndroid ? 'راهنمای نصب در کروم / اندروید:' : 'راهنمای نصب در مرورگر:'}
                </h2>
                <p className="flex items-start gap-2">
                  <MoreVertical className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>۱. منوی سه نقطه بالای مرورگر را باز کنید.</span>
                </p>
                <p className="flex items-start gap-2">
                  <Download className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>۲. گزینه «Install app» یا «Add to Home screen» را بزنید و نصب را تایید کنید.</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>۳. پس از نصب، سامانه را از صفحه اصلی گوشی اجرا نمایید.</span>
                </p>
              </div>
            )}

            {promptDeclined && (
              <p className="text-[11px] text-amber-300 text-center">
                پنجره نصب بسته شد. می‌توانید مجدداً دکمه نصب را بزنید یا از منوی مرورگر نصب کنید.
              </p>
            )}
          </div>
        )}

        {/* Preview Bypass (Only available inside embedded AI Studio / localhost preview environments) */}
        {device.isPreviewEnvironment && (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onBypassPreview}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl ios-glass-btn text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>ادامه در حالت پیش‌نمایش بدون نصب</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
