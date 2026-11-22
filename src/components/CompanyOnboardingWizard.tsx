import React, { useState, useMemo } from 'react';
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Upload,
  Trash2,
  PackageCheck,
  LogOut,
  Layers,
  UserCheck,
  Users,
  ShieldCheck,
  Plus,
  Edit3,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Sliders,
  Copy,
} from 'lucide-react';
import type {
  BusinessOperationMode,
  CompanyMember,
  CompanyProfile,
  CompanyRole,
  OnboardingPayload,
  OnboardingRoleDraft,
  OnboardingUserDraft,
  UserPermissions,
} from '../types';
import {
  PERMISSION_GROUPS,
  countEnabledPermissions,
  createDefaultOnboardingRoles,
  flagsToOperationMode,
  operationModeToFlags,
  EMPTY_PERMISSIONS,
} from '../utils/permissions';
import {
  applyRestartOnboardingApi,
  claimLegacyCompany,
  completeCompanyOnboarding,
} from '../services/workspaceApi';
import { SUPABASE_SQL_SCHEMA } from '../utils/sqlSchema';
import { getSupabase } from '../lib/supabase';
import { fa } from '../utils/jalali';

interface CompanyOnboardingWizardProps {
  mode: 'create' | 'restart' | 'claim_legacy';
  initialCompany?: CompanyProfile | null;
  initialRoles?: CompanyRole[];
  existingMembers?: CompanyMember[];
  currentOwner?: CompanyMember | null;
  onCancel?: () => void;
  onComplete: (result: { company: CompanyProfile; createdUsersCount: number }) => void;
}

const STEPS = [
  { id: 1, title: 'اطلاعات شرکت', short: 'شرکت' },
  { id: 2, title: 'عملیات گمرکی', short: 'عملیات' },
  { id: 3, title: 'مدیر ارشد', short: 'مالک' },
  { id: 4, title: 'کاربران اضافی', short: 'کاربران' },
  { id: 5, title: 'نقش‌ها و دسترسی', short: 'نقش‌ها' },
  { id: 6, title: 'بازبینی و تایید', short: 'تایید' },
];

function compressLogoImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(ev.target?.result || ''));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', 0.92));
      };
      img.onerror = () => reject(new Error('تصویر لوگو معتبر نیست'));
      img.src = String(ev.target?.result || '');
    };
    reader.onerror = () => reject(new Error('خطا در خواندن فایل لوگو'));
    reader.readAsDataURL(file);
  });
}

