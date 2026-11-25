import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSavedSupabaseCredentials, getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { normalizePermissions, resolveEffectivePermissions } from '../utils/permissions';
import type {
  CompanyAuditLog,
  CompanyMember,
  CompanyProfile,
  CompanyRole,
  OnboardingPayload,
  UserPermissions,
  WorkspaceContextData,
  WorkspaceMembershipSummary,
} from '../types';

const ACTIVE_COMPANY_KEY = 'ctm_selected_company_id';

export function getSelectedCompanyId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_COMPANY_KEY);
  } catch {
    return null;
  }
}

export function setSelectedCompanyId(companyId: string | null): void {
  try {
    if (companyId) sessionStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    else sessionStorage.removeItem(ACTIVE_COMPANY_KEY);
  } catch {
    // ignore storage errors
  }
}

function requireSupabase(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) {
    const err = new Error('اتصال Supabase هنوز تنظیم نشده است. لطفاً آدرس و کلید Anon پروژه را وارد کنید.');
    (err as any).code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  return supabase;
}

/**
 * Isolated non-persisting Supabase client used strictly for signing up additional
 * team members without touching or replacing the active admin/owner session.
 */
function createEphemeralSupabaseClient(): SupabaseClient {
  const { url, key } = getSavedSupabaseCredentials();
  if (!url || !key) {
    throw new Error('اطلاعات اتصال Supabase برای ایجاد کاربر جدید در دسترس نیست.');
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `ctm_ephemeral_signup_${Date.now()}`,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
}

function isMissingRpcOrSchemaError(err: any): boolean {
  const code = String(err?.code || '').toUpperCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === '42883' ||
    code === '42P01' ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache') ||
    (msg.includes('function') && msg.includes('does not exist')) ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

function buildError(message: string, opts?: { status?: number; code?: string }): Error {
  const err = new Error(message);
  if (opts?.status !== undefined) (err as any).status = opts.status;
  if (opts?.code !== undefined) (err as any).code = opts.code;
  return err;
}

function translateSupabaseError(err: any, fallbackMessage: string): Error {
  if (!err) return buildError(fallbackMessage);

  if (isMissingRpcOrSchemaError(err)) {
    return buildError(
      'اسکریپت جدید پایگاه‌داده چندشرکتی (نسخه ۵.۱) هنوز در Supabase SQL Editor اجرا نشده است. لطفاً اسکریپت SQL را کپی کرده و در Supabase اجرا نمایید.',
      { code: 'SCHEMA_NOT_READY' }
    );
  }

  const rawMsg = String(err?.message || err?.error_description || '').trim();
  const upper = rawMsg.toUpperCase();
  const lower = rawMsg.toLowerCase();

  if (upper.includes('AUTH_REQUIRED')) {
    return buildError('نشست کاربری معتبر نیست. لطفاً مجدداً وارد سامانه شوید.', { status: 401, code: 'AUTH_REQUIRED' });
  }
  if (upper.includes('ACCOUNT_DISABLED')) {
    return buildError('حساب کاربری شما در این شرکت غیرفعال شده است. با مدیر شرکت تماس بگیرید.', {
      status: 403,
      code: 'ACCOUNT_DISABLED',
    });
  }
  if (upper.includes('NO_COMPANY_MEMBERSHIP')) {
    return buildError('حساب کاربری شما هنوز به هیچ شرکتی متصل نشده است. می‌توانید شرکت جدیدی ثبت کنید.', {
      status: 403,
      code: 'NO_COMPANY_MEMBERSHIP',
    });
  }
  if (upper.includes('FORBIDDEN') || upper.includes('OWNER_ONLY')) {
    return buildError('شما مجوز انجام این عملیات را ندارید.', { status: 403, code: 'FORBIDDEN' });
  }
  if (upper.includes('INVALID_COMPANY_NAME')) {
    return buildError('نام شرکت باید حداقل ۲ کاراکتر باشد.', { status: 400 });
  }
  if (upper.includes('AT_LEAST_ONE_OPERATION_REQUIRED')) {
    return buildError('حداقل یکی از عملیات ورود یا خروج باید فعال باشد.', { status: 400 });
  }
  if (upper.includes('INVALID_LOGO_URL') || upper.includes('LOGO_TOO_LARGE')) {
    return buildError('تصویر لوگو معتبر نیست یا حجم آن بیش از حد مجاز است.', { status: 400 });
  }
  if (upper.includes('LEGACY_COMPANY_ALREADY_CLAIMED')) {
    return buildError('فضای کاری شرکت اولیه قبلاً توسط مدیر دیگری تکمیل و ثبت شده است.', { status: 409 });
  }
  if (upper.includes('MEMBER_ALREADY_EXISTS')) {
    return buildError('این کاربر هم‌اکنون عضو این شرکت است.', { status: 409 });
  }
  if (upper.includes('PRIVILEGE_ESCALATION_DENIED')) {
    return buildError('امکان اعطای مجوزی فراتر از سطح دسترسی خودتان وجود ندارد.', { status: 403 });
  }
  if (upper.includes('ONLY_OWNER_CAN_ASSIGN_OWNER_ROLE') || upper.includes('CANNOT_EDIT_OWNER')) {
    return buildError('تنها مالک شرکت می‌تواند نقش مالک را مدیریت یا ویرایش کند.', { status: 403 });
  }
  if (upper.includes('CANNOT_DISABLE_SELF') || upper.includes('CANNOT_REMOVE_SELF')) {
    return buildError('امکان غیرفعال‌سازی یا حذف حساب کاربری خودتان وجود ندارد.', { status: 400 });
  }
  if (lower.includes('last active company owner')) {
    return buildError('امکان حذف، غیرفعال‌سازی یا تنزل آخرین مالک فعال شرکت وجود ندارد.', { status: 400 });
  }
  if (upper.includes('ROLE_IN_USE')) {
    return buildError('این نقش به یک یا چند کاربر اختصاص دارد و ابتدا باید نقش آن‌ها تغییر یابد.', { status: 400 });
  }
  if (upper.includes('CANNOT_DELETE_SYSTEM_ROLE') || upper.includes('CANNOT_EDIT_OWNER_ROLE')) {
    return buildError('نقش‌های سیستمی پایه یا نقش مالک قابل حذف یا تغییر ساختار نیستند.', { status: 400 });
  }
  if (upper.includes('AUTH_USER_NOT_FOUND')) {
    return buildError('حساب احراز هویت کاربر در Supabase Auth یافت نشد.', { status: 404 });
  }
  if (lower.includes('email rate limit exceeded') || lower.includes('over_email_send_rate_limit')) {
    return buildError(
      'محدودیت ارسال ایمیل Supabase Auth فعال شده است. در داشبورد Supabase بخش Authentication → Providers → Email گزینه Confirm email را خاموش کنید و چند دقیقه بعد دوباره تلاش نمایید.',
      { status: 429, code: 'RATE_LIMITED' }
    );
  }
  if (lower.includes('email not confirmed')) {
    return buildError(
      'ایمیل شما هنوز تایید نشده است. لینک ارسال‌شده به ایمیلتان را تایید کنید یا در داشبورد Supabase (Authentication → Providers → Email) گزینه Confirm email را غیرفعال نمایید.',
      { status: 403, code: 'EMAIL_CONFIRMATION_REQUIRED' }
    );
  }
  if (lower.includes('invalid login credentials')) {
    return buildError('ایمیل/نام کاربری یا رمز عبور اشتباه است.', { status: 401 });
  }
  if (lower.includes('password should be at least')) {
    return buildError('رمز عبور باید حداقل ۶ کاراکتر معتبر داشته باشد.', { status: 400 });
  }
  if (
    lower.includes('invalid api key') ||
    lower.includes('apikey') ||
    lower.includes('invalid jwt') ||
    lower.includes('no api key found')
  ) {
    return buildError(
      'کلید عمومی (Anon / Publishable Key) واردشده نامعتبر است. لطفاً کلید صحیح را از بخش Project Settings → API در داشبورد Supabase کپی کنید.',
      { status: 401, code: 'INVALID_API_KEY' }
    );
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return buildError('خطا در برقراری ارتباط با سرور Supabase. آدرس پروژه یا اتصال اینترنت را بررسی کنید.', {
      code: 'NETWORK_ERROR',
    });
  }

  return buildError(rawMsg || fallbackMessage);
}

function mapCompanyRow(row: any): CompanyProfile {
  return {
    id: String(row?.id || ''),
    name: String(row?.name || ''),
    slug: String(row?.slug || ''),
    logoUrl: String(row?.logo_url || row?.logoUrl || ''),
    registrationNumber: String(row?.registration_number || row?.registrationNumber || ''),
    nationalId: String(row?.national_id || row?.nationalId || ''),
    phone: String(row?.phone || ''),
    email: String(row?.email || ''),
    address: String(row?.address || ''),
    settings: (row?.settings && typeof row.settings === 'object' ? row.settings : {}) as Record<string, unknown>,
    enableImport: Boolean(row?.enable_import ?? row?.enableImport ?? true),
    enableExport: Boolean(row?.enable_export ?? row?.enableExport ?? true),
    onboardingCompleted: Boolean(row?.onboarding_completed ?? row?.onboardingCompleted ?? false),
    onboardingCompletedAt: row?.onboarding_completed_at ?? row?.onboardingCompletedAt ?? null,
    createdAt: row?.created_at ?? row?.createdAt,
    updatedAt: row?.updated_at ?? row?.updatedAt,
  };
}

function mapRoleRow(row: any): CompanyRole {
  return {
    id: String(row?.id || ''),
    companyId: String(row?.company_id || row?.companyId || ''),
    key: String(row?.key || ''),
    name: String(row?.name || ''),
    description: String(row?.description || ''),
    isSystem: Boolean(row?.is_system ?? row?.isSystem ?? false),
    isOwnerRole: Boolean(row?.is_owner_role ?? row?.isOwnerRole ?? false),
    permissions: normalizePermissions(row?.permissions),
  };
}

function mapMemberRow(row: any): CompanyMember {
  const joinedRole = row?.company_roles || row?.role || null;
  return {
    id: String(row?.id || ''),
    companyId: String(row?.company_id || row?.companyId || ''),
    userId: String(row?.user_id || row?.userId || ''),
    fullName: String(row?.full_name || row?.fullName || ''),
    email: String(row?.email || ''),
    username: String(row?.username || ''),
    roleId: String(row?.role_id || row?.roleId || ''),
    roleKey: String(row?.role_key || row?.roleKey || joinedRole?.key || ''),
    roleName: String(row?.role_name || row?.roleName || joinedRole?.name || ''),
    permissionOverrides: (row?.permission_overrides && typeof row.permission_overrides === 'object'
      ? row.permission_overrides
      : {}) as Partial<UserPermissions>,
    status: row?.status === 'disabled' ? 'disabled' : 'active',
    isOwner: Boolean(row?.is_owner ?? row?.isOwner ?? false),
    createdAt: row?.created_at ?? row?.createdAt,
  };
}

function mapAuditRow(row: any): CompanyAuditLog {
  return {
    id: String(row?.id || ''),
    companyId: String(row?.company_id || row?.companyId || ''),
    actorUserId: row?.actor_user_id ?? row?.actorUserId ?? null,
    action: String(row?.action || ''),
    details: (row?.details && typeof row.details === 'object' ? row.details : {}) as Record<string, unknown>,
    createdAt: String(row?.created_at || row?.createdAt || new Date().toISOString()),
  };
}

function requireActiveCompanyId(): string {
  const companyId = getSelectedCompanyId();
  if (!companyId) {
    throw buildError('فضای کاری شرکت فعال مشخص نیست. لطفاً صفحه را بازنشانی یا مجدداً وارد شوید.', {
      status: 400,
    });
  }
  return companyId;
}

/**
 * Authenticates or registers the company owner directly with Supabase Auth.
 * If the email is already registered, seamlessly verifies credentials via signInWithPassword.
 */
async function ensureOwnerAuthenticated(owner: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const supabase = requireSupabase();
  const cleanEmail = owner.email.trim().toLowerCase();

  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: cleanEmail,
    password: owner.password,
    options: {
      data: { full_name: owner.fullName.trim() },
    },
  });

  const alreadyRegistered =
    Boolean(signUpErr && /already registered|already exists/i.test(signUpErr.message || '')) ||
    Boolean(!signUpErr && signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0);

  if (alreadyRegistered) {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: owner.password,
    });
    if (signInErr || !signInData.session) {
      if (signInErr && /email not confirmed/i.test(signInErr.message || '')) {
        throw translateSupabaseError(signInErr, 'ایمیل شما هنوز تایید نشده است.');
      }
      throw buildError(
        'این ایمیل قبلاً در سامانه ثبت شده است و رمز عبور واردشده با آن مطابقت ندارد. لطفاً رمز عبور صحیح این ایمیل را وارد کنید یا از ایمیل دیگری استفاده نمایید.',
        { status: 401 }
      );
    }
    return {
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      email: signInData.user?.email || cleanEmail,
    };
  }

  if (signUpErr) {
    throw translateSupabaseError(signUpErr, 'خطا در ایجاد حساب کاربری مالک شرکت.');
  }

  if (signUpData.session) {
    return {
      accessToken: signUpData.session.access_token,
      refreshToken: signUpData.session.refresh_token,
      email: signUpData.user?.email || cleanEmail,
    };
  }

  // Fallback check: sometimes signInWithPassword works immediately if auto-confirm is on
  const { data: fallbackSignIn } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: owner.password,
  });
  if (fallbackSignIn?.session) {
    return {
      accessToken: fallbackSignIn.session.access_token,
      refreshToken: fallbackSignIn.session.refresh_token,
      email: fallbackSignIn.user?.email || cleanEmail,
    };
  }

  // Supabase "Confirm email" is enabled so no JWT session was issued yet
  throw buildError(
    'حساب شما ایجاد شد اما گزینه «تایید ایمیل (Confirm email)» در Supabase فعال است. برای تکمیل آنی ثبت شرکت، وارد داشبورد Supabase شوید ← Authentication ← Providers ← Email و تیک Confirm email را بردارید (یا ایمیل تایید را باز کنید)، سپس دوباره دکمه «تایید و ایجاد فضای کاری» را بزنید.',
    { status: 403, code: 'EMAIL_CONFIRMATION_REQUIRED' }
  );
}

