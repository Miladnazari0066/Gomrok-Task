import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  UserCheck,
  Sliders,
  Check,
  Lock,
  Unlock,
  PackageCheck,
  LogOut,
  FileText,
  PieChart,
  Cloud,
  Trash2,
  CheckCircle2,
  User,
} from 'lucide-react';
import { UserPermissions, UserPermissionsMap } from '../types';

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissionsMap: UserPermissionsMap;
  onSavePermissions: (updatedMap: UserPermissionsMap) => void;
}

export const DEFAULT_FULL_PERMISSIONS: UserPermissions = {
  canViewEntry: true,
  canCreateEntry: true,
  canEditEntry: true,
  canCreateBatch: true,
  canViewExit: true,
  canCreateExit: true,
  canUpdateExitStages: true,
  canViewLab: true,
  canCreateLab: true,
  canViewReports: true,
  canViewSummaryModal: true,
  canAccessCloudDb: true,
  canDeleteItems: true,
  canViewLetters: true,
  canManageLetters: true,
  canConfirmSata: true,
  canCloseCase: true,
  canEditCriticalClearance: true,
  canModifyCompletedExits: true,
  canManageTasks: true,
  canManageNotifications: true,
};

export const DEFAULT_VIEW_ONLY_PERMISSIONS: UserPermissions = {
  canViewEntry: true,
  canCreateEntry: false,
  canEditEntry: false,
  canCreateBatch: false,
  canViewExit: true,
  canCreateExit: false,
  canUpdateExitStages: false,
  canViewLab: true,
  canCreateLab: false,
  canViewReports: true,
  canViewSummaryModal: true,
  canAccessCloudDb: false,
  canDeleteItems: false,
  canViewLetters: true,
  canManageLetters: false,
  canConfirmSata: false,
  canCloseCase: false,
  canEditCriticalClearance: false,
  canModifyCompletedExits: false,
  canManageTasks: false,
  canManageNotifications: false,
};

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  isOpen,
  onClose,
  permissionsMap,
  onSavePermissions,
}) => {
  const [targetUser, setTargetUser] = useState<'یوسفی' | 'افسر'>('یوسفی');
  const [localMap, setLocalMap] = useState<UserPermissionsMap>(() => ({
    ...permissionsMap,
  }));
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentPerms = localMap[targetUser] || { ...DEFAULT_FULL_PERMISSIONS };

  const handleToggle = (key: keyof UserPermissions) => {
    setLocalMap((prev) => ({
      ...prev,
      [targetUser]: {
        ...prev[targetUser],
        [key]: !prev[targetUser][key],
      },
    }));
  };

  const handleApplyPreset = (preset: 'full' | 'view_only') => {
    const chosen = preset === 'full' ? DEFAULT_FULL_PERMISSIONS : DEFAULT_VIEW_ONLY_PERMISSIONS;
    setLocalMap((prev) => ({
      ...prev,
      [targetUser]: { ...chosen },
    }));
  };

  const handleSave = () => {
    onSavePermissions(localMap);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl animate-in fade-in">
      <div className="ios-glass-modal rounded-3xl p-5 sm:p-7 max-w-2xl w-full max-h-[92vh] flex flex-col space-y-5 text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.9)] border border-white/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/25 to-blue-500/20 border border-cyan-400/40 text-cyan-300 shadow-lg shadow-cyan-500/20 backdrop-blur-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-lalezar text-xl sm:text-2xl text-slate-100">
                مدیریت سطوح دسترسی کاربران (توسط نظری)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تعیین دقیق اختیارات و مجوزهای دسترسی برای کاربران «یوسفی» و «افسر»
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="ios-glass-card border border-cyan-400/30 bg-cyan-500/10 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-cyan-200 shrink-0">
          <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            شما با حساب <b>«نظری»</b> وارد شده‌اید. تغییرات سطوح دسترسی بلافاصله پس از ذخیره برای کاربران اعمال می‌شود.
          </span>
        </div>

        {/* User Selector Tabs */}
        <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-white/10 shrink-0 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setTargetUser('یوسفی')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              targetUser === 'یوسفی'
                ? 'bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>تنظیم دسترسی کاربر: <b>یوسفی</b></span>
          </button>

          <button
            type="button"
            onClick={() => setTargetUser('افسر')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              targetUser === 'افسر'
                ? 'bg-gradient-to-r from-amber-500/30 via-orange-500/30 to-amber-500/20 text-amber-200 border border-amber-400/50 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>تنظیم دسترسی کاربر: <b>افسر</b></span>
          </button>
        </div>

        {/* Presets Row */}
        <div className="flex items-center justify-between gap-2 shrink-0 ios-glass-card p-2.5 rounded-2xl border border-white/10">
          <span className="text-xs text-slate-400 font-semibold">قالب‌های آماده دسترسی:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyPreset('full')}
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer backdrop-blur-md"
            >
              اعمال دسترسی کامل
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('view_only')}
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer backdrop-blur-md"
            >
              اعمال فقط مشاهده
            </button>
          </div>
        </div>

        {/* Scrollable Permissions List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Section 1: Entry Goods */}
          <div className="ios-glass-card p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 border-b border-white/10 pb-2">
              <PackageCheck className="w-4 h-4 text-cyan-400" />
              <span>مجوزهای بخش ورود کالا</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <PermissionToggleItem
                label="مشاهده بخش ورود کالا"
                checked={currentPerms.canViewEntry}
                onChange={() => handleToggle('canViewEntry')}
              />
              <PermissionToggleItem
                label="ثبت کوتاژ ورودی جدید"
                checked={currentPerms.canCreateEntry}
                onChange={() => handleToggle('canCreateEntry')}
              />
              <PermissionToggleItem
                label="ویرایش اطلاعات کوتاژ ورودی"
                checked={currentPerms.canEditEntry}
                onChange={() => handleToggle('canEditEntry')}
              />
              <PermissionToggleItem
                label="تجمیع کوتاژها (بچ‌سازی)"
                checked={currentPerms.canCreateBatch}
                onChange={() => handleToggle('canCreateBatch')}
              />
            </div>
          </div>

          {/* Section 2: Exit Goods */}
          <div className="ios-glass-card p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-300 border-b border-white/10 pb-2">
              <LogOut className="w-4 h-4 text-blue-400" />
              <span>مجوزهای بخش خروج کالا</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <PermissionToggleItem
                label="مشاهده بخش خروج کالا"
                checked={currentPerms.canViewExit}
                onChange={() => handleToggle('canViewExit')}
              />
              <PermissionToggleItem
                label="ثبت کوتاژ خروجی جدید"
                checked={currentPerms.canCreateExit}
                onChange={() => handleToggle('canCreateExit')}
              />
              <PermissionToggleItem
                label="تایید و تغییر مراحل خروج (ارزیاب/جهاد/درب)"
                checked={currentPerms.canUpdateExitStages}
                onChange={() => handleToggle('canUpdateExitStages')}
              />
              <PermissionToggleItem
                label="مشاهده سوابق آزمایشگاه"
                checked={currentPerms.canViewLab}
                onChange={() => handleToggle('canViewLab')}
              />
              <PermissionToggleItem
                label="ثبت سابقه آزمایشگاه جدید"
                checked={currentPerms.canCreateLab}
                onChange={() => handleToggle('canCreateLab')}
              />
            </div>
          </div>

          {/* Section 3: Reports, Tools & System Operations */}
          <div className="ios-glass-card p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 border-b border-white/10 pb-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>مجوزهای گزارش‌گیری و ابزارها</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <PermissionToggleItem
                label="دسترسی به بخش گزارش‌گیری"
                checked={currentPerms.canViewReports}
                onChange={() => handleToggle('canViewReports')}
              />
              <PermissionToggleItem
                label="مشاهده خلاصه آمار تفکیکی کالاها"
                checked={currentPerms.canViewSummaryModal}
                onChange={() => handleToggle('canViewSummaryModal')}
              />
              <PermissionToggleItem
                label="مشاهده آرشیو تصاویر نامه‌ها"
                checked={currentPerms.canViewLetters !== false}
                onChange={() => handleToggle('canViewLetters')}
              />
              <PermissionToggleItem
                label="آپلود و حذف تصاویر نامه‌ها (مدیریت نامه‌ها)"
                checked={currentPerms.canManageLetters === true}
                onChange={() => handleToggle('canManageLetters')}
              />
              <PermissionToggleItem
                label="دسترسی به تنظیمات و همگام‌سازی ابری"
                checked={currentPerms.canAccessCloudDb}
                onChange={() => handleToggle('canAccessCloudDb')}
              />
              <PermissionToggleItem
                label="اجازه حذف کوتاژها و داده‌ها"
                checked={currentPerms.canDeleteItems}
                onChange={() => handleToggle('canDeleteItems')}
                danger
              />
            </div>
          </div>

          {/* Section 4: 90/10 Clearance, Sata, Closure, Daily Tasks & Notifications */}
          <div className="ios-glass-card p-4 rounded-2xl border border-amber-500/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 border-b border-white/10 pb-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>مجوزهای ترخیص ۹۰/۱۰، تایید ساتا، اختتام و وظایف</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <PermissionToggleItem
                label="تایید رسمی کد ساتا و آزادسازی ۱۰٪ باقی‌مانده"
                checked={currentPerms.canConfirmSata === true}
                onChange={() => handleToggle('canConfirmSata')}
                danger
              />
              <PermissionToggleItem
                label="تایید و اختتام نهایی پرونده (پس از خروج کامل)"
                checked={currentPerms.canCloseCase === true}
                onChange={() => handleToggle('canCloseCase')}
                danger
              />
              <PermissionToggleItem
                label="ثبت و ویرایش مراحل حساس ترخیص ۹۰/۱۰"
                checked={currentPerms.canEditCriticalClearance === true}
                onChange={() => handleToggle('canEditCriticalClearance')}
              />
              <PermissionToggleItem
                label="ویرایش یا حذف تراکنش‌های خروج فیزیکی ثبت‌شده"
                checked={currentPerms.canModifyCompletedExits === true}
                onChange={() => handleToggle('canModifyCompletedExits')}
                danger
              />
              <PermissionToggleItem
                label="ایجاد، ویرایش و انجام کارهای روزانه"
                checked={currentPerms.canManageTasks !== false}
                onChange={() => handleToggle('canManageTasks')}
              />
              <PermissionToggleItem
                label="مدیریت و بایگانی اعلان‌ها"
                checked={currentPerms.canManageNotifications !== false}
                onChange={() => handleToggle('canManageNotifications')}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between shrink-0">
          {savedSuccess ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold bg-emerald-500/15 px-3 py-1.5 rounded-xl border border-emerald-400/40 backdrop-blur-md">
              <CheckCircle2 className="w-4 h-4" />
              <span>سطوح دسترسی کاربر {targetUser} با موفقیت ذخیره شد.</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">
              تغییرات فوق فقط برای کاربر {targetUser} اعمال خواهد شد.
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl ios-glass-btn text-slate-300 font-bold text-xs cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl ios-glass-btn-cyan text-xs font-black cursor-pointer shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              ذخیره تغییرات دسترسی
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PermissionToggleItemProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  danger?: boolean;
}

const PermissionToggleItem: React.FC<PermissionToggleItemProps> = ({
  label,
  checked,
  onChange,
  danger = false,
}) => {
  return (
    <div
      onClick={onChange}
      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer backdrop-blur-md ${
        checked
          ? danger
            ? 'bg-rose-500/20 border-rose-400/40 text-rose-100 shadow-sm shadow-rose-500/20'
            : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100 shadow-sm shadow-cyan-500/20'
          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
      }`}
    >
      <span className="font-semibold text-xs">{label}</span>
      <div
        className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
          checked
            ? danger
              ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/40'
              : 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/40'
            : 'bg-white/10 text-transparent'
        }`}
      >
        <Check className="w-3.5 h-3.5 stroke-[3]" />
      </div>
    </div>
  );
};
