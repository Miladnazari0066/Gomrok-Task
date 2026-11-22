import { getSupabase } from '../lib/supabase';
import type {
  CompanyAuditLog,
  CompanyMember,
  CompanyProfile,
  CompanyRole,
  OnboardingPayload,
  UserPermissions,
  WorkspaceContextData,
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
    // ignore
  }
}

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    requireAuth?: boolean;
    companyIdHeader?: string | null;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (options.requireAuth !== false) {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('نشست کاربری معتبر نیست. لطفاً مجدداً وارد سامانه شوید.');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const companyId = options.companyIdHeader ?? getSelectedCompanyId();
  if (companyId) {
    headers['X-Company-Id'] = companyId;
  }

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.error || `خطای سرور (${res.status})`);
    (err as any).status = res.status;
    (err as any).code = payload?.code;
    throw err;
  }
  return payload as T;
}

export interface ServerHealthStatus {
  ok: boolean;
  supabaseConfigured: boolean;
  adminConfigured: boolean;
}

export interface OnboardingSystemStatus {
  adminConfigured: boolean;
  hasUnclaimedLegacyCompany: boolean;
  legacyCompanyName?: string;
}

export async function fetchServerHealth(): Promise<ServerHealthStatus> {
  return apiRequest<ServerHealthStatus>('/api/health', { requireAuth: false });
}

export async function fetchOnboardingStatus(): Promise<OnboardingSystemStatus> {
  return apiRequest<OnboardingSystemStatus>('/api/onboarding/status', { requireAuth: false });
}

export async function loginWithIdentifier(identifier: string, password: string): Promise<{
  accessToken: string;
  refreshToken: string;
  email: string;
}> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    requireAuth: false,
    body: { identifier, password },
  });
}

export async function completeCompanyOnboarding(payload: OnboardingPayload): Promise<{
  company: CompanyProfile;
  ownerEmail: string;
  createdUsersCount: number;
  session?: { access_token: string; refresh_token: string } | null;
}> {
  return apiRequest('/api/onboarding/complete', {
    method: 'POST',
    requireAuth: false,
    body: payload,
  });
}

export async function claimLegacyCompany(payload: OnboardingPayload): Promise<{
  company: CompanyProfile;
  ownerEmail: string;
  createdUsersCount: number;
  session?: { access_token: string; refresh_token: string } | null;
}> {
  return apiRequest('/api/onboarding/claim-legacy', {
    method: 'POST',
    requireAuth: false,
    body: payload,
  });
}

export async function fetchWorkspaceContext(companyId?: string | null): Promise<WorkspaceContextData> {
  return apiRequest<WorkspaceContextData>('/api/workspace/context', {
    method: 'GET',
    requireAuth: true,
    companyIdHeader: companyId,
  });
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
  return apiRequest('/api/company/profile', {
    method: 'PATCH',
    body: patch,
  });
}

export async function updateCompanyOperationsApi(patch: {
  enableImport: boolean;
  enableExport: boolean;
}): Promise<{ company: CompanyProfile }> {
  return apiRequest('/api/company/operations', {
    method: 'PATCH',
    body: patch,
  });
}

export async function applyRestartOnboardingApi(payload: OnboardingPayload): Promise<{
  company: CompanyProfile;
  createdUsersCount: number;
}> {
  return apiRequest('/api/company/onboarding/apply', {
    method: 'POST',
    body: payload,
  });
}

export async function listCompanyUsersApi(): Promise<{ members: CompanyMember[] }> {
  return apiRequest('/api/company/users');
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
  return apiRequest('/api/company/users', {
    method: 'POST',
    body: input,
  });
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
  return apiRequest(`/api/company/users/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function setCompanyUserStatusApi(
  memberId: string,
  status: 'active' | 'disabled'
): Promise<{ member: CompanyMember }> {
  return apiRequest(`/api/company/users/${encodeURIComponent(memberId)}/status`, {
    method: 'POST',
    body: { status },
  });
}

export async function removeCompanyUserApi(memberId: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/company/users/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
}

export async function listCompanyRolesApi(): Promise<{ roles: CompanyRole[] }> {
  return apiRequest('/api/company/roles');
}

export async function createCompanyRoleApi(input: {
  name: string;
  description?: string;
  permissions: Partial<UserPermissions>;
}): Promise<{ role: CompanyRole }> {
  return apiRequest('/api/company/roles', {
    method: 'POST',
    body: input,
  });
}

export async function updateCompanyRoleApi(
  roleId: string,
  patch: {
    name?: string;
    description?: string;
    permissions?: Partial<UserPermissions>;
  }
): Promise<{ role: CompanyRole }> {
  return apiRequest(`/api/company/roles/${encodeURIComponent(roleId)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function deleteCompanyRoleApi(roleId: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/company/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
  });
}

export async function fetchCompanyAuditLogsApi(): Promise<{ logs: CompanyAuditLog[] }> {
  return apiRequest('/api/company/audit-logs');
}