/**
 * Provision additional team members using an isolated non-persisting Supabase client
 * so the owner's active session is never overwritten.
 */
async function provisionAdditionalUsers(
  companyId: string,
  roles: CompanyRole[],
  users: OnboardingPayload['additionalUsers']
): Promise<{ createdUsersCount: number; warnings: string[] }> {
  if (!users || users.length === 0) {
    return { createdUsersCount: 0, warnings: [] };
  }

  const supabase = requireSupabase();
  const ephemeral = createEphemeralSupabaseClient();
  const roleByKey = new Map(roles.map((r) => [r.key, r]));
  const fallbackRole = roles.find((r) => !r.isOwnerRole) || roles[0];

  let createdUsersCount = 0;
  const warnings: string[] = [];

  for (const userDraft of users) {
    const cleanEmail = userDraft.email.trim().toLowerCase();
    const targetRole = roleByKey.get(userDraft.roleKey) || fallbackRole;
    if (!targetRole) {
      warnings.push(`نقش مناسب برای کاربر ${cleanEmail} یافت نشد.`);
      continue;
    }

    try {
      let expectedUserId: string | null = null;
      const { data: signUpData, error: signUpErr } = await ephemeral.auth.signUp({
        email: cleanEmail,
        password: userDraft.password,
        options: {
          data: { full_name: userDraft.fullName.trim() },
        },
      });

      if (signUpData?.user?.id) {
        expectedUserId = signUpData.user.id;
      } else if (signUpErr && !/already registered|already exists/i.test(signUpErr.message || '')) {
        warnings.push(`ساخت حساب ${cleanEmail}: ${translateSupabaseError(signUpErr, signUpErr.message).message}`);
        continue;
      }

      const { error: rpcErr } = await supabase.rpc('add_company_member_rpc', {
        p_company_id: companyId,
        p_email: cleanEmail,
        p_full_name: userDraft.fullName.trim(),
        p_username: (userDraft.username || '').trim().toLowerCase(),
        p_role_id: targetRole.id,
        p_status: userDraft.status === 'disabled' ? 'disabled' : 'active',
        p_permission_overrides: userDraft.permissionOverrides || {},
        p_expected_user_id: expectedUserId,
      });

      if (rpcErr) {
        warnings.push(`اتصال کاربر ${cleanEmail}: ${translateSupabaseError(rpcErr, rpcErr.message).message}`);
      } else {
        createdUsersCount += 1;
      }
    } catch (err: any) {
      warnings.push(`خطا برای کاربر ${cleanEmail}: ${err?.message || 'خطای نامشخص'}`);
    }
  }

  return { createdUsersCount, warnings };
}

