import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  CompanyMember,
  CompanyProfile,
  CompanyRole,
  OnboardingPayload,
  OnboardingRoleDraft,
  UserPermissions,
  WorkspaceContextData,
  WorkspaceMembershipSummary,
} from './src/types';
import {
  BUILT_IN_ROLE_TEMPLATES,
  FULL_PERMISSIONS,
  normalizePermissions,
  resolveEffectivePermissions,
  validateNoPrivilegeEscalation,
} from './src/utils/permissions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEGACY_COMPANY_ID = '00000000-0000-4000-8000-000000000001';

// ==============================================================================
// SUPABASE SERVER CLIENTS (PRIVATE SERVICE ROLE — NEVER EXPOSED TO BROWSER)
// ==============================================================================

function getServerSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const isPlaceholder = (v: string) =>
    !v ||
    v.includes('your-project-id') ||
    v.includes('your-supabase') ||
    v.includes('placeholder') ||
    v.length < 20;

  return {
    url: isPlaceholder(url) ? '' : url,
    anonKey: isPlaceholder(anonKey) ? '' : anonKey,
    serviceRoleKey: isPlaceholder(serviceRoleKey) ? '' : serviceRoleKey,
  };
}

let cachedAdminClient: SupabaseClient | null = null;
let cachedAdminKey = '';

function getSupabaseAdmin(): SupabaseClient | null {
  const { url, serviceRoleKey } = getServerSupabaseConfig();
  if (!url || !serviceRoleKey) return null;
  const sig = `${url}::${serviceRoleKey.slice(0, 12)}`;
  if (cachedAdminClient && cachedAdminKey === sig) return cachedAdminClient;
  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  cachedAdminKey = sig;
  return cachedAdminClient;
}

function createEphemeralAuthClient(): SupabaseClient | null {
  const { url, anonKey, serviceRoleKey } = getServerSupabaseConfig();
  const key = anonKey || serviceRoleKey;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ==============================================================================
// INPUT SANITIZATION & VALIDATION HELPERS
// ==============================================================================

function sanitizeText(val: unknown, maxLen = 200): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isSafeLogoUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.length > 350_000) {
    throw new Error('حجم تصویر لوگو بیش از حد مجاز است.');
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // invalid URL
  }
  throw new Error('فرمت لوگوی شرکت معتبر نیست. فقط تصویر PNG/JPG/WEBP یا آدرس HTTPS مجاز است.');
}

function generateSlug(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  const suffix = crypto.randomBytes(4).toString('hex');
  return ascii ? `${ascii}-${suffix}` : `company-${suffix}`;
}

function generateRoleKey(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  const suffix = crypto.randomBytes(3).toString('hex');
  return ascii ? `custom_${ascii}_${suffix}` : `custom_role_${suffix}`;
}

// ==============================================================================
// ROW MAPPERS
// ==============================================================================

