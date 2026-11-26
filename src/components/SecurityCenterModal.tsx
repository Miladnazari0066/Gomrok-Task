import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  KeyRound,
  FileText,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  Clock,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
  Server,
  UserCheck,
  Activity,
  History,
} from 'lucide-react';
import {
  SecurityLogEvent,
  getSecurityAuditLogs,
  clearSecurityAuditLogs,
  isUsingDefaultPasswords,
  getIdleTimeoutMinutes,
  setIdleTimeoutMinutes,
  updateAdminAccessCode,
  updateViewerAccessCode,
  updateMasterPassword,
  verifyMasterPassword,
  getLockoutRemainingSeconds,
} from '../utils/security';
import { fa } from '../utils/jalali';

interface SecurityCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordsUpdated?: () => void;
  onOpenPermissionsModal?: () => void;
  canManagePermissions?: boolean;
  canDelete?: boolean;
  onRequestProtectedDelete?: (
    title: string,
    text: string,
    onConfirmed: () => void | Promise<void>
  ) => void;
  addToast: (text: string, type?: 'ok' | 'err' | 'info') => void;
}

export const SecurityCenterModal: React.FC<SecurityCenterModalProps> = ({
  isOpen,
  onClose,
  onPasswordsUpdated,
  onOpenPermissionsModal,
  canManagePermissions = false,
  canDelete = false,
  onRequestProtectedDelete,
  addToast,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'passwords' | 'logs'>('overview');
  const [logs, setLogs] = useState<SecurityLogEvent[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'danger' | 'warning' | 'info'>('all');

  // Password Change Form States
  const [currentMasterPass, setCurrentMasterPass] = useState('');
  const [newAdminCode, setNewAdminCode] = useState('');
  const [confirmAdminCode, setConfirmAdminCode] = useState('');
  const [newViewerCode, setNewViewerCode] = useState('');
  const [newMasterPass, setNewMasterPass] = useState('');
  const [showCodes, setShowCodes] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // Idle Timeout State
  const [idleTimeout, setIdleTimeout] = useState<number>(() => getIdleTimeoutMinutes());

  // Confirm Clear Logs
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

  // Refresh logs when modal is open
  useEffect(() => {
    if (isOpen) {
      setLogs(getSecurityAuditLogs());
      setIdleTimeout(getIdleTimeoutMinutes());
      setPassError('');
      setPassSuccess('');
      setCurrentMasterPass('');
      setNewAdminCode('');
      setConfirmAdminCode('');
      setNewViewerCode('');
      setNewMasterPass('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTimeoutChange = (val: number) => {
    setIdleTimeout(val);
    setIdleTimeoutMinutes(val);
    addToast(
      val === 0
        ? 'قفل خودکار بر اثر عدم فعالیت غیرفعال گردید.'
        : `قفل خودکار سامانه روی ${fa(val)} دقیقه تنظیم شد.`,
      'ok'
    );
  };

  const handleUpdateCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    // Must verify current master password or admin code first
    if (!currentMasterPass) {
      setPassError('لطفاً رمز عبور فعلی مدیریت را برای تایید هویت وارد کنید.');
      return;
    }

    if (!verifyMasterPassword(currentMasterPass)) {
      setPassError('رمز عبور فعلی مدیریت نادرست است.');
      return;
    }

    let changedAny = false;

    // Check Admin Code update
    if (newAdminCode.trim()) {
      if (newAdminCode.trim().length < 4) {
        setPassError('کد دسترسی مدیر باید حداقل ۴ رقم یا کاراکتر باشد.');
        return;
      }
      if (confirmAdminCode && newAdminCode.trim() !== confirmAdminCode.trim()) {
        setPassError('کد دسترسی جدید مدیر با تکرار آن همخوانی ندارد.');
        return;
      }
      try {
        updateAdminAccessCode(newAdminCode.trim());
        changedAny = true;
      } catch (err: any) {
        setPassError(err?.message || 'خطا در ثبت کد مدیر');
        return;
      }
    }

    // Check Viewer Code update
    if (newViewerCode.trim()) {
      if (newViewerCode.trim().length < 4) {
        setPassError('کد دسترسی ناظر باید حداقل ۴ رقم باشد.');
        return;
      }
      try {
        updateViewerAccessCode(newViewerCode.trim());
        changedAny = true;
      } catch (err: any) {
        setPassError(err?.message || 'خطا در ثبت کد ناظر');
        return;
      }
    }

    // Check Master Password update
    if (newMasterPass.trim()) {
      if (newMasterPass.trim().length < 4) {
        setPassError('رمز اصلی عملیات حساس باید حداقل ۴ کاراکتر باشد.');
        return;
      }
      try {
        updateMasterPassword(newMasterPass.trim());
        changedAny = true;
      } catch (err: any) {
        setPassError(err?.message || 'خطا در ثبت رمز اصلی');
        return;
      }
    }

    if (!changedAny) {
      setPassError('هیچ رمز جدیدی برای تغییر وارد نشده است.');
      return;
    }

    setPassSuccess('رمزهای امنیتی سامانه با موفقیت در لایه رمزنگاری بروزرسانی شدند.');
    setCurrentMasterPass('');
    setNewAdminCode('');
    setConfirmAdminCode('');
    setNewViewerCode('');
    setNewMasterPass('');
    setLogs(getSecurityAuditLogs());

    if (onPasswordsUpdated) onPasswordsUpdated();
    addToast('رمزهای امنیتی سامانه با موفقیت ذخیره شدند', 'ok');
  };

  const handleClearLogs = () => {
    if (!canDelete) return;
    clearSecurityAuditLogs();
    setLogs(getSecurityAuditLogs());
    setConfirmClearLogs(false);
    addToast('سوابق و لاگ‌های امنیتی پاکسازی شدند.', 'info');
  };

  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `security_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('فایل گزارش لاگ‌های امنیتی با موفقیت دانلود شد.', 'ok');
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.severity === logFilter;
  });

  const isDefaultCodes = isUsingDefaultPasswords();
  const lockoutRemaining = getLockoutRemainingSeconds();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center safe-modal-backdrop sm:p-4 bg-black/80 backdrop-blur-xl animate-in fade-in font-vazir dir-rtl select-none"
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="ios-glass-modal rounded-3xl p-4 sm:p-7 max-w-3xl w-full max-h-[90dvh] flex flex-col space-y-4 text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.95)] border border-white/20 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/25 via-blue-500/20 to-emerald-500/20 border border-cyan-400/40 text-cyan-300 shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-lalezar text-lg sm:text-2xl text-slate-100">
                  مرکز امنیت سامانه
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>محافظت فعال</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                کدهای دسترسی، محافظت بروت‌فورس، قفل خودکار و وقایع
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
            title="بستن پنجره"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>وضعیت سپر امنیتی</span>
          </button>

          <button
            onClick={() => setActiveTab('passwords')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'passwords'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>تغییر رمزها و کدهای دسترسی</span>
            {isDefaultCodes && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <History className="w-4 h-4" />
            <span>لاگ وقایع امنیتی</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-slate-300 font-mono">
              {fa(logs.length)}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-slate-200">
          {/* TAB 1: SECURITY OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Caution Banner if Default Passwords in use */}
              {isDefaultCodes && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-start gap-3 backdrop-blur-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-amber-300">
                      هشدار امنیتی: کدهای دسترسی پیش‌فرض فعال هستند!
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      برای جلوگیری از نفوذ افراد غیرمجاز و تکمیل سپر امنیتی سامانه، لطفاً از تب
                      «تغییر رمزها» کد دسترسی مدیر و ناظر را به یک کد اختصاصی تغییر دهید.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Layer 1: Cryptographic Protection */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      رمزنگاری قوی کدهای دسترسی
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      SHA-256 + Salt
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    هیچ رمزی به صورت متنی (Plaintext) در سامانه ذخیره نمی‌شود و تمام دسترسی‌ها از طریق هشینگ یک‌طرفه با سالت تصادفی ارزیابی می‌شوند.
                  </p>
                </div>

                {/* Layer 2: Brute-Force Rate Limiting */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      سپر ضد حملات بروت‌فورس
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      ۵ تلاش / ۶۰ ثانیه قفل
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    در صورت ۵ بار وارد کردن اشتباه کد، سامانه به طور خودکار به مدت ۶۰ ثانیه مسدود شده و تلاش‌های مشکوک در لاگ ثبت می‌شود.
                  </p>
                </div>

                {/* Layer 3: Role-Based Authorization */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-400" />
                      تفکیک سطح دسترسی مدیر و ناظر
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      RBAC سخت‌گیرانه
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    کاربران بازدیدکننده به هیچ وجه توانایی حذف یا دستکاری اسناد، تجمیع‌ها و مدارک را ندارند و عملیات حساس با گیت تأیید مدیریت محافظت شده است.
                  </p>
                </div>

                {/* Layer 4: Session Security & Auto Lock */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" />
                      قفل خودکار به هنگام بی‌کاری
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {idleTimeout === 0 ? 'غیرفعال' : `${fa(idleTimeout)} دقیقه`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    اگر اپراتور سیستم را ترک کند، بعد از زمان معین سامانه به صورت خودکار قفل شده و نیازمند وارد کردن مجدد کد خواهد بود.
                  </p>
                </div>
              </div>

              {/* Inactivity Auto-Lock Setting Selector */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-200">
                      تنظیم زمان قفل خودکار بی‌کاری (Inactivity Auto-Lock):
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    فعلی: <strong className="text-cyan-300">{idleTimeout === 0 ? 'غیرفعال' : `${fa(idleTimeout)} دقیقه`}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[5, 15, 30, 60, 0].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleTimeoutChange(mins)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        idleTimeout === mins
                          ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {mins === 0 ? 'غیرفعال' : `${fa(mins)} دقیقه`}
                    </button>
                  ))}
                </div>
              </div>

              {canManagePermissions && onOpenPermissionsModal && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-indigo-500/15 border border-cyan-400/35 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-cyan-400" />
                      مدیریت سطوح دسترسی و تفکیک مجوز اپراتورها (نظری / یوسفی / افسر)
                    </span>
                    <p className="text-[11px] text-slate-300">
                      تعیین مجوز تایید کد ساتا، اختتام نهایی پرونده، ویرایش خروج‌های فیزیکی و مدیریت وظایف برای هر کاربر
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPermissionsModal();
                    }}
                    className="px-4 py-2 rounded-xl ios-glass-btn-cyan text-xs font-bold cursor-pointer shrink-0"
                  >
                    تنظیم مجوزهای کاربران
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PASSWORDS CONFIGURATION */}
          {activeTab === 'passwords' && (
            <form onSubmit={handleUpdateCredentials} className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-200">
                      تغییر کدهای امنیتی و رمزهای گمرک
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCodes(!showCodes)}
                    className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    {showCodes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showCodes ? 'پنهان‌سازی' : 'نمایش ارقام'}</span>
                  </button>
                </div>

                {/* Current Master Password */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    رمز عبور فعلی مدیریت (جهت تأیید احراز هویت):
                  </label>
                  <input
                    type={showCodes ? 'text' : 'password'}
                    value={currentMasterPass}
                    onChange={(e) => setCurrentMasterPass(e.target.value)}
                    placeholder="رمز فعلی مدیریت (پیش‌فرض: milad یا 12345)"
                    className="glass-input w-full py-2.5 px-3 rounded-xl text-xs font-mono ltr"
                    required
                  />
                </div>

                <div className="h-px bg-white/10 my-2" />

                {/* New Admin Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      کد دسترسی جدید مدیر (پیش‌فرض: 12345):
                    </label>
                    <input
                      type={showCodes ? 'text' : 'password'}
                      value={newAdminCode}
                      onChange={(e) => setNewAdminCode(e.target.value)}
                      placeholder="حداقل ۴ کاراکتر..."
                      className="glass-input w-full py-2.5 px-3 rounded-xl text-xs font-mono ltr"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      تکرار کد جدید مدیر:
                    </label>
                    <input
                      type={showCodes ? 'text' : 'password'}
                      value={confirmAdminCode}
                      onChange={(e) => setConfirmAdminCode(e.target.value)}
                      placeholder="تکرار کد جدید مدیر..."
                      className="glass-input w-full py-2.5 px-3 rounded-xl text-xs font-mono ltr"
                    />
                  </div>
                </div>

                {/* New Viewer Code */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    کد دسترسی ناظر / بازدیدکننده (پیش‌فرض: 54321):
                  </label>
                  <input
                    type={showCodes ? 'text' : 'password'}
                    value={newViewerCode}
                    onChange={(e) => setNewViewerCode(e.target.value)}
                    placeholder="کد جدید ناظر..."
                    className="glass-input w-full py-2.5 px-3 rounded-xl text-xs font-mono ltr"
                  />
                  <p className="text-[10px] text-slate-400">
                    این کد به مراجعین یا کاربران فقط‌خواندنی داده می‌شود و اجازه دستکاری اسناد ندارد.
                  </p>
                </div>

                {/* New Master Action Password */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    رمز اصلی عملیات حساس (تأیید حذف/ویرایش اسناد):
                  </label>
                  <input
                    type={showCodes ? 'text' : 'password'}
                    value={newMasterPass}
                    onChange={(e) => setNewMasterPass(e.target.value)}
                    placeholder="رمز اختصاصی مدیر برای حذف/ویرایش..."
                    className="glass-input w-full py-2.5 px-3 rounded-xl text-xs font-mono ltr"
                  />
                </div>
              </div>

              {passError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl ios-glass-btn-primary font-bold text-xs sm:text-sm cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>ذخیره و فعال‌سازی رمزهای جدید</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3 animate-in fade-in">
              {/* Filter & Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">فیلتر:</span>
                  {(['all', 'danger', 'warning', 'info'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setLogFilter(sev)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        logFilter === sev
                          ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sev === 'all'
                        ? 'همه'
                        : sev === 'danger'
                        ? 'خطرناک/قفل'
                        : sev === 'warning'
                        ? 'هشدارها'
                        : 'عادی'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportLogs}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 cursor-pointer transition-all"
                    title="دانلود فایل لاگ"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>خروجی لاگ (JSON)</span>
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onRequestProtectedDelete) {
                          onRequestProtectedDelete(
                            'پاکسازی سوابق امنیتی',
                            'آیا از پاکسازی تمامی سوابق امنیتی سیستم اطمینان دارید؟',
                            handleClearLogs
                          );
                        } else {
                          setConfirmClearLogs(true);
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 cursor-pointer transition-all"
                      title="پاکسازی لاگ‌ها"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>پاکسازی</span>
                    </button>
                  )}
                </div>
              </div>

              {confirmClearLogs && canDelete && !onRequestProtectedDelete && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs flex items-center justify-between gap-2">
                  <span className="text-rose-200">
                    آیا از پاکسازی تمامی سوابق امنیتی سیستم اطمینان دارید؟
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleClearLogs}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                    >
                      بله، پاک شود
                    </button>
                    <button
                      onClick={() => setConfirmClearLogs(false)}
                      className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}

              {/* Log List */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    هیچ رویدادی در این فیلتر ثبت نشده است.
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 backdrop-blur-md transition-all ${
                        log.severity === 'danger'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-200'
                          : log.severity === 'warning'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                          : 'bg-white/5 border-white/10 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold flex items-center gap-1.5">
                          {log.severity === 'danger' ? (
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : log.severity === 'warning' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          <span>{log.description}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                          {log.jalaliTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5">
                        <span>کاربر: <strong className="text-slate-200">{log.user}</strong></span>
                        <span>نقش: <strong className="text-slate-200">{log.role}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-white/10 pt-3 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>حریم امنیتی گمرک مجهز به استانداردهای حفاظت از داده‌ها و فایروال محلی</span>
          </div>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl ios-glass-btn text-slate-200 hover:text-white font-semibold cursor-pointer"
          >
            بستن
          </button>
        </div>
      </motion.div>
    </div>
  );
};