export interface ServerHealthStatus {
  ok: boolean;
  supabaseConfigured: boolean;
  adminConfigured: boolean;
  schemaReady: boolean;
  mode: 'supabase_direct';
}

export interface OnboardingSystemStatus {
  adminConfigured: boolean;
  schemaReady: boolean;
  hasUnclaimedLegacyCompany: boolean;
  legacyCompanyName?: string;
}

export async function fetchServerHealth(): Promise<ServerHealthStatus> {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return {
      ok: false,
      supabaseConfigured: false,
      adminConfigured: false,
      schemaReady: false,
      mode: 'supabase_direct',
    };
  }

  try {
    const status = await fetchOnboardingStatus();
    return {
      ok: status.schemaReady,
      supabaseConfigured: true,
      adminConfigured: status.schemaReady,
      schemaReady: status.schemaReady,
      mode: 'supabase_direct',
    };
  } catch {
    return {
      ok: false,
      supabaseConfigured: true,
      adminConfigured: false,
      schemaReady: false,
      mode: 'supabase_direct',
    };
  }
}

export async function fetchOnboardingStatus(): Promise<OnboardingSystemStatus> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      adminConfigured: false,
      schemaReady: false,
      hasUnclaimedLegacyCompany: false,
      legacyCompanyName: '',
    };
  }

  const { data, error } = await supabase.rpc('get_onboarding_status');
  if (error) {
    if (isMissingRpcOrSchemaError(error)) {
      return {
        adminConfigured: false,
        schemaReady: false,
        hasUnclaimedLegacyCompany: false,
        legacyCompanyName: '',
      };
    }
    throw translateSupabaseError(error, 'خطا در بررسی وضعیت پایگاه‌داده Supabase.');
  }

  return {
    adminConfigured: Boolean(data?.schemaReady),
    schemaReady: Boolean(data?.schemaReady),
    hasUnclaimedLegacyCompany: Boolean(data?.hasUnclaimedLegacyCompany),
    legacyCompanyName: String(data?.legacyCompanyName || ''),
  };
}

