import type {
  BuiltInRoleKey,
  BusinessOperationMode,
  CompanyProfile,
  OnboardingRoleDraft,
  UserPermissions,
} from '../types';

export const ALL_PERMISSION_KEYS: Array<keyof UserPermissions> = [
  'canViewEntry',
  'canCreateEntry',
  'canEditEntry',
  'canCreateBatch',
  'canViewExit',
  'canCreateExit',
  'canUpdateExitStages',
  'canViewLab',
  'canCreateLab',
  'canViewReports',
  'canViewSummaryModal',
  'canViewLetters',
  'canManageLetters',
  'canConfirmSata',
  'canCloseCase',
  'canEditCriticalClearance',
  'canModifyCompletedExits',
  'canManageTasks',
  'canManageNotifications',
  'canManageUsers',
  'canManageRoles',
  'canManageCompanySettings',
  'canManageSystemConfig',
  'canAccessCloudDb',
  'canDeleteItems',
];

export const FULL_PERMISSIONS: UserPermissions = {
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
  canManageUsers: true,
  canManageRoles: true,
  canManageCompanySettings: true,
  canManageSystemConfig: true,
};

export const EMPTY_PERMISSIONS: UserPermissions = {
  canViewEntry: false,
  canCreateEntry: false,
  canEditEntry: false,
  canCreateBatch: false,
  canViewExit: false,
  canCreateExit: false,
  canUpdateExitStages: false,
  canViewLab: false,
  canCreateLab: false,
  canViewReports: false,
  canViewSummaryModal: false,
  canAccessCloudDb: false,
  canDeleteItems: false,
  canViewLetters: false,
  canManageLetters: false,
  canConfirmSata: false,
  canCloseCase: false,
  canEditCriticalClearance: false,
  canModifyCompletedExits: false,
  canManageTasks: false,
  canManageNotifications: false,
  canManageUsers: false,
  canManageRoles: false,
  canManageCompanySettings: false,
  canManageSystemConfig: false,
};

export interface PermissionGroupDefinition {
  id: string;
  title: string;
  moduleGate?: 'import' | 'export';
  items: Array<{
    key: keyof UserPermissions;
    label: string;
    sensitive?: boolean;
  }>;
}

export const PERMISSION_GROUPS: PermissionGroupDefinition[] = [
  {
    id: 'import',
    title: 'عملیات ورود کالا',
    moduleGate: 'import',
    items: [
      { key: 'canViewEntry', label: 'مشاهده کوتاژهای ورودی' },
      { key: 'canCreateEntry', label: 'ثبت کوتاژ ورودی جدید' },
      { key: 'canEditEntry', label: 'ویرایش کوتاژهای ورودی' },
    ],
  },
  {
    id: 'inventory',
    title: 'انبارداری و تجمیع کوتاژها',
    moduleGate: 'import',
    items: [
      { key: 'canCreateBatch', label: 'ایجاد و مدیریت تجمیع‌های انبار' },
      { key: 'canViewSummaryModal', label: 'مشاهده خلاصه موجودی و آمار کالاها' },
    ],
  },
  {
    id: 'export',
    title: 'عملیات خروج کالا، آزمایشگاه و ۹۰/۱۰',
    moduleGate: 'export',
    items: [
      { key: 'canViewExit', label: 'مشاهده بخش خروج کالا' },
      { key: 'canCreateExit', label: 'ثبت پرونده خروج جدید' },
      { key: 'canUpdateExitStages', label: 'تایید مراحل خروج (ارزیاب، جهاد، درب)' },
      { key: 'canViewLab', label: 'مشاهده سوابق آزمایشگاه' },
      { key: 'canCreateLab', label: 'ثبت سابقه آزمایشگاه جدید' },
      { key: 'canConfirmSata', label: 'تایید کد ساتا و آزادسازی ۱۰٪', sensitive: true },
      { key: 'canCloseCase', label: 'اختتام نهایی پرونده', sensitive: true },
      { key: 'canEditCriticalClearance', label: 'ویرایش مراحل حساس ۹۰/۱۰' },
      { key: 'canModifyCompletedExits', label: 'ویرایش/حذف خروج‌های فیزیکی ثبت‌شده', sensitive: true },
    ],
  },
  {
    id: 'reports',
    title: 'گزارش‌گیری و تحلیل‌ها',
    items: [
      { key: 'canViewReports', label: 'دسترسی به بخش گزارش‌گیری و چاپ' },
    ],
  },
  {
    id: 'documents',
    title: 'مدیریت اسناد، نامه‌ها و پیگیری‌ها',
    items: [
      { key: 'canViewLetters', label: 'مشاهده آرشیو نامه‌های گمرکی' },
      { key: 'canManageLetters', label: 'آپلود، ویرایش و حذف نامه‌ها' },
      { key: 'canManageTasks', label: 'مدیریت کارهای روزانه' },
      { key: 'canManageNotifications', label: 'مدیریت و بایگانی اعلان‌ها' },
    ],
  },
  {
    id: 'users_roles',
    title: 'مدیریت کاربران و نقش‌ها',
    items: [
      { key: 'canManageUsers', label: 'افزودن، ویرایش و غیرفعال‌سازی کاربران', sensitive: true },
      { key: 'canManageRoles', label: 'ایجاد و ویرایش نقش‌های دسترسی', sensitive: true },
    ],
  },
  {
    id: 'company_system',
    title: 'تنظیمات شرکت و پیکربندی سامانه',
    items: [
      { key: 'canManageCompanySettings', label: 'ویرایش پروفایل و عملیات شرکت', sensitive: true },
      { key: 'canManageSystemConfig', label: 'پیکربندی امنیتی و سیستمی', sensitive: true },
      { key: 'canAccessCloudDb', label: 'مدیریت اتصال و همگام‌سازی ابری', sensitive: true },
      { key: 'canDeleteItems', label: 'حذف کوتاژها و سوابق عملیاتی', sensitive: true },
    ],
  },
];