export const CompanyOnboardingWizard: React.FC<CompanyOnboardingWizardProps> = ({
  mode,
  initialCompany,
  initialRoles,
  existingMembers = [],
  currentOwner,
  onCancel,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Step 1: Company Info
  const [companyName, setCompanyName] = useState(initialCompany?.name || '');
  const [logoUrl, setLogoUrl] = useState(initialCompany?.logoUrl || '');
  const [registrationNumber, setRegistrationNumber] = useState(initialCompany?.registrationNumber || '');
  const [nationalId, setNationalId] = useState(initialCompany?.nationalId || '');
  const [phone, setPhone] = useState(initialCompany?.phone || '');
  const [companyEmail, setCompanyEmail] = useState(initialCompany?.email || '');
  const [address, setAddress] = useState(initialCompany?.address || '');

  // Step 2: Business Operations
  const [operationMode, setOperationMode] = useState<BusinessOperationMode>(() =>
    initialCompany
      ? flagsToOperationMode(initialCompany.enableImport, initialCompany.enableExport)
      : 'both'
  );

  // Step 3: Initial Owner Account
  const [ownerFullName, setOwnerFullName] = useState(currentOwner?.fullName || '');
  const [ownerEmail, setOwnerEmail] = useState(currentOwner?.email || '');
  const [ownerUsername, setOwnerUsername] = useState(currentOwner?.username || '');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState('');
  const [showOwnerPass, setShowOwnerPass] = useState(false);

  // Step 4: Additional Users
  const [additionalUsers, setAdditionalUsers] = useState<OnboardingUserDraft[]>([]);
  const [draftUser, setDraftUser] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    roleKey: 'import_operator',
    status: 'active' as 'active' | 'disabled',
  });
  const [showDraftPass, setShowDraftPass] = useState(false);

  // Step 5: Roles & Permissions
  const [roles, setRoles] = useState<OnboardingRoleDraft[]>(() => {
    if (initialRoles && initialRoles.length > 0) {
      return initialRoles.map((r) => ({
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        isOwnerRole: r.isOwnerRole,
        permissions: { ...r.permissions },
      }));
    }
    return createDefaultOnboardingRoles();
  });
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>('admin');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Step 6: Restart confirmation checkbox
  const [confirmRestartChecked, setConfirmRestartChecked] = useState(mode !== 'restart');

  const opFlags = useMemo(() => operationModeToFlags(operationMode), [operationMode]);
  const selectedRole = useMemo(
    () => roles.find((r) => r.key === selectedRoleKey) || roles[0],
    [roles, selectedRoleKey]
  );

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('لطفاً یک فایل تصویری معتبر (PNG یا JPG) انتخاب کنید.');
      return;
    }
    try {
      const compressed = await compressLogoImage(file);
      setLogoUrl(compressed);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'خطا در پردازش تصویر لوگو');
    }
  };

  const handleAddDraftUser = () => {
    const cleanName = draftUser.fullName.trim();
    const cleanEmail = draftUser.email.trim().toLowerCase();
    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError('برای افزودن کاربر، نام کامل و ایمیل معتبر الزامی است.');
      return;
    }
    if (draftUser.password.length < 8) {
      setError('رمز عبور کاربر جدید باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    if (
      cleanEmail === ownerEmail.trim().toLowerCase() ||
      additionalUsers.some((u) => u.email.toLowerCase() === cleanEmail) ||
      existingMembers.some((m) => m.email.toLowerCase() === cleanEmail)
    ) {
      setError('این ایمیل قبلاً اضافه شده است.');
      return;
    }

    setAdditionalUsers((prev) => [
      ...prev,
      {
        tempId: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fullName: cleanName,
        email: cleanEmail,
        username: draftUser.username.trim().toLowerCase(),
        password: draftUser.password,
        roleKey: draftUser.roleKey,
        status: draftUser.status,
        permissionOverrides: {},
      },
    ]);
    setDraftUser({
      fullName: '',
      email: '',
      username: '',
      password: '',
      roleKey: opFlags.enableImport ? 'import_operator' : 'export_operator',
      status: 'active',
    });
    setError('');
  };

  const handleCreateCustomRole = () => {
    const cleanName = newRoleName.trim();
    if (cleanName.length < 2) {
      setError('نام نقش سفارشی باید حداقل ۲ کاراکتر باشد.');
      return;
    }
    const key = `custom_${Date.now().toString(36)}`;
    const newRole: OnboardingRoleDraft = {
      key,
      name: cleanName,
      description: newRoleDesc.trim() || 'نقش سفارشی تعریف‌شده توسط مدیر شرکت',
      isSystem: false,
      isOwnerRole: false,
      permissions: { ...EMPTY_PERMISSIONS, canViewReports: true, canViewLetters: true },
    };
    setRoles((prev) => [...prev, newRole]);
    setSelectedRoleKey(key);
    setNewRoleName('');
    setNewRoleDesc('');
    setError('');
  };

  const handleToggleRolePermission = (roleKey: string, permKey: keyof UserPermissions) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.key !== roleKey || r.isOwnerRole) return r;
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [permKey]: !r.permissions[permKey],
          },
        };
      })
    );
  };

  const validateStep = (targetStep: number): boolean => {
    setError('');
    if (targetStep === 1) {
      if (companyName.trim().length < 2) {
        setError('لطفاً نام شرکت را وارد کنید (حداقل ۲ کاراکتر).');
        return false;
      }
    }
    if (targetStep === 3 && mode !== 'restart') {
      if (ownerFullName.trim().length < 2) {
        setError('نام کامل مدیر ارشد (مالک) الزامی است.');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ownerEmail.trim())) {
        setError('لطفاً یک آدرس ایمیل معتبر برای مدیر ارشد وارد کنید.');
        return false;
      }
      if (ownerPassword.length < 8) {
        setError('رمز عبور مدیر ارشد باید حداقل ۸ کاراکتر باشد.');
        return false;
      }
      if (ownerPassword !== ownerConfirmPassword) {
        setError('رمز عبور و تکرار رمز عبور مطابقت ندارند.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(6, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopySqlFromWizard = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      setError('امکان کپی خودکار نبود. فایل supabase/schema.sql را مستقیماً باز کنید.');
    }
  };

  const handleFinalConfirm = async () => {
    if (mode === 'restart' && !confirmRestartChecked) {
      setError('لطفاً تیک تایید نهایی اعمال تغییرات را فعال کنید.');
      return;
    }
    setSubmitting(true);
    setError('');
    setErrorCode('');

    const payload: OnboardingPayload = {
      company: {
        name: companyName.trim(),
        logoUrl,
        registrationNumber: registrationNumber.trim(),
        nationalId: nationalId.trim(),
        phone: phone.trim(),
        email: companyEmail.trim(),
        address: address.trim(),
      },
      operations: {
        mode: operationMode,
        enableImport: opFlags.enableImport,
        enableExport: opFlags.enableExport,
      },
      owner:
        mode === 'restart'
          ? undefined
          : {
              fullName: ownerFullName.trim(),
              email: ownerEmail.trim().toLowerCase(),
              username: ownerUsername.trim().toLowerCase(),
              password: ownerPassword,
            },
      roles,
      additionalUsers,
    };

    try {
      if (mode === 'restart') {
        const res = await applyRestartOnboardingApi(payload);
        onComplete({ company: res.company, createdUsersCount: res.createdUsersCount });
      } else {
        const res =
          mode === 'claim_legacy'
            ? await claimLegacyCompany(payload)
            : await completeCompanyOnboarding(payload);

        // Ensure browser Supabase Auth session is hydrated
        const supabase = getSupabase();
        if (supabase && res.session?.access_token && res.session?.refresh_token) {
          const { data: current } = await supabase.auth.getSession();
          if (!current.session) {
            await supabase.auth.setSession({
              access_token: res.session.access_token,
              refresh_token: res.session.refresh_token,
            });
          }
        }
        onComplete({ company: res.company, createdUsersCount: res.createdUsersCount });
      }
    } catch (err: any) {
      setErrorCode(String(err?.code || ''));
      setError(err?.message || 'خطا در تکمیل راه‌اندازی شرکت. لطفاً مجدداً تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#040711] text-slate-100 font-vazir dir-rtl flex flex-col">
      {/* Top Wizard Header */}
      <header className="sticky top-0 z-30 pt-safe-header bg-[#060b17]/95 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-cyan-400/40 bg-[#071A21] shrink-0 flex items-center justify-center">
              <img
                src={logoUrl || 'pwa-192x192.png'}
                alt="لوگوی شرکت"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-lalezar text-lg sm:text-xl text-slate-100 truncate">
                {mode === 'restart'
                  ? 'بازبینی و اجرای مجدد راه‌اندازی شرکت'
                  : mode === 'claim_legacy'
                    ? 'تکمیل مهاجرت و ثبت شرکت اولیه'
                    : 'راه‌اندازی فضای کاری شرکت جدید'}
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                مرحله {fa(step)} از {fa(6)} · {STEPS[step - 1].title}
              </p>
            </div>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-slate-300 shrink-0 cursor-pointer"
            >
              بازگشت
            </button>
          )}
        </div>

        {/* Step Progress Strip */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <div className="grid grid-cols-6 gap-1.5">
            {STEPS.map((s) => {
              const isDone = s.id < step;
              const isCurrent = s.id === step;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (s.id < step) {
                      setError('');
                      setStep(s.id);
                    }
                  }}
                  disabled={s.id > step}
                  className={`flex flex-col items-center gap-1 text-center cursor-pointer disabled:cursor-default`}
                >
                  <div
                    className={`w-full h-1.5 rounded-full transition-colors ${
                      isDone
                        ? 'bg-emerald-400'
                        : isCurrent
                          ? 'bg-cyan-400'
                          : 'bg-white/10'
                    }`}
                  />
                  <span
                    className={`text-[10px] sm:text-xs font-semibold truncate max-w-full ${
                      isCurrent
                        ? 'text-cyan-300'
                        : isDone
                          ? 'text-emerald-300'
                          : 'text-slate-500'
                    }`}
                  >
                    {s.short}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Scrollable Step Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-5 sm:py-7 pb-28">
        {error && (
          <div className="mb-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 px-4 py-3.5 text-xs text-rose-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
            {errorCode === 'SCHEMA_NOT_READY' && (
              <div className="pt-1 flex flex-wrap items-center gap-2 border-t border-rose-400/20">
                <button
                  type="button"
                  onClick={handleCopySqlFromWizard}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-100 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'اسکریپت SQL کپی شد — در SQL Editor اجرا کنید' : 'کپی کامل اسکریپت SQL (v5.1)'}</span>
                </button>
                <span className="text-[11px] text-slate-300">
                  پس از اجرا در Supabase SQL Editor، دوباره دکمه «تایید و ایجاد فضای کاری» را بزنید (اطلاعات فرم شما حفظ شده است).
                </span>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: COMPANY INFORMATION */}
        {step === 1 && (
          <div className="glass-panel p-5 sm:p-7 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="font-lalezar text-xl sm:text-2xl text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <span>اطلاعات و هویت شرکت</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                نام شرکت، لوگو و اطلاعات تماس برای نمایش در فضای کاری اختصاصی و گزارش‌ها ثبت می‌شود.
              </p>
            </div>

            {/* Logo Uploader */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-cyan-400/40 bg-[#071A21] flex items-center justify-center shrink-0">
                <img
                  src={logoUrl || 'pwa-192x192.png'}
                  alt="پیش‌نمایش لوگو"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-bold text-slate-100">لوگوی شرکت (اختیاری)</p>
                <p className="text-xs text-slate-400">
                  فرمت PNG یا JPG. به صورت خودکار برای بارگذاری سریع بهینه‌سازی می‌شود.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="min-h-[40px] px-3.5 py-2 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-cyan-500/25">
                    <Upload className="w-4 h-4" />
                    <span>انتخاب تصویر لوگو</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف لوگو</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  نام رسمی شرکت <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="مثلاً: شرکت بازرگانی و ترخیص آریا تجارت"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">شماره ثبت (اختیاری)</label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="مثلاً: 542190"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">شناسه ملی / کد اقتصادی (اختیاری)</label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="مثلاً: 14009876543"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">تلفن تماس (اختیاری)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="021-88001234"
                  dir="ltr"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm text-left outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">ایمیل رسمی شرکت (اختیاری)</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="info@company.com"
                  dir="ltr"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm text-left outline-none"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">نشانی دفتر یا گمرک (اختیاری)</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="شهر، منطقه آزاد یا گمرک محل فعالیت..."
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm outline-none resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: BUSINESS OPERATIONS */}
        {step === 2 && (
          <div className="glass-panel p-5 sm:p-7 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="font-lalezar text-xl sm:text-2xl text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>انتخاب عملیات گمرکی فعال</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                ماژول‌های سامانه و دسترسی‌های پایگاه داده (RLS) به صورت پویا بر اساس انتخاب شما فعال می‌شوند. تغییر این تنظیم در آینده هرگز باعث حذف داده‌های قبلی نمی‌شود.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'import_only' as BusinessOperationMode,
                  title: 'فقط واردات',
                  icon: PackageCheck,
                  accent: 'cyan',
                  summary: 'ورود کالا، تخلیه، اسناد و تجمیع انبار فعال می‌شود.',
                  detail: 'بخش خروج کالا، آزمایشگاه و ۹۰/۱۰ غیرفعال و مسدود خواهد ماند.',
                },
                {
                  id: 'export_only' as BusinessOperationMode,
                  title: 'فقط صادرات / خروج',
                  icon: LogOut,
                  accent: 'blue',
                  summary: 'خروج کالا، آزمایشگاه، درب خروج و ترخیص ۹۰/۱۰ فعال می‌شود.',
                  detail: 'بخش ورود کالا و تجمیع انبار غیرفعال و مسدود خواهد ماند.',
                },
                {
                  id: 'both' as BusinessOperationMode,
                  title: 'هر دو (واردات و صادرات)',
                  icon: Layers,
                  accent: 'emerald',
                  summary: 'تمامی ماژول‌های ورود، تجمیع، خروج، آزمایشگاه و ۹۰/۱۰ فعال می‌شوند.',
                  detail: 'مناسب شرکت‌های بازرگانی و حق‌العمل‌کاری جامع.',
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = operationMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOperationMode(opt.id)}
                    className={`p-5 rounded-2xl border text-right flex flex-col gap-3 transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-500/15 border-cyan-400/60 shadow-lg shadow-cyan-500/10'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {active && <CheckCircle2 className="w-5 h-5 text-cyan-300" />}
                    </div>
                    <div>
                      <h3 className="font-lalezar text-lg text-slate-100">{opt.title}</h3>
                      <p className="text-xs text-slate-200 mt-1.5 leading-relaxed">{opt.summary}</p>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{opt.detail}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: INITIAL ADMINISTRATOR / OWNER ACCOUNT */}
        {step === 3 && (
          <div className="glass-panel p-5 sm:p-7 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="font-lalezar text-xl sm:text-2xl text-slate-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-cyan-400" />
                <span>حساب مدیر ارشد و مالک شرکت</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'restart'
                  ? 'مالک فعلی شرکت حفظ می‌شود و رمز عبور هیچ کاربری تغییر یا نمایش داده نمی‌شود.'
                  : 'این حساب از طریق Supabase Auth ساخته می‌شود و کنترل کامل فضای کاری شرکت را در اختیار دارد.'}
              </p>
            </div>

            {mode === 'restart' ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 space-y-2 text-xs">
                <p className="font-bold text-emerald-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>مالک تاییدشده فعلی</span>
                </p>
                <p className="text-slate-200">
                  نام: <b>{currentOwner?.fullName || 'مالک شرکت'}</b>
                </p>
                <p className="text-slate-300 font-mono" dir="ltr">
                  {currentOwner?.email}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    نام و نام خانوادگی مدیر ارشد <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={ownerFullName}
                    onChange={(e) => setOwnerFullName(e.target.value)}
                    placeholder="مثلاً: میلاد نظری"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    ایمیل ورود <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@company.com"
                    dir="ltr"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm text-left outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    نام کاربری کوتاه (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={ownerUsername}
                    onChange={(e) => setOwnerUsername(e.target.value)}
                    placeholder="مثلاً: nazari"
                    dir="ltr"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm text-left outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    رمز عبور (حداقل ۸ کاراکتر) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showOwnerPass ? 'text' : 'password'}
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-xl glass-input text-sm text-left outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnerPass((p) => !p)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 cursor-pointer"
                    >
                      {showOwnerPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    تکرار رمز عبور <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type={showOwnerPass ? 'text' : 'password'}
                    value={ownerConfirmPassword}
                    onChange={(e) => setOwnerConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl glass-input text-sm text-left outline-none"
                  />
                </div>

                <div className="sm:col-span-2 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-slate-400 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    رمز عبور به صورت رمزنگاری‌شده در Supabase Auth ذخیره می‌شود و هرگز به صورت متن ساده در دیتابیس نگهداری نمی‌شود.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: ADDITIONAL USERS */}
        {step === 4 && (
          <div className="glass-panel p-5 sm:p-7 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="font-lalezar text-xl sm:text-2xl text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>افزودن کاربران تیم (اختیاری)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                می‌توانید همین حالا اعضای تیم را تعریف کنید یا این مرحله را رد کرده و بعداً از بخش تنظیمات شرکت اضافه کنید.
              </p>
            </div>

            {mode === 'restart' && existingMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400">
                  کاربران فعلی شرکت ({fa(existingMembers.length)} نفر — حفظ می‌شوند):
                </p>
                <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-white/[0.02]">
                  {existingMembers.map((m) => (
                    <div key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-200 truncate">{m.fullName}</p>
                        <p className="text-[11px] text-slate-400 truncate" dir="ltr">
                          {m.email}
                        </p>
                      </div>
                      <span className="text-[11px] text-cyan-300 font-semibold shrink-0">
                        {m.roleName || (m.isOwner ? 'مالک شرکت' : 'عضو')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New User Form */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5">
              <p className="text-xs font-bold text-cyan-300">افزودن کاربر جدید به صف راه‌اندازی</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={draftUser.fullName}
                  onChange={(e) => setDraftUser((d) => ({ ...d, fullName: e.target.value }))}
                  placeholder="نام و نام خانوادگی"
                  className="min-h-[44px] px-3 py-2 rounded-xl glass-input text-xs outline-none"
                />
                <input
                  type="email"
                  value={draftUser.email}
                  onChange={(e) => setDraftUser((d) => ({ ...d, email: e.target.value }))}
                  placeholder="ایمیل (مثلاً user@company.com)"
                  dir="ltr"
                  className="min-h-[44px] px-3 py-2 rounded-xl glass-input text-xs text-left outline-none"
                />
                <input
                  type="text"
                  value={draftUser.username}
                  onChange={(e) => setDraftUser((d) => ({ ...d, username: e.target.value }))}
                  placeholder="نام کاربری (اختیاری)"
                  dir="ltr"
                  className="min-h-[44px] px-3 py-2 rounded-xl glass-input text-xs text-left outline-none"
                />
                <div className="relative">
                  <input
                    type={showDraftPass ? 'text' : 'password'}
                    value={draftUser.password}
                    onChange={(e) => setDraftUser((d) => ({ ...d, password: e.target.value }))}
                    placeholder="رمز عبور اولیه (حداقل ۸ کاراکتر)"
                    dir="ltr"
                    className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl glass-input text-xs text-left outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDraftPass((p) => !p)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 min-w-[34px] min-h-[34px] flex items-center justify-center text-slate-400 cursor-pointer"
                  >
                    {showDraftPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <select
                  value={draftUser.roleKey}
                  onChange={(e) => setDraftUser((d) => ({ ...d, roleKey: e.target.value }))}
                  className="min-h-[44px] px-3 py-2 rounded-xl glass-input text-xs outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.key} value={r.key} className="bg-[#0c0e14]">
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={draftUser.status}
                  onChange={(e) =>
                    setDraftUser((d) => ({
                      ...d,
                      status: e.target.value === 'disabled' ? 'disabled' : 'active',
                    }))
                  }
                  className="min-h-[44px] px-3 py-2 rounded-xl glass-input text-xs outline-none"
                >
                  <option value="active" className="bg-[#0c0e14]">وضعیت: فعال</option>
                  <option value="disabled" className="bg-[#0c0e14]">وضعیت: غیرفعال</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddDraftUser}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/45 text-cyan-200 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن به لیست کاربران</span>
              </button>
            </div>

            {/* Queued Additional Users */}
            {additionalUsers.length > 0 ? (
              <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-white/[0.02]">
                {additionalUsers.map((u) => {
                  const roleName = roles.find((r) => r.key === u.roleKey)?.name || u.roleKey;
                  return (
                    <div key={u.tempId} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-100 truncate">{u.fullName}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {u.email} · {roleName} · {u.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAdditionalUsers((prev) => prev.filter((item) => item.tempId !== u.tempId))
                        }
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 cursor-pointer shrink-0"
                        aria-label="حذف از لیست"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-3">
                هنوز کاربر اضافی اضافه نشده است. می‌توانید بعداً از تنظیمات شرکت کاربران را مدیریت کنید.
              </p>
            )}
          </div>
        )}

        {/* STEP 5: ROLES & PERMISSIONS */}
        {step === 5 && (
          <div className="glass-panel p-5 sm:p-7 space-y-5">
            <div className="border-b border-white/10 pb-4">
              <h2 className="font-lalezar text-xl sm:text-2xl text-slate-100 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>تنظیم نقش‌ها و سطوح دسترسی</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                نقش‌های استاندارد را بازبینی کنید یا نقش سفارشی بسازید. نقش مالک شرکت همیشه دارای دسترسی کامل است.
              </p>
            </div>

            {/* Role Selector + Custom Role Creator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 space-y-3">
                <div className="space-y-1.5">
                  {roles.map((r) => {
                    const active = r.key === selectedRole?.key;
                    const count = countEnabledPermissions(r.permissions);
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setSelectedRoleKey(r.key)}
                        className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border text-right flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          active
                            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-100'
                            : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{r.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                            {fa(count)} مجوز فعال
                          </p>
                        </div>
                        {r.isOwnerRole && <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Role */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <p className="text-[11px] font-bold text-slate-300">ایجاد نقش سفارشی جدید</p>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="نام نقش سفارشی..."
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg glass-input text-xs outline-none"
                  />
                  <input
                    type="text"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    placeholder="توضیح کوتاه (اختیاری)"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg glass-input text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCustomRole}
                    className="w-full min-h-[40px] rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-cyan-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن نقش سفارشی</span>
                  </button>
                </div>
              </div>

              {/* Permission Matrix for Selected Role */}
              <div className="lg:col-span-8 space-y-3">
                {selectedRole && (
                  <>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-100">{selectedRole.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{selectedRole.description}</p>
                      </div>
                      {selectedRole.isOwnerRole && (
                        <span className="text-[11px] font-bold text-amber-300 shrink-0">
                          دسترسی کامل (قفل‌شده)
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 max-h-[430px] overflow-y-auto pl-1">
                      {PERMISSION_GROUPS.map((group) => {
                        const moduleDisabled =
                          (group.moduleGate === 'import' && !opFlags.enableImport) ||
                          (group.moduleGate === 'export' && !opFlags.enableExport);
                        return (
                          <div
                            key={group.id}
                            className={`p-3.5 rounded-xl border space-y-2.5 ${
                              moduleDisabled
                                ? 'bg-white/[0.015] border-white/8 opacity-55'
                                : 'bg-white/[0.03] border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-bold text-cyan-200">
                              <span>{group.title}</span>
                              {moduleDisabled && (
                                <span className="text-[10px] text-amber-300">
                                  غیرفعال در مرحله عملیات
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.items.map((item) => {
                                const checked = Boolean(selectedRole.permissions[item.key]);
                                return (
                                  <button
                                    key={item.key}
                                    type="button"
                                    disabled={selectedRole.isOwnerRole}
                                    onClick={() => handleToggleRolePermission(selectedRole.key, item.key)}
                                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-right flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer disabled:cursor-not-allowed ${
                                      checked
                                        ? item.sensitive
                                          ? 'bg-amber-500/15 border-amber-400/45 text-amber-100'
                                          : 'bg-cyan-500/15 border-cyan-400/45 text-cyan-100'
                                        : 'bg-white/[0.02] border-white/10 text-slate-400'
                                    }`}
                                  >
                                    <span className="truncate">{item.label}</span>
                                    <span
                                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                        checked
                                          ? 'bg-cyan-400 text-slate-950'
                                          : 'bg-white/10 text-transparent'
                                      }`}
                                    >
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: REVIEW & CONFIRMATION */}
        {step === 6 && (
          <div className="glass-panel p-5 sm:p-7 space-y-5">
            <div className="border-b border-white/10 pb-4">
              <h2 className="font-lalezar text-xl sm:text-2xl text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>بازبینی نهایی و تایید راه‌اندازی</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                پیش از ایجاد فضای کاری و ذخیره در پایگاه داده، خلاصه تنظیمات را بررسی کنید.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Company Summary */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">۱. اطلاعات شرکت</span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>ویرایش</span>
                  </button>
                </div>
                <p className="text-sm font-bold text-slate-100">{companyName}</p>
                {registrationNumber && <p className="text-slate-400">شماره ثبت: {registrationNumber}</p>}
                {phone && <p className="text-slate-400">تلفن: {phone}</p>}
                {companyEmail && <p className="text-slate-400">ایمیل: {companyEmail}</p>}
              </div>

              {/* Operations Summary */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">۲. عملیات فعال</span>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>ویرایش</span>
                  </button>
                </div>
                <p className="text-sm font-bold text-emerald-300">
                  {operationMode === 'import_only'
                    ? 'فقط واردات (ورود کالا و تجمیع)'
                    : operationMode === 'export_only'
                      ? 'فقط صادرات (خروج کالا، آزمایشگاه و ۹۰/۱۰)'
                      : 'هر دو عملیات واردات و صادرات فعال'}
                </p>
              </div>

              {/* Owner Summary */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">۳. مالک شرکت</span>
                  {mode !== 'restart' && (
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>ویرایش</span>
                    </button>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-100">
                  {mode === 'restart' ? currentOwner?.fullName : ownerFullName}
                </p>
                <p className="text-slate-400 font-mono" dir="ltr">
                  {mode === 'restart' ? currentOwner?.email : ownerEmail}
                </p>
              </div>

              {/* Users & Roles Summary */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">۴ و ۵. کاربران و نقش‌ها</span>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>ویرایش</span>
                  </button>
                </div>
                <p className="text-slate-200">
                  کاربران جدید در صف ایجاد: <b>{fa(additionalUsers.length)}</b> نفر
                </p>
                <p className="text-slate-200">
                  تعداد نقش‌های پیکربندی‌شده: <b>{fa(roles.length)}</b> نقش
                </p>
              </div>
            </div>

            {mode === 'restart' && (
              <label className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/35 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmRestartChecked}
                  onChange={(e) => setConfirmRestartChecked(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-cyan-400"
                />
                <span className="text-xs text-amber-100 leading-relaxed">
                  تایید می‌کنم که تنظیمات جدید شرکت اعمال شود. تمامی سوابق تاریخی، کوتاژها، تجمیع‌ها، آزمایشگاه، نامه‌ها و کاربران فعلی بدون هیچ‌گونه حذف حفظ خواهند شد.
                </span>
              </label>
            )}
          </div>
        )}
      </main>

      {/* Sticky Bottom Wizard Navigation Bar */}
      <footer className="fixed bottom-0 inset-x-0 z-30 bg-[#070d1a] border-t border-white/12 pb-safe-bar shadow-[0_-8px_24px_rgba(0,0,0,0.75)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={step === 1 ? onCancel : handleBack}
            disabled={submitting || (step === 1 && !onCancel)}
            className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/15 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{step === 1 ? 'انصراف' : 'مرحله قبل'}</span>
          </button>

          {step < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="min-h-[46px] px-6 py-2.5 rounded-xl ios-glass-btn-cyan text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer"
            >
              <span>مرحله بعد</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalConfirm}
              disabled={submitting}
              className="min-h-[46px] px-6 py-2.5 rounded-xl ios-glass-btn-primary text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ذخیره و راه‌اندازی...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {mode === 'restart'
                      ? 'اعمال نهایی تنظیمات'
                      : 'تایید و ایجاد فضای کاری'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