export async function loginWithIdentifier(identifier: string, password: string): Promise<{
  accessToken: string;
  refreshToken: string;
  email: string;
}> {
  const supabase = requireSupabase();
  const cleanId = identifier.trim();
  let targetEmail = cleanId.toLowerCase();

  if (!cleanId.includes('@')) {
    const { data: resolvedEmail, error: rpcErr } = await supabase.rpc('resolve_login_email', {
      p_username: cleanId.toLowerCase(),
    });
    if (rpcErr) {
      throw translateSupabaseError(rpcErr, 'خطا در بررسی نام کاربری.');
    }
    if (!resolvedEmail || typeof resolvedEmail !== 'string') {
      throw buildError('ایمیل/نام کاربری یا رمز عبور اشتباه است.', { status: 401 });
    }
    targetEmail = resolvedEmail.toLowerCase();
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password,
  });

  if (error || !data.session) {
    throw translateSupabaseError(error, 'ایمیل/نام کاربری یا رمز عبور اشتباه است.');
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    email: data.user?.email || targetEmail,
  };
}

export async function completeCompanyOnboarding(payload: OnboardingPayload): Promise<{
  company: CompanyProfile;
  ownerEmail: string;
  createdUsersCount: number;
  warnings?: string[];
  session?: { access_token: string; refresh_token: string } | null;
}> {
  const supabase = requireSupabase();
  if (!payload.owner) {
    throw buildError('اطلاعات مدیر ارشد (مالک شرکت) الزامی است.', { status: 400 });
  }

  const authSession = await ensureOwnerAuthenticated(payload.owner);

  const { data, error } = await supabase.rpc('complete_company_onboarding_rpc', {
    p_company: payload.company,
    p_operations: payload.operations,
    p_owner: {
      fullName: payload.owner.fullName,
      username: payload.owner.username || '',
    },
    p_roles: payload.roles || [],
  });

  if (error || !data?.company) {
    throw translateSupabaseError(error, 'خطا در ثبت شرکت جدید و ذخیره تنظیمات.');
  }

  const company = mapCompanyRow(data.company);
  const roles: CompanyRole[] = Array.isArray(data.roles) ? data.roles.map(mapRoleRow) : [];
  setSelectedCompanyId(company.id);

  const { createdUsersCount, warnings } = await provisionAdditionalUsers(
    company.id,
    roles,
    payload.additionalUsers
  );

  return {
    company,
    ownerEmail: authSession.email,
    createdUsersCount,
    warnings,
    session: {
      access_token: authSession.accessToken,
      refresh_token: authSession.refreshToken,
    },
  };
}