export const BUILT_IN_ROLE_TEMPLATES: Record<BuiltInRoleKey, OnboardingRoleDraft> = {
  owner: {
    key: 'owner',
    name: 'مالک شرکت (مدیر کل)',
    description: 'دسترسی کامل به تمامی بخش‌ها، تنظیمات شرکت، کاربران، نقش‌ها و اجرای مجدد راه‌اندازی',
    isSystem: true,
    isOwnerRole: true,
    permissions: { ...FULL_PERMISSIONS },
  },
  admin: {
    key: 'admin',
    name: 'مدیر شرکت',
    description: 'مدیریت عملیات روزمره، کاربران، نقش‌ها و تنظیمات شرکت (بدون حذف مالک)',
    isSystem: true,
    isOwnerRole: false,
    permissions: {
      ...FULL_PERMISSIONS,
    },
  },
  import_operator: {
    key: 'import_operator',
    name: 'اپراتور ورود کالا',
    description: 'ثبت، ویرایش و پیگیری کوتاژهای ورودی، نامه‌ها و کارهای روزانه',
    isSystem: true,
    isOwnerRole: false,
    permissions: {
      ...EMPTY_PERMISSIONS,
      canViewEntry: true,
      canCreateEntry: true,
      canEditEntry: true,
      canCreateBatch: true,
      canViewSummaryModal: true,
      canViewLetters: true,
      canManageLetters: true,
      canManageTasks: true,
      canManageNotifications: true,
    },
  },
  export_operator: {
    key: 'export_operator',
    name: 'اپراتور خروج کالا',
    description: 'مدیریت خروج کالا، آزمایشگاه، پیگیری مراحل درب خروج و ثبت خروج فیزیکی ۹۰/۱۰',
    isSystem: true,
    isOwnerRole: false,
    permissions: {
      ...EMPTY_PERMISSIONS,
      canViewExit: true,
      canCreateExit: true,
      canUpdateExitStages: true,
      canViewLab: true,
      canCreateLab: true,
      canEditCriticalClearance: true,
      canViewSummaryModal: true,
      canViewLetters: true,
      canManageLetters: true,
      canManageTasks: true,
      canManageNotifications: true,
    },
  },
  inventory_manager: {
    key: 'inventory_manager',
    name: 'مدیر انبار و تجمیع',
    description: 'کنترل موجودی پالت‌ها، تجمیع کوتاژها، مشاهده ورود/خروج و آمار تفکیکی کالاها',
    isSystem: true,
    isOwnerRole: false,
    permissions: {
      ...EMPTY_PERMISSIONS,
      canViewEntry: true,
      canEditEntry: true,
      canCreateBatch: true,
      canViewExit: true,
      canViewLab: true,
      canViewReports: true,
      canViewSummaryModal: true,
      canViewLetters: true,
      canManageTasks: true,
      canManageNotifications: true,
    },
  },
  report_viewer: {
    key: 'report_viewer',
    name: 'ناظر و مشاهده‌گر گزارش‌ها',
    description: 'دسترسی فقط‌خواندنی به گزارش‌ها، آمار تفکیکی، ورود/خروج و آرشیو نامه‌ها',
    isSystem: true,
    isOwnerRole: false,
    permissions: {
      ...EMPTY_PERMISSIONS,
      canViewEntry: true,
      canViewExit: true,
      canViewLab: true,
      canViewReports: true,
      canViewSummaryModal: true,
      canViewLetters: true,
    },
  },
};

