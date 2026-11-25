import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Building2,
  SlidersHorizontal,
  Users,
  Shield,
  RotateCcw,
  Upload,
  Trash2,
  Save,
  Plus,
  Edit3,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertTriangle,
  Crown,
  PackageCheck,
  LogOut as ExportIcon,
  History,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
} from 'lucide-react';
import type {
  CompanyAuditLog,
  CompanyMember,
  CompanyProfile,
  CompanyRole,
  UserPermissions,
  WorkspaceContextData,
} from '../types';
import {
  PERMISSION_GROUPS,
  EMPTY_PERMISSIONS,
  normalizePermissions,
  countEnabledPermissions,
  ALL_PERMISSION_KEYS,
} from '../utils/permissions';
import {
  updateCompanyProfileApi,
  updateCompanyOperationsApi,
  listCompanyUsersApi,
  createCompanyUserApi,
  updateCompanyUserApi,
  setCompanyUserStatusApi,
  removeCompanyUserApi,
  listCompanyRolesApi,
  createCompanyRoleApi,
  updateCompanyRoleApi,
  deleteCompanyRoleApi,
  fetchCompanyAuditLogsApi,
} from '../services/workspaceApi';
import { fa } from '../utils/jalali';

type SettingsTab = 'profile' | 'operations' | 'users' | 'roles' | 'onboarding';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceContextData;
  onWorkspaceUpdated: () => Promise<void> | void;
  onLaunchRestartWizard: () => void;
  addToast: (msg: string, type?: 'ok' | 'err' | 'info') => void;
}

const compressLogoFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 360;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
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
        resolve(canvas.toDataURL('image/png', 0.9));
      };
      img.onerror = () => reject(new Error('تصویر لوگو معتبر نیست'));
      img.src = String(ev.target?.result || '');
    };
    reader.onerror = () => reject(new Error('خطا در خواندن فایل لوگو'));
    reader.readAsDataURL(file);
  });
};

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onWorkspaceUpdated,
  onLaunchRestartWizard,
  addToast,
}) => {
  const { company, member, effectivePermissions } = workspace;

  const canManageProfile = member.isOwner || effectivePermissions.canManageCompanySettings;
  const canManageUsers = member.isOwner || effectivePermissions.canManageUsers;
  const canManageRoles = member.isOwner || effectivePermissions.canManageRoles;

  const defaultTab: SettingsTab = canManageProfile
    ? 'profile'
    : canManageUsers
      ? 'users'
      : canManageRoles
        ? 'roles'
        : 'onboarding';

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  const [busy, setBusy] = useState(false);

  // --- Profile state ---
  const [name, setName] = useState(company.name || '');
  const [logoUrl, setLogoUrl] = useState(company.logoUrl || '');
  const [registrationNumber, setRegistrationNumber] = useState(company.registrationNumber || '');
  const [nationalId, setNationalId] = useState(company.nationalId || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [email, setEmail] = useState(company.email || '');
  const [address, setAddress] = useState(company.address || '');
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // --- Operations state ---
  const [enableImport, setEnableImport] = useState(company.enableImport);
  const [enableExport, setEnableExport] = useState(company.enableExport);
  const [opsConfirmOpen, setOpsConfirmOpen] = useState(false);

  // --- Users state ---
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPass, setShowNewUserPass] = useState(false);
  const [newUserRoleId, setNewUserRoleId] = useState('');
  const [editingMember, setEditingMember] = useState<CompanyMember | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberUsername, setEditMemberUsername] = useState('');
  const [editMemberRoleId, setEditMemberRoleId] = useState('');
  const [editMemberOverrides, setEditMemberOverrides] = useState<Partial<UserPermissions>>({});
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<CompanyMember | null>(null);

  // --- Roles state ---
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [roleFormMode, setRoleFormMode] = useState<'edit' | 'create'>('edit');
  const [roleNameInput, setRoleNameInput] = useState('');
  const [roleDescInput, setRoleDescInput] = useState('');
  const [rolePermsInput, setRolePermsInput] = useState<UserPermissions>({ ...EMPTY_PERMISSIONS });
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<CompanyRole | null>(null);

  // --- Onboarding & Audit Logs state ---
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<CompanyAuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Sync profile/ops when company prop changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    setName(company.name || '');
    setLogoUrl(company.logoUrl || '');
    setRegistrationNumber(company.registrationNumber || '');
    setNationalId(company.nationalId || '');
    setPhone(company.phone || '');
    setEmail(company.email || '');
    setAddress(company.address || '');
    setEnableImport(company.enableImport);
    setEnableExport(company.enableExport);
    setOpsConfirmOpen(false);
    setRestartConfirmOpen(false);
  }, [isOpen, company]);

  const loadRoles = async () => {
    if (!canManageRoles && !canManageUsers) return;
    setRolesLoading(true);
    try {
      const res = await listCompanyRolesApi();
      setRoles(res.roles || []);
      if (res.roles?.length) {
        if (!newUserRoleId) {
          const nonOwner = res.roles.find((r) => r.key !== 'owner') || res.roles[0];
          setNewUserRoleId(nonOwner.id);
        }
        if (!selectedRoleId) {
          const first = res.roles[0];
          setSelectedRoleId(first.id);
          setRoleFormMode('edit');
          setRoleNameInput(first.name);
          setRoleDescInput(first.description || '');
          setRolePermsInput(normalizePermissions(first.permissions));
        }
      }
    } catch (err: any) {
      addToast(err?.message || 'خطا در دریافت لیست نقش‌ها', 'err');
    } finally {
      setRolesLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!canManageUsers) return;
    setUsersLoading(true);
    try {
      const res = await listCompanyUsersApi();
      setMembers(res.members || []);
    } catch (err: any) {
      addToast(err?.message || 'خطا در دریافت لیست کاربران', 'err');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!canManageProfile && !canManageUsers) return;
    setLogsLoading(true);
    try {
      const res = await fetchCompanyAuditLogsApi();
      setAuditLogs(res.logs || []);
    } catch {
      // Silent optional load
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'users') {
      loadUsers();
      if (roles.length === 0) loadRoles();
    } else if (activeTab === 'roles') {
      loadRoles();
    } else if (activeTab === 'onboarding') {
      loadAuditLogs();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // --- Handlers: Profile ---
  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      addToast('لطفاً یک فایل تصویری PNG، JPG یا WebP انتخاب کنید (SVG مجاز نیست).', 'err');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('حجم تصویر لوگو نباید بیش از ۵ مگابایت باشد.', 'err');
      return;
    }
    try {
      const dataUrl = await compressLogoFile(file);
      setLogoUrl(dataUrl);
    } catch (err: any) {
      addToast(err?.message || 'خطا در پردازش تصویر لوگو', 'err');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('نام شرکت الزامی است.', 'err');
      return;
    }
    setBusy(true);
    try {
      await updateCompanyProfileApi({
        name: name.trim(),
        logoUrl: logoUrl || '',
        registrationNumber: registrationNumber.trim(),
        nationalId: nationalId.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
      });
      await onWorkspaceUpdated();
      addToast('اطلاعات پروفایل شرکت با موفقیت بروزرسانی شد.', 'ok');
    } catch (err: any) {
      addToast(err?.message || 'خطا در ذخیره اطلاعات شرکت', 'err');
    } finally {
      setBusy(false);
    }
  };

  // --- Handlers: Operations ---
  const operationsChanged = enableImport !== company.enableImport || enableExport !== company.enableExport;
  const disablingModule =
    (company.enableImport && !enableImport) || (company.enableExport && !enableExport);

  const commitSaveOperations = async () => {
    if (!enableImport && !enableExport) {
      addToast('حداقل یکی از ماژول‌های ورود یا خروج باید فعال باشد.', 'err');
      return;
    }
    setBusy(true);
    try {
      await updateCompanyOperationsApi({ enableImport, enableExport });
      setOpsConfirmOpen(false);
      await onWorkspaceUpdated();
      addToast('تنظیمات ماژول‌های عملیاتی شرکت بروزرسانی شد.', 'ok');
    } catch (err: any) {
      addToast(err?.message || 'خطا در بروزرسانی عملیات', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestSaveOperations = () => {
    if (!enableImport && !enableExport) {
      addToast('حداقل یکی از ماژول‌های ورود یا خروج باید فعال باشد.', 'err');
      return;
    }
    if (disablingModule) {
      setOpsConfirmOpen(true);
    } else {
      commitSaveOperations();
    }
  };

  // --- Handlers: Users ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFullName.trim() || !newUserEmail.trim() || !newUserPassword) {
      addToast('نام کامل، ایمیل و رمز عبور کاربر الزامی است.', 'err');
      return;
    }
    if (newUserPassword.length < 8) {
      addToast('رمز عبور باید حداقل ۸ کاراکتر باشد.', 'err');
      return;
    }
    if (!newUserRoleId) {
      addToast('لطفاً نقش کاربر را انتخاب کنید.', 'err');
      return;
    }
    setBusy(true);
    try {
      await createCompanyUserApi({
        fullName: newUserFullName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        username: newUserUsername.trim() || undefined,
        password: newUserPassword,
        roleId: newUserRoleId,
        status: 'active',
      });
      setNewUserFullName('');
      setNewUserEmail('');
      setNewUserUsername('');
      setNewUserPassword('');
      setShowAddUser(false);
      await loadUsers();
      addToast('حساب کاربری جدید ایجاد و به شرکت اضافه شد.', 'ok');
    } catch (err: any) {
      addToast(err?.message || 'خطا در ایجاد کاربر جدید', 'err');
    } finally {
      setBusy(false);
    }
  };

  const startEditMember = (m: CompanyMember) => {
    setEditingMember(m);
    setEditMemberName(m.fullName);
    setEditMemberUsername(m.username || '');
    setEditMemberRoleId(m.roleId);
    setEditMemberOverrides({ ...(m.permissionOverrides || {}) });
  };

  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setBusy(true);
    try {
      await updateCompanyUserApi(editingMember.id, {
        fullName: editMemberName.trim(),
        username: editMemberUsername.trim(),
        roleId: editMemberRoleId,
        permissionOverrides: editMemberOverrides,
      });
      setEditingMember(null);
      await loadUsers();
      await onWorkspaceUpdated();
      addToast('اطلاعات و دسترسی‌های کاربر بروزرسانی شد.', 'ok');
    } catch (err: any) {
      addToast(err?.message || 'خطا در ویرایش کاربر', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMemberStatus = async (m: CompanyMember) => {
    const nextStatus = m.status === 'active' ? 'disabled' : 'active';
    setBusy(true);
    try {
      await setCompanyUserStatusApi(m.id, nextStatus);
      await loadUsers();
      addToast(
        nextStatus === 'disabled'
          ? `حساب کاربری «${m.fullName}» غیرفعال شد.`
          : `حساب کاربری «${m.fullName}» مجدداً فعال شد.`,
        'ok'
      );
    } catch (err: any) {
      addToast(err?.message || 'خطا در تغییر وضعیت کاربر', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!confirmRemoveMember) return;
    setBusy(true);
    try {
      await removeCompanyUserApi(confirmRemoveMember.id);
      setConfirmRemoveMember(null);
      await loadUsers();
      addToast('کاربر از فضای کاری شرکت حذف شد.', 'info');
    } catch (err: any) {
      addToast(err?.message || 'خطا در حذف کاربر', 'err');
    } finally {
      setBusy(false);
    }
  };

  // --- Handlers: Roles ---
  const selectRoleForEdit = (role: CompanyRole) => {
    setRoleFormMode('edit');
    setSelectedRoleId(role.id);
    setRoleNameInput(role.name);
    setRoleDescInput(role.description || '');
    setRolePermsInput(normalizePermissions(role.permissions));
  };

  const startCreateRole = () => {
    setRoleFormMode('create');
    setSelectedRoleId('');
    setRoleNameInput('');
    setRoleDescInput('');
    setRolePermsInput({
      ...EMPTY_PERMISSIONS,
      canViewEntry: company.enableImport,
      canViewExit: company.enableExport,
      canViewReports: true,
      canViewLetters: true,
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleNameInput.trim()) {
      addToast('نام نقش الزامی است.', 'err');
      return;
    }
    setBusy(true);
    try {
      if (roleFormMode === 'create') {
        const res = await createCompanyRoleApi({
          name: roleNameInput.trim(),
          description: roleDescInput.trim(),
          permissions: rolePermsInput,
        });
        await loadRoles();
        if (res.role) selectRoleForEdit(res.role);
        addToast('نقش سفارشی جدید ایجاد شد.', 'ok');
      } else if (selectedRoleId) {
        await updateCompanyRoleApi(selectedRoleId, {
          name: roleNameInput.trim(),
          description: roleDescInput.trim(),
          permissions: rolePermsInput,
        });
        await loadRoles();
        await onWorkspaceUpdated();
        addToast('تنظیمات و مجوزهای نقش ذخیره شد.', 'ok');
      }
    } catch (err: any) {
      addToast(err?.message || 'خطا در ذخیره نقش', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!confirmDeleteRole) return;
    setBusy(true);
    try {
      await deleteCompanyRoleApi(confirmDeleteRole.id);
      setConfirmDeleteRole(null);
      setSelectedRoleId('');
      await loadRoles();
      addToast('نقش سفارشی حذف شد.', 'info');
    } catch (err: any) {
      addToast(err?.message || 'خطا در حذف نقش', 'err');
    } finally {
      setBusy(false);
    }
  };

  const selectedRoleObj = roles.find((r) => r.id === selectedRoleId) || null;
  const isEditingOwnerRole = roleFormMode === 'edit' && selectedRoleObj?.key === 'owner';

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }>; allowed: boolean }> = [
    { id: 'profile', label: 'پروفایل شرکت', icon: Building2, allowed: canManageProfile },
    { id: 'operations', label: 'پیکربندی عملیات', icon: SlidersHorizontal, allowed: canManageProfile },
    { id: 'users', label: 'مدیریت کاربران', icon: Users, allowed: canManageUsers },
    { id: 'roles', label: 'نقش‌ها و مجوزها', icon: Shield, allowed: canManageRoles },
    { id: 'onboarding', label: 'مدیریت راه‌اندازی', icon: RotateCcw, allowed: canManageProfile || member.isOwner },
  ];

  const visibleTabs = tabs.filter((t) => t.allowed);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center safe-modal-backdrop sm:p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 font-vazir dir-rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl rounded-3xl ios-glass-modal border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.92)] overflow-hidden flex flex-col max-h-[92dvh]"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.03]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center overflow-hidden shrink-0">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-5 h-5 text-cyan-300" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-lalezar text-lg sm:text-xl text-white tracking-wide truncate">
                تنظیمات شرکت — {company.name}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                مدیریت پروفایل، ماژول‌های عملیاتی، کاربران، نقش‌های دسترسی و راه‌اندازی مجدد
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="بستن تنظیمات شرکت"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/10 bg-slate-950/50 px-4 sm:px-6 pt-2.5 shrink-0">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[42px] px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'border-cyan-400 text-cyan-200 bg-white/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-200">
          {/* =============================================================== */}
          {/* TAB 1: COMPANY PROFILE                                          */}
          {/* =============================================================== */}
          {activeTab === 'profile' && canManageProfile && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-slate-950 border border-cyan-400/30 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="لوگوی شرکت" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-8 h-8 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 text-center sm:text-right space-y-1">
                  <h3 className="text-sm font-bold text-white">لوگوی اختصاصی شرکت</h3>
                  <p className="text-xs text-slate-400">
                    این لوگو در نوار بالای سامانه و نمای اختصاصی شرکت شما نمایش داده می‌شود. (PNG/JPG/WebP)
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{logoUrl ? 'تغییر لوگو' : 'بارگذاری لوگو'}</span>
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف لوگو</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نام شرکت / بازرگانی <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-white"
                    placeholder="مثلاً: شرکت بازرگانی و ترخیص آریا"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">شماره ثبت</label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-white"
                    placeholder="اختیاری"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">شناسه ملی / اقتصادی</label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-white"
                    placeholder="اختیاری"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">تلفن تماس</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-white text-right"
                    placeholder="021-..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ایمیل سازمانی</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-white text-right"
                    placeholder="info@company.com"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">نشانی دفتر / گمرک</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-white resize-none"
                    placeholder="آدرس کامل دفتر مرکزی یا واحد گمرکی"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>ذخیره تغییرات پروفایل</span>
                </button>
              </div>
            </form>
          )}

          {/* =============================================================== */}
          {/* TAB 2: BUSINESS OPERATIONS CONFIGURATION                        */}
          {/* =============================================================== */}
          {activeTab === 'operations' && canManageProfile && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-xs text-cyan-100 leading-relaxed flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-white mb-1">
                    تغییر ماژول‌های عملیاتی بدون حذف هیچ‌گونه سابقه
                  </p>
                  <p className="text-slate-300">
                    با غیرفعال کردن هر ماژول، منوها و دسترسی‌های مرتبط با آن در رابط کاربری و سطح دیتابیس (RLS) مسدود می‌شوند،
                    اما تمامی اسناد و سوابق تاریخی شما کاملاً امن نگهداری شده و در صورت فعال‌سازی مجدد بلافاصله در دسترس خواهند بود.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Import Toggle Card */}
                <button
                  type="button"
                  onClick={() => setEnableImport((v) => !v)}
                  className={`p-5 rounded-2xl border text-right transition-all cursor-pointer space-y-3 ${
                    enableImport
                      ? 'bg-cyan-500/15 border-cyan-400/60 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-900/60 border-white/10 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                      <PackageCheck className="w-6 h-6" />
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        enableImport
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                          : 'bg-slate-800 border-white/10 text-slate-400'
                      }`}
                    >
                      {enableImport ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white">عملیات ورود (ورود کالا و تجمیع)</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      شامل ثبت کوتاژهای ورودی، مدیریت تخلیه تریلی‌ها، قبض انبار، چک‌لیست اسناد و تجمیع کوتاژهای انبار.
                    </p>
                  </div>
                </button>

                {/* Export Toggle Card */}
                <button
                  type="button"
                  onClick={() => setEnableExport((v) => !v)}
                  className={`p-5 rounded-2xl border text-right transition-all cursor-pointer space-y-3 ${
                    enableExport
                      ? 'bg-blue-500/15 border-blue-400/60 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900/60 border-white/10 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
                      <ExportIcon className="w-6 h-6" />
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        enableExport
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                          : 'bg-slate-800 border-white/10 text-slate-400'
                      }`}
                    >
                      {enableExport ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white">عملیات خروج (خروج کالا، آزمایشگاه و ۹۰/۱۰)</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      شامل ثبت اسناد خروج، مسیر قرمز/زرد، سوابق آزمایشگاه، تایید ساتا، ترخیص ۹۰/۱۰ و ثبت خروج فیزیکی تریلی‌ها.
                    </p>
                  </div>
                </button>
              </div>

              {!enableImport && !enableExport && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>حداقل یکی از دو بخش ورود یا خروج باید فعال باشد.</span>
                </div>
              )}

              {opsConfirmOpen ? (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/50 space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-200 text-xs">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-amber-100">تایید غیرفعال‌سازی ماژول عملیاتی</p>
                      <p className="leading-relaxed">
                        ماژول انتخاب‌شده بلافاصله از منوها پنهان شده و دسترسی به آن برای همه کاربران شرکت محدود می‌شود.
                        هیچ رکوردی از دیتابیس حذف نخواهد شد. آیا مایل به اعمال تغییرات هستید؟
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOpsConfirmOpen(false)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={commitSaveOperations}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>بله، اعمال شود</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={busy || !operationsChanged || (!enableImport && !enableExport)}
                    onClick={handleRequestSaveOperations}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>ذخیره پیکربندی عملیات</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: USER MANAGEMENT                                          */}
          {/* =============================================================== */}
          {activeTab === 'users' && canManageUsers && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    اعضای فضای کاری ({fa(members.length)} کاربر)
                  </h3>
                  <p className="text-xs text-slate-400">
                    ایجاد فوری حساب کاربری، تغییر نقش، شخصی‌سازی دسترسی‌ها و غیرفعال‌سازی کاربران شرکت
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddUser((v) => !v)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddUser ? 'بستن فرم افزودن' : 'افزودن کاربر جدید'}</span>
                </button>
              </div>

              {/* Add User Form */}
              {showAddUser && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-emerald-400/35 space-y-4"
                >
                  <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>تعریف حساب کاربری جدید (ایجاد آنی در Supabase Auth)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">نام و نام خانوادگی *</label>
                      <input
                        type="text"
                        required
                        value={newUserFullName}
                        onChange={(e) => setNewUserFullName(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                        placeholder="مثلاً: علی رضایی"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">ایمیل (جهت ورود) *</label>
                      <input
                        type="email"
                        required
                        dir="ltr"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white text-right"
                        placeholder="user@company.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">نام کاربری (اختیاری)</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white text-right"
                        placeholder="ali.rezaei"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">رمز عبور اولیه (حداقل ۸ کاراکتر) *</label>
                      <div className="relative">
                        <input
                          type={showNewUserPass ? 'text' : 'password'}
                          required
                          minLength={8}
                          dir="ltr"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full glass-input rounded-xl pr-3 pl-9 py-2 text-xs text-white text-right"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewUserPass((v) => !v)}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showNewUserPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-300 mb-1">نقش کاربری *</label>
                      <select
                        value={newUserRoleId}
                        onChange={(e) => setNewUserRoleId(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900"
                      >
                        {roles
                          .filter((r) => member.isOwner || r.key !== 'owner')
                          .map((r) => (
                            <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                              {r.name} {r.isSystem ? '(سیستمی)' : '(سفارشی)'}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddUser(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>ایجاد و ثبت کاربر</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Edit Member Panel */}
              {editingMember && (
                <form
                  onSubmit={handleSaveEditMember}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-cyan-400/45 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      <span>ویرایش کاربر و استثناهای دسترسی: {editingMember.fullName}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">نام کامل</label>
                      <input
                        type="text"
                        required
                        value={editMemberName}
                        onChange={(e) => setEditMemberName(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">نام کاربری</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={editMemberUsername}
                        onChange={(e) => setEditMemberUsername(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">نقش</label>
                      <select
                        value={editMemberRoleId}
                        disabled={editingMember.isOwner && !member.isOwner}
                        onChange={(e) => setEditMemberRoleId(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900 disabled:opacity-50"
                      >
                        {roles
                          .filter((r) => member.isOwner || r.key !== 'owner')
                          .map((r) => (
                            <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                              {r.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Per-user fine-grained permission overrides */}
                  {!editingMember.isOwner && (
                    <div className="space-y-2.5 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">
                          استثناهای مجوز اختصاصی این کاربر (اختیاری — بر نقش اولویت دارد)
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditMemberOverrides({})}
                          className="text-[11px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
                        >
                          بازنشانی به مجوزهای نقش
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pl-1">
                        {PERMISSION_GROUPS.map((group) => {
                          const roleObj = roles.find((r) => r.id === editMemberRoleId);
                          const basePerms = normalizePermissions(roleObj?.permissions);
                          return (
                            <div
                              key={group.id}
                              className="p-3 rounded-xl bg-slate-950/60 border border-white/8 space-y-2"
                            >
                              <p className="text-[11px] font-bold text-cyan-300">{group.title}</p>
                              {group.items.map((item) => {
                                const hasOverride = Object.prototype.hasOwnProperty.call(
                                  editMemberOverrides,
                                  item.key
                                );
                                const effectiveVal = hasOverride
                                  ? Boolean(editMemberOverrides[item.key])
                                  : Boolean(basePerms[item.key]);
                                return (
                                  <label
                                    key={item.key}
                                    className="flex items-center justify-between gap-2 text-[11px] text-slate-300 cursor-pointer"
                                  >
                                    <span className="truncate">
                                      {item.label}
                                      {hasOverride && (
                                        <span className="mr-1 text-[10px] text-amber-300">(اختصاصی)</span>
                                      )}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={effectiveVal}
                                      onChange={(e) => {
                                        const nextVal = e.target.checked;
                                        setEditMemberOverrides((prev) => {
                                          const copy = { ...prev };
                                          if (nextVal === Boolean(basePerms[item.key])) {
                                            delete copy[item.key];
                                          } else {
                                            copy[item.key] = nextVal;
                                          }
                                          return copy;
                                        });
                                      }}
                                      className="accent-cyan-400 w-4 h-4 shrink-0"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>ذخیره تغییرات کاربر</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Confirm Remove Member Banner */}
              {confirmRemoveMember && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/45 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs text-rose-100 space-y-1">
                    <p className="font-bold text-sm">حذف کاربر «{confirmRemoveMember.fullName}» از شرکت؟</p>
                    <p className="text-rose-200/80">
                      دسترسی این کاربر به این شرکت بلافاصله قطع می‌شود، اما اسناد ثبت‌شده توسط او حفظ خواهند شد.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveMember(null)}
                      className="px-3.5 py-2 rounded-xl bg-white/10 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleConfirmRemoveMember}
                      className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      تایید حذف
                    </button>
                  </div>
                </div>
              )}

              {/* Members Table / Cards */}
              {usersLoading ? (
                <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>در حال بارگذاری لیست کاربران...</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {members.map((m) => {
                    const roleName =
                      m.roleName || roles.find((r) => r.id === m.roleId)?.name || 'کاربر';
                    const isSelf = m.id === member.id;
                    const overrideCount = Object.keys(m.permissionOverrides || {}).length;
                    return (
                      <div
                        key={m.id}
                        className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                              m.isOwner
                                ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                                : m.status === 'active'
                                  ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300'
                                  : 'bg-slate-800 border-white/10 text-slate-500'
                            }`}
                          >
                            {m.isOwner ? <Crown className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white truncate">{m.fullName}</span>
                              {isSelf && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-bold">
                                  شما
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                                  m.status === 'active'
                                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300'
                                    : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                                }`}
                              >
                                {m.status === 'active' ? 'فعال' : 'غیرفعال'}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                                {roleName}
                              </span>
                              {overrideCount > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200">
                                  {fa(overrideCount)} مجوز اختصاصی
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 font-mono truncate mt-0.5" dir="ltr">
                              {m.email}
                              {m.username ? ` · @${m.username}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => startEditMember(m)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
                            title="ویرایش کاربر و دسترسی‌ها"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-cyan-300" />
                            <span>ویرایش</span>
                          </button>
                          {!isSelf && (!m.isOwner || member.isOwner) && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleToggleMemberStatus(m)}
                                className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                                  m.status === 'active'
                                    ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/35 text-amber-200'
                                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/35 text-emerald-200'
                                }`}
                              >
                                {m.status === 'active' ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>غیرفعال</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>فعال‌سازی</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmRemoveMember(m)}
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer disabled:opacity-50"
                                title="حذف کاربر از شرکت"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: ROLES & PERMISSIONS MANAGEMENT                           */}
          {/* =============================================================== */}
          {activeTab === 'roles' && canManageRoles && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Role List */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">نقش‌های شرکت ({fa(roles.length)})</h3>
                  <button
                    type="button"
                    onClick={startCreateRole}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>نقش جدید</span>
                  </button>
                </div>

                {rolesLoading ? (
                  <div className="py-8 flex justify-center text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {roles.map((r) => {
                      const active = roleFormMode === 'edit' && selectedRoleId === r.id;
                      const count = countEnabledPermissions(r.permissions);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => selectRoleForEdit(r)}
                          className={`w-full p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                            active
                              ? 'bg-cyan-500/15 border-cyan-400/60'
                              : 'bg-slate-900/60 border-white/10 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-bold text-white truncate">{r.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-cyan-300 font-mono">
                              {fa(count)}/{fa(ALL_PERMISSION_KEYS.length)}
                            </span>
                          </div>
                          {r.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{r.description}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Role Permission Matrix Editor */}
              <form onSubmit={handleSaveRole} className="lg:col-span-8 space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span>
                        {roleFormMode === 'create'
                          ? 'ایجاد نقش سفارشی جدید'
                          : `ویرایش نقش: ${selectedRoleObj?.name || ''}`}
                      </span>
                    </h4>
                    {roleFormMode === 'edit' && selectedRoleObj && !selectedRoleObj.isSystem && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRole(selectedRoleObj)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف نقش</span>
                      </button>
                    )}
                  </div>

                  {confirmDeleteRole && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-between gap-2 text-xs">
                      <span className="text-rose-200">
                        آیا از حذف نقش سفارشی «{confirmDeleteRole.name}» اطمینان دارید؟
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRole(null)}
                          className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 cursor-pointer"
                        >
                          انصراف
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteRole}
                          className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  )}

                  {isEditingOwnerRole && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-200 text-xs flex items-center gap-2">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>نقش «مالک شرکت» همیشه دارای دسترسی کامل به تمامی بخش‌های فعال است و قابل محدودسازی نیست.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">نام نقش *</label>
                      <input
                        type="text"
                        required
                        disabled={isEditingOwnerRole}
                        value={roleNameInput}
                        onChange={(e) => setRoleNameInput(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white disabled:opacity-60"
                        placeholder="مثلاً: کارشناس ترخیص خروج"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">توضیحات کوتاه</label>
                      <input
                        type="text"
                        disabled={isEditingOwnerRole}
                        value={roleDescInput}
                        onChange={(e) => setRoleDescInput(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white disabled:opacity-60"
                        placeholder="شرح مسئولیت‌های این نقش"
                      />
                    </div>
                  </div>

                  {/* 8-Domain Permission Matrix */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PERMISSION_GROUPS.map((group) => {
                      const moduleInactive =
                        (group.moduleGate === 'import' && !company.enableImport) ||
                        (group.moduleGate === 'export' && !company.enableExport);
                      return (
                        <div
                          key={group.id}
                          className={`p-3.5 rounded-xl border space-y-2 ${
                            moduleInactive
                              ? 'bg-slate-950/30 border-white/5 opacity-55'
                              : 'bg-slate-950/60 border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-cyan-300">{group.title}</span>
                            {moduleInactive && (
                              <span className="text-[10px] text-amber-300">ماژول غیرفعال</span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {group.items.map((item) => (
                              <label
                                key={item.key}
                                className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer"
                              >
                                <span>{item.label}</span>
                                <input
                                  type="checkbox"
                                  disabled={isEditingOwnerRole}
                                  checked={Boolean(rolePermsInput[item.key])}
                                  onChange={(e) =>
                                    setRolePermsInput((prev) => ({
                                      ...prev,
                                      [item.key]: e.target.checked,
                                    }))
                                  }
                                  className="accent-cyan-400 w-4 h-4 shrink-0"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!isEditingOwnerRole && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={busy}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>{roleFormMode === 'create' ? 'ایجاد نقش سفارشی' : 'ذخیره مجوزهای نقش'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 5: ONBOARDING MANAGEMENT & AUDIT LOGS                       */}
          {/* =============================================================== */}
          {activeTab === 'onboarding' && (
            <div className="space-y-6">
              {/* Option A: Quick Configuration Edit */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">الف) ویرایش سریع پیکربندی (بدون نیاز به تکرار ویزارد)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      id: 'profile' as SettingsTab,
                      title: 'اطلاعات و لوگو',
                      desc: 'نام، لوگو و مشخصات ثبتی',
                      icon: Building2,
                      allowed: canManageProfile,
                    },
                    {
                      id: 'operations' as SettingsTab,
                      title: 'ورود و خروج',
                      desc: 'فعال/غیرفعال‌سازی ماژول‌ها',
                      icon: SlidersHorizontal,
                      allowed: canManageProfile,
                    },
                    {
                      id: 'users' as SettingsTab,
                      title: 'مدیریت کاربران',
                      desc: 'افزودن، ویرایش و غیرفعال‌سازی',
                      icon: Users,
                      allowed: canManageUsers,
                    },
                    {
                      id: 'roles' as SettingsTab,
                      title: 'نقش‌ها و مجوزها',
                      desc: 'ماتریس دسترسی‌ها و نقش سفارشی',
                      icon: Shield,
                      allowed: canManageRoles,
                    },
                  ]
                    .filter((card) => card.allowed)
                    .map((card) => {
                      const Icon = card.icon;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setActiveTab(card.id)}
                          className="p-4 rounded-2xl bg-slate-900/70 hover:bg-slate-800/80 border border-white/10 hover:border-cyan-400/40 text-right transition-all cursor-pointer flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                              <Icon className="w-4 h-4" />
                            </div>
                            <ChevronLeft className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{card.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{card.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Option B: Restart Onboarding Setup Wizard (Company Owner Only) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-slate-900/80 border border-amber-400/35 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-amber-400" />
                      <span>ب) اجرای مجدد ویزارد راه‌اندازی گام‌به‌گام (ویژه مالک شرکت)</span>
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      در صورتی که می‌خواهید پیکربندی شرکت، ماژول‌های عملیاتی، کاربران جدید و نقش‌ها را به‌صورت گام‌به‌گام بازبینی کنید،
                      می‌توانید ویزارد راه‌اندازی را در حالت کاملاً غیرتخریبی اجرا نمایید.
                    </p>
                  </div>

                  {member.isOwner ? (
                    !restartConfirmOpen && (
                      <button
                        type="button"
                        onClick={() => setRestartConfirmOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-2 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>اجرای مجدد ویزارد راه‌اندازی</span>
                      </button>
                    )
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-[11px] text-slate-400 flex items-center gap-1.5 shrink-0">
                      <Lock className="w-3.5 h-3.5" />
                      <span>فقط مالک شرکت مجاز است</span>
                    </span>
                  )}
                </div>

                {restartConfirmOpen && member.isOwner && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-400/40 space-y-3">
                    <div className="flex items-start gap-2.5 text-xs text-amber-100">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 leading-relaxed">
                        <p className="font-bold">تضمین حفاظت از داده‌ها در اجرای مجدد ویزارد:</p>
                        <p className="text-slate-300">
                          اجرای مجدد ویزارد هیچ‌یک از اسناد ورود، خروج، تجمیع، آزمایشگاه، نامه‌ها یا حساب‌های کاربری فعلی را حذف نخواهد کرد.
                          فقط تنظیمات انتخابی شما بروزرسانی شده و کاربران جدید اضافه می‌شوند.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRestartConfirmOpen(false)}
                        className="px-4 py-2 rounded-xl bg-white/10 text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRestartConfirmOpen(false);
                          onClose();
                          onLaunchRestartWizard();
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        شروع ویزارد بازپیکربندی
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Company Audit Logs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>گزارش رویدادها و تغییرات شرکت</span>
                  </h3>
                  <button
                    type="button"
                    onClick={loadAuditLogs}
                    className="text-xs text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    بروزرسانی
                  </button>
                </div>

                {logsLoading ? (
                  <div className="py-6 flex justify-center text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-white/10 text-xs text-slate-400 text-center">
                    هنوز رویداد مدیریتی ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pl-1">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-slate-900/60 border border-white/8 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-slate-200 font-medium truncate">{log.summary}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {log.actorName || 'سیستم'} · <span className="font-mono">{log.action}</span>
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0" dir="ltr">
                          {new Date(log.createdAt).toLocaleString('fa-IR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-white/10 bg-white/[0.03] flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 truncate">
            شناسه فضای کاری: <b className="font-mono text-slate-300">{company.slug}</b>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-100 font-bold cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