export async function claimLegacyCompany(payload: OnboardingPayload): Promise<{
  company: CompanyProfile;
  ownerEmail: string;
  createdUsersCount: number;
  warnings?: string[];
  session?: { access_token: string; refresh_token: string } | null;
}> {
  const supabase = requireSupabase();
  if (!payload.owner) {
    throw buildError('اطلاعات مدیر ارشد (مالک شرکت) الزامی است.', { status: 400 });
  }

  const authSession = await ensureOwnerAuthenticated(payload.owner);

  const { data, error } = await supabase.rpc('claim_legacy_company_rpc', {
    p_company: payload.company,
    p_operations: payload.operations,
    p_owner: {
      fullName: payload.owner.fullName,
      username: payload.owner.username || '',
    },
    p_roles: payload.roles || [],
  });

  if (error || !data?.company) {
    throw translateSupabaseError(error, 'خطا در تحویل و تکمیل راه‌اندازی شرکت اولیه.');
  }

  const company = mapCompanyRow(data.company);
  const roles: CompanyRole[] = Array.isArray(data.roles) ? data.roles.map(mapRoleRow) : [];
  setSelectedCompanyId(company.id);

  const { createdUsersCount, warnings } = await provisionAdditionalUsers(
    company.id,
    roles,
    payload.additionalUsers
  );

  return {
    company,
    ownerEmail: authSession.email,
    createdUsersCount,
    warnings,
    session: {
      access_token: authSession.accessToken,
      refresh_token: authSession.refreshToken,
    },
  };
}