export function createDefaultOnboardingRoles(): OnboardingRoleDraft[] {
  return Object.values(BUILT_IN_ROLE_TEMPLATES).map((role) => ({
    ...role,
    permissions: { ...role.permissions },
  }));
}

export function normalizePermissions(raw?: Partial<UserPermissions> | null): UserPermissions {
  const result: UserPermissions = { ...EMPTY_PERMISSIONS };
  if (!raw || typeof raw !== 'object') return result;
  for (const key of ALL_PERMISSION_KEYS) {
    if (key in raw) {
      result[key] = Boolean(raw[key]);
    }
  }
  return result;
}

export function operationModeToFlags(mode: BusinessOperationMode): {
  enableImport: boolean;
  enableExport: boolean;
} {
  if (mode === 'import_only') return { enableImport: true, enableExport: false };
  if (mode === 'export_only') return { enableImport: false, enableExport: true };
  return { enableImport: true, enableExport: true };
}

export function flagsToOperationMode(enableImport: boolean, enableExport: boolean): BusinessOperationMode {
  if (enableImport && !enableExport) return 'import_only';
  if (!enableImport && enableExport) return 'export_only';
  return 'both';
}

/**
 * Resolves effective permissions for an authenticated company member by intersecting:
 *   (Owner full grant OR Role permissions + per-user overrides)
 *   ∩ (Active company operational modules: enableImport / enableExport)
 *   ∩ (Active member status)
 */
export function resolveEffectivePermissions(params: {
  company: Pick<CompanyProfile, 'enableImport' | 'enableExport'>;
  rolePermissions?: Partial<UserPermissions> | null;
  permissionOverrides?: Partial<UserPermissions> | null;
  isOwner: boolean;
  status: 'active' | 'disabled';
}): UserPermissions {
  if (params.status !== 'active') {
    return { ...EMPTY_PERMISSIONS };
  }

  let merged: UserPermissions;
  if (params.isOwner) {
    merged = { ...FULL_PERMISSIONS };
  } else {
    merged = normalizePermissions(params.rolePermissions);
    if (params.permissionOverrides && typeof params.permissionOverrides === 'object') {
      for (const key of ALL_PERMISSION_KEYS) {
        if (typeof params.permissionOverrides[key] === 'boolean') {
          merged[key] = Boolean(params.permissionOverrides[key]);
        }
      }
    }
  }

  // Enforce company-level operational toggles strictly
  if (!params.company.enableImport) {
    merged.canViewEntry = false;
    merged.canCreateEntry = false;
    merged.canEditEntry = false;
    merged.canCreateBatch = false;
  }

  if (!params.company.enableExport) {
    merged.canViewExit = false;
    merged.canCreateExit = false;
    merged.canUpdateExitStages = false;
    merged.canViewLab = false;
    merged.canCreateLab = false;
    merged.canConfirmSata = false;
    merged.canCloseCase = false;
    merged.canEditCriticalClearance = false;
    merged.canModifyCompletedExits = false;
  }

  return merged;
}

/**
 * Anti-privilege-escalation guard:
 * A non-owner actor may NEVER grant any permission they do not hold themselves.
 */
export function validateNoPrivilegeEscalation(params: {
  actorIsOwner: boolean;
  actorPermissions: UserPermissions;
  targetPermissions: Partial<UserPermissions>;
}): { ok: boolean; deniedKeys: Array<keyof UserPermissions> } {
  if (params.actorIsOwner) {
    return { ok: true, deniedKeys: [] };
  }
  const deniedKeys: Array<keyof UserPermissions> = [];
  for (const key of ALL_PERMISSION_KEYS) {
    if (params.targetPermissions[key] === true && !params.actorPermissions[key]) {
      deniedKeys.push(key);
    }
  }
  return { ok: deniedKeys.length === 0, deniedKeys };
}

export function countEnabledPermissions(perms: Partial<UserPermissions>): number {
  let count = 0;
  for (const key of ALL_PERMISSION_KEYS) {
    if (perms[key] === true) count++;
  }
  return count;
}