function mapCompanyRow(row: any): CompanyProfile {
  return {
    id: row.id,
    name: row.name || '',
    slug: row.slug || '',
    logoUrl: row.logo_url || '',
    registrationNumber: row.registration_number || '',
    nationalId: row.national_id || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    settings: row.settings || {},
    enableImport: Boolean(row.enable_import),
    enableExport: Boolean(row.enable_export),
    onboardingCompleted: Boolean(row.onboarding_completed),
    onboardingCompletedAt: row.onboarding_completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoleRow(row: any): CompanyRole {
  return {
    id: row.id,
    companyId: row.company_id,
    key: row.key,
    name: row.name,
    description: row.description || '',
    isSystem: Boolean(row.is_system),
    isOwnerRole: Boolean(row.is_owner_role),
    permissions: row.is_owner_role
      ? { ...FULL_PERMISSIONS }
      : normalizePermissions(row.permissions),
  };
}

function mapMemberRow(row: any, roleMap?: Map<string, CompanyRole>): CompanyMember {
  const role = roleMap?.get(row.role_id);
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    fullName: row.full_name || '',
    email: row.email || '',
    username: row.username || '',
    roleId: row.role_id,
    roleKey: role?.key,
    roleName: role?.name,
    permissionOverrides:
      row.permission_overrides && typeof row.permission_overrides === 'object'
        ? row.permission_overrides
        : {},
    status: row.status === 'disabled' ? 'disabled' : 'active',
    isOwner: Boolean(row.is_owner),
    createdAt: row.created_at,
  };
}

async function writeAuditLog(
  admin: SupabaseClient,
  companyId: string,
  actorUserId: string | null,
  action: string,
  details: Record<string, unknown> = {}
) {
  try {
    await admin.from('company_audit_logs').insert({
      company_id: companyId,
      actor_user_id: actorUserId,
      action,
      details,
    });
  } catch (err) {
    console.warn('Audit log notice:', err);
  }
}

// ==============================================================================
// AUTHENTICATED WORKSPACE MIDDLEWARE (NEVER TRUST CLIENT COMPANY_ID)
// ==============================================================================

interface AuthedWorkspaceContext {
  authUserId: string;
  authEmail: string;
  company: CompanyProfile;
  member: CompanyMember;
  role: CompanyRole;
  effectivePermissions: UserPermissions;
  allMemberships: WorkspaceMembershipSummary[];
}

interface AuthedRequest extends Request {
  workspace?: AuthedWorkspaceContext;
}

async function requireAuthWorkspace(req: AuthedRequest, res: Response, next: NextFunction) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    res.status(503).json({
      error: 'پیکربندی سرور Supabase (SUPABASE_SERVICE_ROLE_KEY) کامل نیست.',
      code: 'ADMIN_NOT_CONFIGURED',
    });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'توکن احراز هویت ارسال نشده است.', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      res.status(401).json({ error: 'نشست کاربری نامعتبر یا منقضی شده است.', code: 'INVALID_TOKEN' });
      return;
    }

    const userId = userData.user.id;
    const { data: memberRows, error: memErr } = await admin
      .from('company_members')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (memErr) {
      res.status(500).json({ error: 'خطا در بررسی عضویت شرکت.', code: 'DB_ERROR' });
      return;
    }

    if (!memberRows || memberRows.length === 0) {
      res.status(403).json({
        error: 'حساب کاربری شما هنوز به هیچ شرکتی متصل نشده است.',
        code: 'NO_COMPANY_MEMBERSHIP',
      });
      return;
    }

    const companyIds = memberRows.map((m: any) => m.company_id);
    const [{ data: companiesRows }, { data: rolesRows }] = await Promise.all([
      admin.from('companies').select('*').in('id', companyIds),
      admin.from('company_roles').select('*').in('company_id', companyIds),
    ]);

    const companyMap = new Map<string, CompanyProfile>(
      (companiesRows || []).map((c: any) => [c.id, mapCompanyRow(c)])
    );
    const roleMap = new Map<string, CompanyRole>(
      (rolesRows || []).map((r: any) => [r.id, mapRoleRow(r)])
    );

    const allMemberships: WorkspaceMembershipSummary[] = memberRows
      .map((m: any) => {
        const comp = companyMap.get(m.company_id);
        const role = roleMap.get(m.role_id);
        if (!comp) return null;
        return {
          companyId: comp.id,
          companyName: comp.name,
          companySlug: comp.slug,
          logoUrl: comp.logoUrl,
          roleName: role?.name || (m.is_owner ? 'مالک شرکت' : 'عضو'),
          isOwner: Boolean(m.is_owner),
          status: m.status === 'disabled' ? 'disabled' : 'active',
          onboardingCompleted: comp.onboardingCompleted,
        };
      })
      .filter(Boolean) as WorkspaceMembershipSummary[];

    const requestedCompanyId = (req.headers['x-company-id'] as string | undefined)?.trim();

    // Only accept requested companyId if it strictly matches one of the caller's verified DB memberships
    let selectedMemberRow = requestedCompanyId
      ? memberRows.find((m: any) => m.company_id === requestedCompanyId)
      : undefined;

    if (!selectedMemberRow) {
      selectedMemberRow =
        memberRows.find((m: any) => m.status === 'active') || memberRows[0];
    }

    if (selectedMemberRow.status !== 'active') {
      res.status(403).json({
        error: 'حساب کاربری شما در این شرکت غیرفعال شده است. با مدیر شرکت تماس بگیرید.',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    const company = companyMap.get(selectedMemberRow.company_id);
    const role = roleMap.get(selectedMemberRow.role_id);
    if (!company || !role) {
      res.status(403).json({ error: 'اطلاعات فضای کاری شرکت یافت نشد.', code: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const member = mapMemberRow(selectedMemberRow, roleMap);
    const effectivePermissions = resolveEffectivePermissions({
      company,
      rolePermissions: role.permissions,
      permissionOverrides: member.permissionOverrides,
      isOwner: member.isOwner,
      status: member.status,
    });

    req.workspace = {
      authUserId: userId,
      authEmail: userData.user.email || member.email,
      company,
      member,
      role,
      effectivePermissions,
      allMemberships,
    };

    next();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'خطای داخلی بررسی دسترسی' });
  }
}

// ==============================================================================
// SHARED ATOMIC ONBOARDING EXECUTOR (CREATE NEW COMPANY OR CLAIM LEGACY)
// ==============================================================================

async function executeOnboardingTransaction(
  admin: SupabaseClient,
  payload: OnboardingPayload,
  mode: 'create' | 'claim_legacy'
) {
  const companyName = sanitizeText(payload?.company?.name, 120);
  if (!companyName || companyName.length < 2) {
    throw Object.assign(new Error('نام شرکت الزامی است (حداقل ۲ کاراکتر).'), { status: 400 });
  }

  const enableImport = Boolean(payload?.operations?.enableImport);
  const enableExport = Boolean(payload?.operations?.enableExport);
  if (!enableImport && !enableExport) {
    throw Object.assign(new Error('حداقل یکی از عملیات واردات یا صادرات باید فعال باشد.'), { status: 400 });
  }

  const ownerFullName = sanitizeText(payload?.owner?.fullName, 100);
  const ownerEmail = sanitizeText(payload?.owner?.email, 160).toLowerCase();
  const ownerUsername = sanitizeText(payload?.owner?.username, 60).toLowerCase();
  const ownerPassword = typeof payload?.owner?.password === 'string' ? payload.owner.password : '';

  if (!ownerFullName || !isValidEmail(ownerEmail)) {
    throw Object.assign(new Error('نام کامل و ایمیل معتبر مدیر ارشد (مالک) الزامی است.'), { status: 400 });
  }
  if (ownerPassword.length < 8) {
    throw Object.assign(new Error('رمز عبور مدیر ارشد باید حداقل ۸ کاراکتر باشد.'), { status: 400 });
  }

  const logoUrl = isSafeLogoUrl(payload?.company?.logoUrl);
  const registrationNumber = sanitizeText(payload?.company?.registrationNumber, 80);
  const nationalId = sanitizeText(payload?.company?.nationalId, 80);
  const phone = sanitizeText(payload?.company?.phone, 60);
  const contactEmail = sanitizeText(payload?.company?.email, 160);
  const address = sanitizeText(payload?.company?.address, 300);

  // Validate additional users upfront before touching Supabase Auth
  const additionalUsers = Array.isArray(payload.additionalUsers) ? payload.additionalUsers : [];
  const seenEmails = new Set<string>([ownerEmail]);
  const sanitizedExtraUsers = additionalUsers.map((u, idx) => {
    const fullName = sanitizeText(u.fullName, 100);
    const email = sanitizeText(u.email, 160).toLowerCase();
    const username = sanitizeText(u.username, 60).toLowerCase();
    const password = typeof u.password === 'string' ? u.password : '';
    const roleKey = sanitizeText(u.roleKey, 60) || 'report_viewer';
    const status: 'active' | 'disabled' = u.status === 'disabled' ? 'disabled' : 'active';

    if (!fullName || !isValidEmail(email)) {
      throw Object.assign(
        new Error(`اطلاعات کاربر شماره ${idx + 1} (نام یا ایمیل) معتبر نیست.`),
        { status: 400 }
      );
    }
    if (seenEmails.has(email)) {
      throw Object.assign(new Error(`ایمیل «${email}» تکراری است.`), { status: 400 });
    }
    if (password.length < 8) {
      throw Object.assign(
        new Error(`رمز عبور کاربر «${fullName}» باید حداقل ۸ کاراکتر باشد.`),
        { status: 400 }
      );
    }
    seenEmails.add(email);
    return {
      fullName,
      email,
      username,
      password,
      roleKey,
      status,
      permissionOverrides:
        u.permissionOverrides && typeof u.permissionOverrides === 'object'
          ? u.permissionOverrides
          : {},
    };
  });

  // In claim_legacy mode, ensure the legacy company exists and has NO owner yet
  if (mode === 'claim_legacy') {
    const { data: existingLegacy } = await admin
      .from('companies')
      .select('id')
      .eq('id', LEGACY_COMPANY_ID)
      .maybeSingle();

    if (!existingLegacy) {
      throw Object.assign(new Error('شرکت اولیه منتقل‌شده برای ثبت مالکیت یافت نشد.'), { status: 404 });
    }

    const { count: ownerCount } = await admin
      .from('company_members')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', LEGACY_COMPANY_ID)
      .eq('is_owner', true);

    if ((ownerCount || 0) > 0) {
      throw Object.assign(new Error('مالک شرکت اولیه قبلاً ثبت شده است. لطفاً وارد سامانه شوید.'), {
        status: 409,
      });
    }
  }

  // Compensating rollback trackers
  const createdAuthUserIds: string[] = [];
  let createdCompanyId: string | null = null;

  try {
    // 1. Create Owner in Supabase Auth
    const { data: ownerAuth, error: ownerAuthErr } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { full_name: ownerFullName, username: ownerUsername },
    });

    if (ownerAuthErr || !ownerAuth?.user) {
      throw Object.assign(
        new Error(
          ownerAuthErr?.message?.includes('already')
            ? 'این ایمیل قبلاً در سامانه ثبت شده است. لطفاً ایمیل دیگری وارد کنید یا وارد شوید.'
            : ownerAuthErr?.message || 'خطا در ایجاد حساب مدیر ارشد در Supabase Auth'
        ),
        { status: 400 }
      );
    }
    createdAuthUserIds.push(ownerAuth.user.id);

    // 2. Create or update Company workspace row
    let companyRow: any;
    if (mode === 'claim_legacy') {
      const { data, error } = await admin
        .from('companies')
        .update({
          name: companyName,
          logo_url: logoUrl,
          registration_number: registrationNumber,
          national_id: nationalId,
          phone,
          email: contactEmail,
          address,
          enable_import: enableImport,
          enable_export: enableExport,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', LEGACY_COMPANY_ID)
        .select('*')
        .single();
      if (error || !data) throw new Error(error?.message || 'خطا در بروزرسانی اطلاعات شرکت اولیه');
      companyRow = data;
    } else {
      const { data, error } = await admin
        .from('companies')
        .insert({
          name: companyName,
          slug: generateSlug(companyName),
          logo_url: logoUrl,
          registration_number: registrationNumber,
          national_id: nationalId,
          phone,
          email: contactEmail,
          address,
          settings: payload.company.settings || {},
          enable_import: enableImport,
          enable_export: enableExport,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error || !data) throw new Error(error?.message || 'خطا در ایجاد فضای کاری شرکت');
      companyRow = data;
      createdCompanyId = data.id;
    }

    const companyId: string = companyRow.id;

    // 3. Seed System Roles + Custom Roles from Step 5
    const incomingRoles: OnboardingRoleDraft[] =
      Array.isArray(payload.roles) && payload.roles.length > 0
        ? payload.roles
        : Object.values(BUILT_IN_ROLE_TEMPLATES);

    const rolePayloads: Array<{
      company_id: string;
      key: string;
      name: string;
      description: string;
      is_system: boolean;
      is_owner_role: boolean;
      permissions: UserPermissions;
    }> = [];

    const seenKeys = new Set<string>();
    // Always ensure built-in Owner role exists with immutable full permissions
    rolePayloads.push({
      company_id: companyId,
      key: 'owner',
      name: BUILT_IN_ROLE_TEMPLATES.owner.name,
      description: BUILT_IN_ROLE_TEMPLATES.owner.description,
      is_system: true,
      is_owner_role: true,
      permissions: { ...FULL_PERMISSIONS },
    });
    seenKeys.add('owner');

    for (const r of incomingRoles) {
      const rawKey = sanitizeText(r.key, 60) || generateRoleKey(r.name || 'custom');
      if (seenKeys.has(rawKey)) continue;
      seenKeys.add(rawKey);
      const isBuiltIn = rawKey in BUILT_IN_ROLE_TEMPLATES;
      rolePayloads.push({
        company_id: companyId,
        key: rawKey,
        name: sanitizeText(r.name, 80) || rawKey,
        description: sanitizeText(r.description, 240),
        is_system: isBuiltIn,
        is_owner_role: false,
        permissions: normalizePermissions(r.permissions),
      });
    }

    const { data: insertedRoles, error: rolesErr } = await admin
      .from('company_roles')
      .upsert(rolePayloads, { onConflict: 'company_id,key' })
      .select('*');

    if (rolesErr || !insertedRoles) {
      throw new Error(rolesErr?.message || 'خطا در ایجاد نقش‌های دسترسی شرکت');
    }

    const roleIdByKey = new Map<string, string>(
      insertedRoles.map((r: any) => [r.key, r.id])
    );
    const ownerRoleId = roleIdByKey.get('owner')!;

    // 4. Assign Initial Owner Membership
    const { error: ownerMemErr } = await admin.from('company_members').insert({
      company_id: companyId,
      user_id: ownerAuth.user.id,
      full_name: ownerFullName,
      email: ownerEmail,
      username: ownerUsername,
      role_id: ownerRoleId,
      permission_overrides: {},
      status: 'active',
      is_owner: true,
    });
    if (ownerMemErr) {
      throw new Error(ownerMemErr.message || 'خطا در ثبت عضویت مالک شرکت');
    }

    // 5. Create Additional Users via Supabase Auth Admin API
    let createdUsersCount = 0;
    for (const extra of sanitizedExtraUsers) {
      const targetRoleId =
        roleIdByKey.get(extra.roleKey) ||
        roleIdByKey.get('report_viewer') ||
        ownerRoleId;
      const isExtraOwner = extra.roleKey === 'owner';

      const { data: extraAuth, error: extraAuthErr } = await admin.auth.admin.createUser({
        email: extra.email,
        password: extra.password,
        email_confirm: true,
        ban_duration: extra.status === 'disabled' ? '876000h' : 'none',
        user_metadata: { full_name: extra.fullName, username: extra.username },
      });

      if (extraAuthErr || !extraAuth?.user) {
        throw Object.assign(
          new Error(
            extraAuthErr?.message?.includes('already')
              ? `ایمیل «${extra.email}» قبلاً در سامانه ثبت شده است.`
              : `خطا در ایجاد کاربر «${extra.fullName}»: ${extraAuthErr?.message || ''}`
          ),
          { status: 400 }
        );
      }
      createdAuthUserIds.push(extraAuth.user.id);

      const { error: extraMemErr } = await admin.from('company_members').insert({
        company_id: companyId,
        user_id: extraAuth.user.id,
        full_name: extra.fullName,
        email: extra.email,
        username: extra.username,
        role_id: targetRoleId,
        permission_overrides: extra.permissionOverrides,
        status: extra.status,
        is_owner: isExtraOwner,
      });

      if (extraMemErr) {
        throw new Error(`خطا در ثبت عضویت کاربر «${extra.fullName}»: ${extraMemErr.message}`);
      }
      createdUsersCount++;
    }

    // 6. Initialize company lookup_options row if absent
    await admin.from('lookup_options').upsert(
      {
        id: `options_${companyId}`,
        company_id: companyId,
        importers: [],
        carriers: [],
        goods_list: [],
        brands: [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id', ignoreDuplicates: true }
    );

    await writeAuditLog(admin, companyId, ownerAuth.user.id, 'company_onboarding_completed', {
      mode,
      enableImport,
      enableExport,
      additionalUsersCreated: createdUsersCount,
    });

    // 7. Sign owner in so frontend receives a fresh Supabase Auth session immediately
    let session: { access_token: string; refresh_token: string } | null = null;
    const authClient = createEphemeralAuthClient();
    if (authClient) {
      const { data: signInData } = await authClient.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      });
      if (signInData?.session) {
        session = {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        };
      }
    }

    return {
      company: mapCompanyRow(companyRow),
      ownerEmail,
      createdUsersCount,
      session,
    };
  } catch (err) {
    // Compensating Rollback — guarantee zero partially configured companies
    if (createdCompanyId) {
      try {
        await admin.from('companies').delete().eq('id', createdCompanyId);
      } catch (rbErr) {
        console.error('Rollback company error:', rbErr);
      }
    }
    for (const uid of createdAuthUserIds) {
      try {
        await admin.auth.admin.deleteUser(uid);
      } catch (rbErr) {
        console.error('Rollback auth user error:', rbErr);
      }
    }
    throw err;
  }
}

// ==============================================================================
// EXPRESS APP & ROUTES
// ==============================================================================

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Health & Readiness (never exposes secrets)
  app.get('/api/health', (_req, res) => {
    const cfg = getServerSupabaseConfig();
    res.json({
      ok: true,
      supabaseConfigured: Boolean(cfg.url && cfg.anonKey),
      adminConfigured: Boolean(cfg.url && cfg.serviceRoleKey),
    });
  });

  // Check if an unclaimed migrated legacy company exists
  app.get('/api/onboarding/status', async (_req, res) => {
    const admin = getSupabaseAdmin();
    if (!admin) {
      res.json({ adminConfigured: false, hasUnclaimedLegacyCompany: false });
      return;
    }

    try {
      const { data: legacyCompany } = await admin
        .from('companies')
        .select('id, name, onboarding_completed')
        .eq('id', LEGACY_COMPANY_ID)
        .maybeSingle();

      if (!legacyCompany) {
        res.json({ adminConfigured: true, hasUnclaimedLegacyCompany: false });
        return;
      }

      const { count } = await admin
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', LEGACY_COMPANY_ID)
        .eq('is_owner', true);

      res.json({
        adminConfigured: true,
        hasUnclaimedLegacyCompany: (count || 0) === 0,
        legacyCompanyName: legacyCompany.name,
      });
    } catch {
      res.json({ adminConfigured: true, hasUnclaimedLegacyCompany: false });
    }
  });

  // Server-backed login supporting both Email and Username without leaking emails
  app.post('/api/auth/login', async (req, res) => {
    const identifier = sanitizeText(req.body?.identifier, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
      res.status(400).json({ error: 'لطفاً ایمیل/نام کاربری و رمز عبور را وارد کنید.' });
      return;
    }

    const admin = getSupabaseAdmin();
    const authClient = createEphemeralAuthClient();
    if (!admin || !authClient) {
      res.status(503).json({
        error: 'پیکربندی سرور Supabase کامل نیست. متغیرهای محیطی Supabase را تنظیم کنید.',
      });
      return;
    }

    try {
      let emailToUse = identifier;
      if (!identifier.includes('@')) {
        const { data: foundMember } = await admin
          .from('company_members')
          .select('email, status')
          .ilike('username', identifier)
          .limit(1)
          .maybeSingle();

        if (!foundMember?.email) {
          res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
          return;
        }
        if (foundMember.status !== 'active') {
          res.status(403).json({ error: 'حساب کاربری شما غیرفعال شده است.' });
          return;
        }
        emailToUse = foundMember.email;
      }

      const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (signInErr || !signInData?.session || !signInData?.user) {
        const msg = signInErr?.message?.toLowerCase().includes('banned')
          ? 'حساب کاربری شما غیرفعال شده است.'
          : 'ایمیل/نام کاربری یا رمز عبور اشتباه است.';
        res.status(signInErr?.message?.toLowerCase().includes('banned') ? 403 : 401).json({ error: msg });
        return;
      }

      // Verify at least one active company membership exists
      const { data: activeMemberships } = await admin
        .from('company_members')
        .select('id, status')
        .eq('user_id', signInData.user.id);

      if (!activeMemberships || activeMemberships.length === 0) {
        res.status(403).json({ error: 'حساب شما به هیچ فضای کاری شرکتی متصل نیست.' });
        return;
      }
      if (!activeMemberships.some((m: any) => m.status === 'active')) {
        res.status(403).json({ error: 'حساب کاربری شما در شرکت غیرفعال شده است.' });
        return;
      }

      res.json({
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
        email: signInData.user.email || emailToUse,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'خطا در ورود به سامانه' });
    }
  });

  // Complete new company onboarding atomically
  app.post('/api/onboarding/complete', async (req, res) => {
    const admin = getSupabaseAdmin();
    if (!admin) {
      res.status(503).json({
        error: 'کلید سرور Supabase (SUPABASE_SERVICE_ROLE_KEY) تنظیم نشده است.',
      });
      return;
    }

    try {
      const result = await executeOnboardingTransaction(admin, req.body as OnboardingPayload, 'create');
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err?.status || 500).json({ error: err?.message || 'خطا در راه‌اندازی شرکت' });
    }
  });

  // Claim migrated single-company legacy records with a new Supabase Auth Owner
  app.post('/api/onboarding/claim-legacy', async (req, res) => {
    const admin = getSupabaseAdmin();
    if (!admin) {
      res.status(503).json({
        error: 'کلید سرور Supabase (SUPABASE_SERVICE_ROLE_KEY) تنظیم نشده است.',
      });
      return;
    }

    try {
      const result = await executeOnboardingTransaction(
        admin,
        req.body as OnboardingPayload,
        'claim_legacy'
      );
      res.status(200).json(result);
    } catch (err: any) {
      res.status(err?.status || 500).json({ error: err?.message || 'خطا در ثبت مالکیت شرکت اولیه' });
    }
  });

  // Verified Workspace Context (company, member, role, effectivePermissions, roles, optional members)
  app.get('/api/workspace/context', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;

    try {
      const { data: roleRows } = await admin
        .from('company_roles')
        .select('*')
        .eq('company_id', ws.company.id)
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: true });

      const roles = (roleRows || []).map(mapRoleRow);
      const roleMap = new Map(roles.map((r) => [r.id, r]));

      let members: CompanyMember[] | undefined = undefined;
      if (ws.member.isOwner || ws.effectivePermissions.canManageUsers) {
        const { data: memberRows } = await admin
          .from('company_members')
          .select('*')
          .eq('company_id', ws.company.id)
          .order('is_owner', { ascending: false })
          .order('created_at', { ascending: true });
        members = (memberRows || []).map((m: any) => mapMemberRow(m, roleMap));
      }

      const responseData: WorkspaceContextData = {
        company: ws.company,
        member: ws.member,
        role: ws.role,
        effectivePermissions: ws.effectivePermissions,
        roles,
        members,
        allMemberships: ws.allMemberships,
      };
      res.json(responseData);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'خطا در دریافت اطلاعات فضای کاری' });
    }
  });

  // Update Company Profile
  app.patch('/api/company/profile', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageCompanySettings) {
      res.status(403).json({ error: 'شما مجوز ویرایش پروفایل شرکت را ندارید.' });
      return;
    }

    try {
      const name = sanitizeText(req.body?.name, 120);
      if (!name || name.length < 2) {
        res.status(400).json({ error: 'نام شرکت الزامی است.' });
        return;
      }
      const logoUrl =
        req.body?.logoUrl !== undefined ? isSafeLogoUrl(req.body.logoUrl) : ws.company.logoUrl;

      const { data, error } = await admin
        .from('companies')
        .update({
          name,
          logo_url: logoUrl,
          registration_number: sanitizeText(req.body?.registrationNumber, 80),
          national_id: sanitizeText(req.body?.nationalId, 80),
          phone: sanitizeText(req.body?.phone, 60),
          email: sanitizeText(req.body?.email, 160),
          address: sanitizeText(req.body?.address, 300),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ws.company.id)
        .select('*')
        .single();

      if (error || !data) throw new Error(error?.message || 'خطا در ذخیره پروفایل شرکت');

      await writeAuditLog(admin, ws.company.id, ws.authUserId, 'company_profile_updated', { name });
      res.json({ company: mapCompanyRow(data) });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'خطا در بروزرسانی پروفایل شرکت' });
    }
  });

  // Update Company Operational Modules (Non-Destructive)
  app.patch('/api/company/operations', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageCompanySettings) {
      res.status(403).json({ error: 'شما مجوز تغییر پیکربندی عملیات شرکت را ندارید.' });
      return;
    }

    const enableImport = Boolean(req.body?.enableImport);
    const enableExport = Boolean(req.body?.enableExport);
    if (!enableImport && !enableExport) {
      res.status(400).json({ error: 'حداقل یکی از ماژول‌های واردات یا صادرات باید فعال بماند.' });
      return;
    }

    try {
      const { data, error } = await admin
        .from('companies')
        .update({
          enable_import: enableImport,
          enable_export: enableExport,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ws.company.id)
        .select('*')
        .single();

      if (error || !data) throw new Error(error?.message || 'خطا در بروزرسانی عملیات شرکت');

      await writeAuditLog(admin, ws.company.id, ws.authUserId, 'company_operations_updated', {
        enableImport,
        enableExport,
      });
      res.json({ company: mapCompanyRow(data) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'خطا در بروزرسانی پیکربندی' });
    }
  });

  // Restart Setup Wizard Apply (Company Owner ONLY — NEVER deletes historical data or users)
  app.post('/api/company/onboarding/apply', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner) {
      res.status(403).json({ error: 'اجرای مجدد ویزارد راه‌اندازی فقط برای مالک شرکت مجاز است.' });
      return;
    }

    const payload = req.body as OnboardingPayload;
    const name = sanitizeText(payload?.company?.name, 120);
    if (!name || name.length < 2) {
      res.status(400).json({ error: 'نام شرکت الزامی است.' });
      return;
    }
    const enableImport = Boolean(payload?.operations?.enableImport);
    const enableExport = Boolean(payload?.operations?.enableExport);
    if (!enableImport && !enableExport) {
      res.status(400).json({ error: 'حداقل یکی از عملیات واردات یا صادرات باید فعال باشد.' });
      return;
    }

    const createdExtraAuthIds: string[] = [];
    try {
      const logoUrl =
        payload?.company?.logoUrl !== undefined
          ? isSafeLogoUrl(payload.company.logoUrl)
          : ws.company.logoUrl;

      const { data: updatedCompany, error: compErr } = await admin
        .from('companies')
        .update({
          name,
          logo_url: logoUrl,
          registration_number: sanitizeText(payload?.company?.registrationNumber, 80),
          national_id: sanitizeText(payload?.company?.nationalId, 80),
          phone: sanitizeText(payload?.company?.phone, 60),
          email: sanitizeText(payload?.company?.email, 160),
          address: sanitizeText(payload?.company?.address, 300),
          enable_import: enableImport,
          enable_export: enableExport,
          onboarding_completed: true,
          onboarding_completed_at: ws.company.onboardingCompletedAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ws.company.id)
        .select('*')
        .single();

      if (compErr || !updatedCompany) throw new Error(compErr?.message || 'خطا در ذخیره تنظیمات شرکت');

      // Upsert non-owner roles cleanly without removing existing roles in use
      if (Array.isArray(payload.roles)) {
        for (const r of payload.roles) {
          if (r.key === 'owner' || r.isOwnerRole) continue;
          const key = sanitizeText(r.key, 60) || generateRoleKey(r.name || 'custom');
          await admin.from('company_roles').upsert(
            {
              company_id: ws.company.id,
              key,
              name: sanitizeText(r.name, 80) || key,
              description: sanitizeText(r.description, 240),
              is_system: key in BUILT_IN_ROLE_TEMPLATES,
              is_owner_role: false,
              permissions: normalizePermissions(r.permissions),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'company_id,key' }
          );
        }
      }

      const { data: allRoleRows } = await admin
        .from('company_roles')
        .select('id, key')
        .eq('company_id', ws.company.id);
      const roleIdByKey = new Map<string, string>(
        (allRoleRows || []).map((r: any) => [r.key, r.id])
      );

      // Provision any newly added users queued during wizard restart (never deletes existing users)
      let createdUsersCount = 0;
      const newUsers = Array.isArray(payload.additionalUsers) ? payload.additionalUsers : [];
      for (const u of newUsers) {
        const email = sanitizeText(u.email, 160).toLowerCase();
        const fullName = sanitizeText(u.fullName, 100);
        const password = typeof u.password === 'string' ? u.password : '';
        if (!fullName || !isValidEmail(email) || password.length < 8) {
          throw new Error(`اطلاعات کاربر جدید «${fullName || email}» کامل نیست (رمز حداقل ۸ کاراکتر).`);
        }

        const { data: createdAuth, error: authErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          ban_duration: u.status === 'disabled' ? '876000h' : 'none',
          user_metadata: { full_name: fullName, username: sanitizeText(u.username, 60) },
        });
        if (authErr || !createdAuth?.user) {
          throw new Error(authErr?.message || `خطا در ایجاد کاربر «${email}»`);
        }
        createdExtraAuthIds.push(createdAuth.user.id);

        const targetRoleId =
          roleIdByKey.get(u.roleKey) || roleIdByKey.get('report_viewer') || ws.role.id;
        const { error: memErr } = await admin.from('company_members').insert({
          company_id: ws.company.id,
          user_id: createdAuth.user.id,
          full_name: fullName,
          email,
          username: sanitizeText(u.username, 60).toLowerCase(),
          role_id: targetRoleId,
          permission_overrides: u.permissionOverrides || {},
          status: u.status === 'disabled' ? 'disabled' : 'active',
          is_owner: u.roleKey === 'owner',
        });
        if (memErr) throw new Error(memErr.message);
        createdUsersCount++;
      }

      await writeAuditLog(admin, ws.company.id, ws.authUserId, 'company_onboarding_restarted', {
        enableImport,
        enableExport,
        createdUsersCount,
      });

      res.json({ company: mapCompanyRow(updatedCompany), createdUsersCount });
    } catch (err: any) {
      for (const uid of createdExtraAuthIds) {
        try {
          await admin.auth.admin.deleteUser(uid);
        } catch {
          // ignore
        }
      }
      res.status(400).json({ error: err?.message || 'خطا در اعمال تنظیمات ویزارد' });
    }
  });

  // ==============================================================================
  // USER MANAGEMENT ROUTES
  // ==============================================================================

  app.get('/api/company/users', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageUsers) {
      res.status(403).json({ error: 'شما مجوز مشاهده لیست کاربران شرکت را ندارید.' });
      return;
    }

    const [{ data: roleRows }, { data: memberRows, error }] = await Promise.all([
      admin.from('company_roles').select('*').eq('company_id', ws.company.id),
      admin
        .from('company_members')
        .select('*')
        .eq('company_id', ws.company.id)
        .order('is_owner', { ascending: false })
        .order('created_at', { ascending: true }),
    ]);

    if (error) {
      res.status(500).json({ error: 'خطا در دریافت لیست کاربران' });
      return;
    }

    const roleMap = new Map((roleRows || []).map((r: any) => [r.id, mapRoleRow(r)]));
    res.json({ members: (memberRows || []).map((m: any) => mapMemberRow(m, roleMap)) });
  });

  app.post('/api/company/users', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageUsers) {
      res.status(403).json({ error: 'شما مجوز ایجاد کاربر جدید را ندارید.' });
      return;
    }

    const fullName = sanitizeText(req.body?.fullName, 100);
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const username = sanitizeText(req.body?.username, 60).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const roleId = sanitizeText(req.body?.roleId, 60);
    const status: 'active' | 'disabled' = req.body?.status === 'disabled' ? 'disabled' : 'active';
    const overrides: Partial<UserPermissions> =
      req.body?.permissionOverrides && typeof req.body.permissionOverrides === 'object'
        ? req.body.permissionOverrides
        : {};

    if (!fullName || !isValidEmail(email)) {
      res.status(400).json({ error: 'نام کامل و ایمیل معتبر الزامی است.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'رمز عبور کاربر باید حداقل ۸ کاراکتر باشد.' });
      return;
    }

    // Verify role belongs strictly to this company
    const { data: roleRow } = await admin
      .from('company_roles')
      .select('*')
      .eq('id', roleId)
      .eq('company_id', ws.company.id)
      .maybeSingle();

    if (!roleRow) {
      res.status(400).json({ error: 'نقش انتخاب‌شده معتبر نیست.' });
      return;
    }
    const targetRole = mapRoleRow(roleRow);

    if (targetRole.isOwnerRole && !ws.member.isOwner) {
      res.status(403).json({ error: 'فقط مالک شرکت می‌تواند کاربر با نقش مالک ایجاد کند.' });
      return;
    }

    // Prevent privilege escalation beyond actor's own permissions
    const combinedTargetPerms = resolveEffectivePermissions({
      company: { enableImport: true, enableExport: true },
      rolePermissions: targetRole.permissions,
      permissionOverrides: overrides,
      isOwner: targetRole.isOwnerRole,
      status: 'active',
    });
    const escalationCheck = validateNoPrivilegeEscalation({
      actorIsOwner: ws.member.isOwner,
      actorPermissions: ws.effectivePermissions,
      targetPermissions: combinedTargetPerms,
    });
    if (!escalationCheck.ok) {
      res.status(403).json({
        error: 'امکان اعطای مجوزی بالاتر از سطح دسترسی خودتان وجود ندارد.',
        code: 'PRIVILEGE_ESCALATION_BLOCKED',
      });
      return;
    }

    let createdAuthUserId: string | null = null;
    try {
      const { data: authCreated, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        ban_duration: status === 'disabled' ? '876000h' : 'none',
        user_metadata: { full_name: fullName, username },
      });

      if (authErr || !authCreated?.user) {
        res.status(400).json({
          error: authErr?.message?.includes('already')
            ? 'این ایمیل قبلاً در سامانه ثبت شده است.'
            : authErr?.message || 'خطا در ایجاد حساب احراز هویت کاربر',
        });
        return;
      }
      createdAuthUserId = authCreated.user.id;

      const { data: insertedMember, error: memErr } = await admin
        .from('company_members')
        .insert({
          company_id: ws.company.id,
          user_id: authCreated.user.id,
          full_name: fullName,
          email,
          username,
          role_id: targetRole.id,
          permission_overrides: overrides,
          status,
          is_owner: targetRole.isOwnerRole,
        })
        .select('*')
        .single();

      if (memErr || !insertedMember) {
        throw new Error(memErr?.message || 'خطا در ثبت عضویت کاربر');
      }

      await writeAuditLog(admin, ws.company.id, ws.authUserId, 'member_created', {
        targetEmail: email,
        roleKey: targetRole.key,
      });

      const roleMap = new Map([[targetRole.id, targetRole]]);
      res.status(201).json({ member: mapMemberRow(insertedMember, roleMap) });
    } catch (err: any) {
      if (createdAuthUserId) {
        try {
          await admin.auth.admin.deleteUser(createdAuthUserId);
        } catch {
          // ignore
        }
      }
      res.status(400).json({ error: err?.message || 'خطا در ایجاد کاربر' });
    }
  });

  app.patch('/api/company/users/:memberId', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageUsers) {
      res.status(403).json({ error: 'شما مجوز ویرایش کاربران را ندارید.' });
      return;
    }

    const memberId = req.params.memberId;
    const { data: targetRow } = await admin
      .from('company_members')
      .select('*')
      .eq('id', memberId)
      .eq('company_id', ws.company.id)
      .maybeSingle();

    if (!targetRow) {
      res.status(404).json({ error: 'کاربر مورد نظر در این شرکت یافت نشد.' });
      return;
    }

    if (targetRow.is_owner && !ws.member.isOwner) {
      res.status(403).json({ error: 'شما مجاز به ویرایش حساب مالک شرکت نیستید.' });
      return;
    }

    // Prevent self-privilege escalation
    if (targetRow.id === ws.member.id && !ws.member.isOwner) {
      if (req.body?.roleId !== undefined && req.body.roleId !== targetRow.role_id) {
        res.status(403).json({ error: 'کاربر نمی‌تواند نقش یا سطح دسترسی خود را ارتقا دهد.' });
        return;
      }
      if (req.body?.permissionOverrides !== undefined) {
        res.status(403).json({ error: 'کاربر نمی‌تواند مجوزهای اختصاصی خود را تغییر دهد.' });
        return;
      }
    }

    const nextRoleId = sanitizeText(req.body?.roleId, 60) || targetRow.role_id;
    const { data: roleRow } = await admin
      .from('company_roles')
      .select('*')
      .eq('id', nextRoleId)
      .eq('company_id', ws.company.id)
      .maybeSingle();

    if (!roleRow) {
      res.status(400).json({ error: 'نقش انتخاب‌شده معتبر نیست.' });
      return;
    }
    const nextRole = mapRoleRow(roleRow);

    if (nextRole.isOwnerRole && !ws.member.isOwner) {
      res.status(403).json({ error: 'فقط مالک شرکت می‌تواند نقش مالک را تخصیص دهد.' });
      return;
    }

    const nextOverrides: Partial<UserPermissions> =
      req.body?.permissionOverrides !== undefined && typeof req.body.permissionOverrides === 'object'
        ? req.body.permissionOverrides
        : targetRow.permission_overrides || {};

    const combinedTargetPerms = resolveEffectivePermissions({
      company: { enableImport: true, enableExport: true },
      rolePermissions: nextRole.permissions,
      permissionOverrides: nextOverrides,
      isOwner: nextRole.isOwnerRole,
      status: 'active',
    });
    const escalationCheck = validateNoPrivilegeEscalation({
      actorIsOwner: ws.member.isOwner,
      actorPermissions: ws.effectivePermissions,
      targetPermissions: combinedTargetPerms,
    });
    if (!escalationCheck.ok) {
      res.status(403).json({ error: 'امکان اعطای مجوزی بالاتر از سطح دسترسی خودتان وجود ندارد.' });
      return;
    }

    // Last active owner protection before demotion
    if (targetRow.is_owner && !nextRole.isOwnerRole) {
      const { count: otherOwners } = await admin
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', ws.company.id)
        .eq('is_owner', true)
        .eq('status', 'active')
        .neq('id', targetRow.id);

      if ((otherOwners || 0) === 0) {
        res.status(400).json({
          error: 'امکان تنزل نقش آخرین مالک فعال شرکت وجود ندارد.',
          code: 'LAST_OWNER_PROTECTED',
        });
        return;
      }
    }

    const { data: updated, error } = await admin
      .from('company_members')
      .update({
        full_name:
          req.body?.fullName !== undefined
            ? sanitizeText(req.body.fullName, 100) || targetRow.full_name
            : targetRow.full_name,
        username:
          req.body?.username !== undefined
            ? sanitizeText(req.body.username, 60).toLowerCase()
            : targetRow.username,
        role_id: nextRole.id,
        permission_overrides: nextOverrides,
        is_owner: nextRole.isOwnerRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetRow.id)
      .eq('company_id', ws.company.id)
      .select('*')
      .single();

    if (error || !updated) {
      res.status(400).json({ error: error?.message || 'خطا در ویرایش کاربر' });
      return;
    }

    await writeAuditLog(admin, ws.company.id, ws.authUserId, 'member_updated', {
      memberId: targetRow.id,
      roleKey: nextRole.key,
    });

    const roleMap = new Map([[nextRole.id, nextRole]]);
    res.json({ member: mapMemberRow(updated, roleMap) });
  });

  app.post('/api/company/users/:memberId/status', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageUsers) {
      res.status(403).json({ error: 'شما مجوز تغییر وضعیت حساب کاربران را ندارید.' });
      return;
    }

    const nextStatus: 'active' | 'disabled' = req.body?.status === 'disabled' ? 'disabled' : 'active';
    const memberId = req.params.memberId;

    const { data: targetRow } = await admin
      .from('company_members')
      .select('*')
      .eq('id', memberId)
      .eq('company_id', ws.company.id)
      .maybeSingle();

    if (!targetRow) {
      res.status(404).json({ error: 'کاربر مورد نظر یافت نشد.' });
      return;
    }
    if (targetRow.is_owner && !ws.member.isOwner) {
      res.status(403).json({ error: 'امکان غیرفعال‌سازی مالک شرکت برای غیرمالک وجود ندارد.' });
      return;
    }
    if (targetRow.id === ws.member.id && nextStatus === 'disabled') {
      res.status(400).json({ error: 'شما نمی‌توانید حساب کاربری خودتان را غیرفعال کنید.' });
      return;
    }

    if (targetRow.is_owner && nextStatus === 'disabled') {
      const { count: otherOwners } = await admin
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', ws.company.id)
        .eq('is_owner', true)
        .eq('status', 'active')
        .neq('id', targetRow.id);

      if ((otherOwners || 0) === 0) {
        res.status(400).json({
          error: 'امکان غیرفعال‌سازی آخرین مالک فعال شرکت وجود ندارد.',
          code: 'LAST_OWNER_PROTECTED',
        });
        return;
      }
    }

    const { data: updated, error } = await admin
      .from('company_members')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', targetRow.id)
      .eq('company_id', ws.company.id)
      .select('*')
      .single();

    if (error || !updated) {
      res.status(400).json({ error: error?.message || 'خطا در تغییر وضعیت کاربر' });
      return;
    }

    // Enforce account lifecycle at Supabase Auth level too (if user has no other active companies)
    const { count: otherActiveMemberships } = await admin
      .from('company_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetRow.user_id)
      .eq('status', 'active');

    if (nextStatus === 'disabled' && (otherActiveMemberships || 0) === 0) {
      await admin.auth.admin.updateUserById(targetRow.user_id, { ban_duration: '876000h' });
    } else if (nextStatus === 'active') {
      await admin.auth.admin.updateUserById(targetRow.user_id, { ban_duration: 'none' });
    }

    await writeAuditLog(admin, ws.company.id, ws.authUserId, 'member_status_changed', {
      memberId: targetRow.id,
      status: nextStatus,
    });

    const { data: roleRow } = await admin
      .from('company_roles')
      .select('*')
      .eq('id', updated.role_id)
      .maybeSingle();
    const roleMap = roleRow ? new Map([[roleRow.id, mapRoleRow(roleRow)]]) : undefined;
    res.json({ member: mapMemberRow(updated, roleMap) });
  });

  app.delete('/api/company/users/:memberId', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageUsers) {
      res.status(403).json({ error: 'شما مجوز حذف کاربران را ندارید.' });
      return;
    }

    const memberId = req.params.memberId;
    const { data: targetRow } = await admin
      .from('company_members')
      .select('*')
      .eq('id', memberId)
      .eq('company_id', ws.company.id)
      .maybeSingle();

    if (!targetRow) {
      res.status(404).json({ error: 'کاربر مورد نظر یافت نشد.' });
      return;
    }
    if (targetRow.id === ws.member.id) {
      res.status(400).json({ error: 'امکان حذف حساب کاربری فعلی خودتان وجود ندارد.' });
      return;
    }
    if (targetRow.is_owner && !ws.member.isOwner) {
      res.status(403).json({ error: 'امکان حذف مالک شرکت توسط غیرمالک وجود ندارد.' });
      return;
    }

    if (targetRow.is_owner) {
      const { count: otherOwners } = await admin
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', ws.company.id)
        .eq('is_owner', true)
        .eq('status', 'active')
        .neq('id', targetRow.id);

      if ((otherOwners || 0) === 0) {
        res.status(400).json({
          error: 'امکان حذف آخرین مالک فعال شرکت وجود ندارد.',
          code: 'LAST_OWNER_PROTECTED',
        });
        return;
      }
    }

    const { error } = await admin
      .from('company_members')
      .delete()
      .eq('id', targetRow.id)
      .eq('company_id', ws.company.id);

    if (error) {
      res.status(400).json({ error: error.message || 'خطا در حذف کاربر' });
      return;
    }

    // If user belongs to no other companies, disable their auth login cleanly
    const { count: remaining } = await admin
      .from('company_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetRow.user_id);

    if ((remaining || 0) === 0) {
      await admin.auth.admin.updateUserById(targetRow.user_id, { ban_duration: '876000h' });
    }

    await writeAuditLog(admin, ws.company.id, ws.authUserId, 'member_removed', {
      removedEmail: targetRow.email,
    });

    res.json({ ok: true });
  });

  // ==============================================================================
  // ROLE MANAGEMENT ROUTES
  // ==============================================================================

  app.get('/api/company/roles', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    const { data, error } = await admin
      .from('company_roles')
      .select('*')
      .eq('company_id', ws.company.id)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      res.status(500).json({ error: 'خطا در دریافت نقش‌ها' });
      return;
    }
    res.json({ roles: (data || []).map(mapRoleRow) });
  });

  app.post('/api/company/roles', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageRoles) {
      res.status(403).json({ error: 'شما مجوز ایجاد نقش جدید را ندارید.' });
      return;
    }

    const name = sanitizeText(req.body?.name, 80);
    const description = sanitizeText(req.body?.description, 240);
    const permissions = normalizePermissions(req.body?.permissions);

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'نام نقش الزامی است.' });
      return;
    }

    const escalation = validateNoPrivilegeEscalation({
      actorIsOwner: ws.member.isOwner,
      actorPermissions: ws.effectivePermissions,
      targetPermissions: permissions,
    });
    if (!escalation.ok) {
      res.status(403).json({ error: 'نمی‌توانید نقشی با مجوزی بالاتر از دسترسی خود ایجاد کنید.' });
      return;
    }

    const { data, error } = await admin
      .from('company_roles')
      .insert({
        company_id: ws.company.id,
        key: generateRoleKey(name),
        name,
        description,
        is_system: false,
        is_owner_role: false,
        permissions,
      })
      .select('*')
      .single();

    if (error || !data) {
      res.status(400).json({ error: error?.message || 'خطا در ایجاد نقش' });
      return;
    }

    await writeAuditLog(admin, ws.company.id, ws.authUserId, 'role_created', { roleName: name });
    res.status(201).json({ role: mapRoleRow(data) });
  });

  app.patch('/api/company/roles/:roleId', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageRoles) {
      res.status(403).json({ error: 'شما مجوز ویرایش نقش‌ها را ندارید.' });
      return;
    }

    const { data: existing } = await admin
      .from('company_roles')
      .select('*')
      .eq('id', req.params.roleId)
      .eq('company_id', ws.company.id)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: 'نقش مورد نظر یافت نشد.' });
      return;
    }
    if (existing.is_owner_role) {
      res.status(400).json({ error: 'مجوزهای نقش مالک شرکت همواره کامل و غیرقابل تغییر است.' });
      return;
    }

    const permissions =
      req.body?.permissions !== undefined
        ? normalizePermissions(req.body.permissions)
        : normalizePermissions(existing.permissions);

    const escalation = validateNoPrivilegeEscalation({
      actorIsOwner: ws.member.isOwner,
      actorPermissions: ws.effectivePermissions,
      targetPermissions: permissions,
    });
    if (!escalation.ok) {
      res.status(403).json({ error: 'امکان اعطای مجوزی بالاتر از دسترسی خودتان وجود ندارد.' });
      return;
    }

    const { data, error } = await admin
      .from('company_roles')
      .update({
        name: req.body?.name !== undefined ? sanitizeText(req.body.name, 80) || existing.name : existing.name,
        description:
          req.body?.description !== undefined
            ? sanitizeText(req.body.description, 240)
            : existing.description,
        permissions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('company_id', ws.company.id)
      .select('*')
      .single();

    if (error || !data) {
      res.status(400).json({ error: error?.message || 'خطا در بروزرسانی نقش' });
      return;
    }

    await writeAuditLog(admin, ws.company.id, ws.authUserId, 'role_updated', { roleId: existing.id });
    res.json({ role: mapRoleRow(data) });
  });

  app.delete('/api/company/roles/:roleId', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (!ws.member.isOwner && !ws.effectivePermissions.canManageRoles) {
      res.status(403).json({ error: 'شما مجوز حذف نقش‌ها را ندارید.' });
      return;
    }

    const { data: existing } = await admin
      .from('company_roles')
      .select('*')
      .eq('id', req.params.roleId)
      .eq('company_id', ws.company.id)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: 'نقش مورد نظر یافت نشد.' });
      return;
    }
    if (existing.is_system || existing.is_owner_role) {
      res.status(400).json({ error: 'نقش‌های سیستمی قابل حذف نیستند.' });
      return;
    }

    const { count: assignedCount } = await admin
      .from('company_members')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', ws.company.id)
      .eq('role_id', existing.id);

    if ((assignedCount || 0) > 0) {
      res.status(400).json({
        error: 'این نقش به یک یا چند کاربر اختصاص داده شده است. ابتدا نقش کاربران را تغییر دهید.',
      });
      return;
    }

    const { error } = await admin
      .from('company_roles')
      .delete()
      .eq('id', existing.id)
      .eq('company_id', ws.company.id);

    if (error) {
      res.status(400).json({ error: error.message || 'خطا در حذف نقش' });
      return;
    }

    await writeAuditLog(admin, ws.company.id, ws.authUserId, 'role_deleted', { roleName: existing.name });
    res.json({ ok: true });
  });

  app.get('/api/company/audit-logs', requireAuthWorkspace, async (req: AuthedRequest, res) => {
    const admin = getSupabaseAdmin()!;
    const ws = req.workspace!;
    if (
      !ws.member.isOwner &&
      !ws.effectivePermissions.canManageCompanySettings &&
      !ws.effectivePermissions.canManageUsers
    ) {
      res.status(403).json({ error: 'شما مجوز مشاهده گزارش رویدادهای شرکت را ندارید.' });
      return;
    }

    const { data, error } = await admin
      .from('company_audit_logs')
      .select('*')
      .eq('company_id', ws.company.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ error: 'خطا در دریافت گزارش رویدادها' });
      return;
    }

    res.json({
      logs: (data || []).map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        actorUserId: row.actor_user_id,
        action: row.action,
        details: row.details || {},
        createdAt: row.created_at,
      })),
    });
  });

  return app;
}

// ==============================================================================
// BOOTSTRAP FULL-STACK SERVER (EXPRESS + VITE MIDDLEWARE IN DEV / DIST IN PROD)
// ==============================================================================

async function startServer() {
  const app = createApiApp();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });

    if (hmrDisabled) {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (!url || (!url.startsWith('.') && !url.startsWith('/'))) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.local');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + hash;
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Customs Task Management multi-tenant server running on http://0.0.0.0:${PORT}`);
  });
}

// Start only when executed directly (allows importing createApiApp in tests)
const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