export async function fetchWorkspaceContext(companyId?: string | null): Promise<WorkspaceContextData> {
  const supabase = requireSupabase();
  const targetCompanyId = companyId || getSelectedCompanyId() || null;

  const { data, error } = await supabase.rpc('get_workspace_context_rpc', {
    p_company_id: targetCompanyId,
  });

  if (error || !data?.company || !data?.member || !data?.role) {
    throw translateSupabaseError(error, 'خطا در دریافت اطلاعات فضای کاری شرکت.');
  }

  const company = mapCompanyRow(data.company);
  const member = mapMemberRow(data.member);
  const role = mapRoleRow(data.role);
  const roles: CompanyRole[] = Array.isArray(data.roles) ? data.roles.map(mapRoleRow) : [role];
  const members: CompanyMember[] = Array.isArray(data.members) ? data.members.map(mapMemberRow) : [];
  const allMemberships: WorkspaceMembershipSummary[] = Array.isArray(data.allMemberships)
    ? data.allMemberships
    : [];

  const effectivePermissions = resolveEffectivePermissions({
    company,
    rolePermissions: role.permissions,
    permissionOverrides: member.permissionOverrides,
    isOwner: member.isOwner,
    status: member.status,
  });

  return {
    company,
    member,
    role,
    effectivePermissions,
    roles,
    members,
    allMemberships,
  };
}

export async function updateCompanyProfileApi(patch: {
  name: string;
  logoUrl?: string;
  registrationNumber?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
}): Promise<{ company: CompanyProfile }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('update_company_profile_rpc', {
    p_company_id: companyId,
    p_patch: patch,
  });

  if (error || !data) {
    throw translateSupabaseError(error, 'خطا در به‌روزرسانی پروفایل شرکت.');
  }

  return { company: mapCompanyRow(data) };
}

export async function updateCompanyOperationsApi(patch: {
  enableImport: boolean;
  enableExport: boolean;
}): Promise<{ company: CompanyProfile }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('update_company_operations_rpc', {
    p_company_id: companyId,
    p_enable_import: patch.enableImport,
    p_enable_export: patch.enableExport,
  });

  if (error || !data) {
    throw translateSupabaseError(error, 'خطا در تغییر عملیات فعال شرکت.');
  }

  return { company: mapCompanyRow(data) };
}

export async function applyRestartOnboardingApi(payload: OnboardingPayload): Promise<{
  company: CompanyProfile;
  createdUsersCount: number;
  warnings?: string[];
}> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('apply_restart_onboarding_rpc', {
    p_company_id: companyId,
    p_company: payload.company,
    p_operations: payload.operations,
    p_roles: payload.roles || [],
  });

  if (error || !data?.company) {
    throw translateSupabaseError(error, 'خطا در اعمال تنظیمات مجدد شرکت.');
  }

  const company = mapCompanyRow(data.company);
  const roles: CompanyRole[] = Array.isArray(data.roles) ? data.roles.map(mapRoleRow) : [];

  const { createdUsersCount, warnings } = await provisionAdditionalUsers(
    company.id,
    roles,
    payload.additionalUsers
  );

  return { company, createdUsersCount, warnings };
}

export async function listCompanyUsersApi(): Promise<{ members: CompanyMember[] }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase
    .from('company_members')
    .select('*, company_roles(key, name)')
    .eq('company_id', companyId)
    .order('is_owner', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw translateSupabaseError(error, 'خطا در دریافت لیست کاربران شرکت.');
  }

  return { members: (data || []).map(mapMemberRow) };
}

export async function createCompanyUserApi(input: {
  fullName: string;
  email: string;
  username?: string;
  password: string;
  roleId: string;
  status?: 'active' | 'disabled';
  permissionOverrides?: Partial<UserPermissions>;
}): Promise<{ member: CompanyMember }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();
  const cleanEmail = input.email.trim().toLowerCase();

  let expectedUserId: string | null = null;
  const ephemeral = createEphemeralSupabaseClient();

  const { data: signUpData, error: signUpErr } = await ephemeral.auth.signUp({
    email: cleanEmail,
    password: input.password,
    options: {
      data: { full_name: input.fullName.trim() },
    },
  });

  if (signUpData?.user?.id) {
    expectedUserId = signUpData.user.id;
  } else if (signUpErr && !/already registered|already exists/i.test(signUpErr.message || '')) {
    throw translateSupabaseError(signUpErr, 'خطا در ایجاد حساب کاربری جدید.');
  }

  const { data, error } = await supabase.rpc('add_company_member_rpc', {
    p_company_id: companyId,
    p_email: cleanEmail,
    p_full_name: input.fullName.trim(),
    p_username: (input.username || '').trim().toLowerCase(),
    p_role_id: input.roleId,
    p_status: input.status === 'disabled' ? 'disabled' : 'active',
    p_permission_overrides: input.permissionOverrides || {},
    p_expected_user_id: expectedUserId,
  });

  if (error || !data) {
    throw translateSupabaseError(error, 'خطا در افزودن کاربر به شرکت.');
  }

  return { member: mapMemberRow(data) };
}

export async function updateCompanyUserApi(
  memberId: string,
  patch: {
    fullName?: string;
    username?: string;
    roleId?: string;
    permissionOverrides?: Partial<UserPermissions>;
  }
): Promise<{ member: CompanyMember }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('update_company_member_rpc', {
    p_company_id: companyId,
    p_member_id: memberId,
    p_patch: patch,
  });

  if (error || !data) {
    throw translateSupabaseError(error, 'خطا در ویرایش اطلاعات کاربر.');
  }

  return { member: mapMemberRow(data) };
}

export async function setCompanyUserStatusApi(
  memberId: string,
  status: 'active' | 'disabled'
): Promise<{ member: CompanyMember }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('set_company_member_status_rpc', {
    p_company_id: companyId,
    p_member_id: memberId,
    p_status: status,
  });

  if (error || !data) {
    throw translateSupabaseError(error, 'خطا در تغییر وضعیت کاربر.');
  }

  return { member: mapMemberRow(data) };
}

export async function removeCompanyUserApi(memberId: string): Promise<{ ok: boolean }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('remove_company_member_rpc', {
    p_company_id: companyId,
    p_member_id: memberId,
  });

  if (error) {
    throw translateSupabaseError(error, 'خطا در حذف کاربر از شرکت.');
  }

  return { ok: Boolean(data?.ok ?? true) };
}

export async function listCompanyRolesApi(): Promise<{ roles: CompanyRole[] }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase
    .from('company_roles')
    .select('*')
    .eq('company_id', companyId)
    .order('is_owner_role', { ascending: false })
    .order('is_system', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw translateSupabaseError(error, 'خطا در دریافت لیست نقش‌های شرکت.');
  }

  return { roles: (data || []).map(mapRoleRow) };
}

export async function createCompanyRoleApi(input: {
  name: string;
  description?: string;
  permissions: Partial<UserPermissions>;
}): Promise<{ role: CompanyRole }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('create_company_role_rpc', {
    p_company_id: companyId,
    p_name: input.name,
    p_description: input.description || '',
    p_permissions: input.permissions || {},
  });

  if (error || !data) {
    throw translateSupabaseError(error, 'خطا در ایجاد نقش جدید.');
  }

  return { role: mapRoleRow(data) };
}

export async function updateCompanyRoleApi(
  roleId: string,
  patch: {
    name?: string;
    description?: string;
    permissions?: Partial<UserPermissions>;
  }
): Promise<{ role: CompanyRole }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('update_company_role_rpc', {
    p_company_id: companyId,
    p_role_id: roleId,
    p_name: patch.name ?? null,
    p_description: patch.description ?? null,
    p_permissions: patch.permissions ?? null,
  });

  if (error || !data) {
    throw translateSupabaseError(error, 'خطا در ویرایش نقش.');
  }

  return { role: mapRoleRow(data) };
}

export async function deleteCompanyRoleApi(roleId: string): Promise<{ ok: boolean }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('delete_company_role_rpc', {
    p_company_id: companyId,
    p_role_id: roleId,
  });

  if (error) {
    throw translateSupabaseError(error, 'خطا در حذف نقش.');
  }

  return { ok: Boolean(data?.ok ?? true) };
}

export async function fetchCompanyAuditLogsApi(): Promise<{ logs: CompanyAuditLog[] }> {
  const supabase = requireSupabase();
  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase
    .from('company_audit_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw translateSupabaseError(error, 'خطا در دریافت گزارش رویدادهای ممیزی.');
  }

  return { logs: (data || []).map(mapAuditRow) };
}
