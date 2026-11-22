import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEYS = {
  URL: 'gm_supabase_url',
  KEY: 'gm_supabase_anon_key',
  AUTH_SESSION: 'ctm_supabase_auth_session',
};

/**
 * Built-in verified public Supabase project connection (Publishable Key only).
 * Supabase Publishable Keys (`sb_publishable_...`) are scoped public browser keys
 * protected by PostgreSQL RLS and SECURITY DEFINER RPCs.
 * Priority order: 1) User localStorage override -> 2) Build VITE_* env -> 3) Built-in public default.
 */
export const DEFAULT_PUBLIC_SUPABASE_URL = 'https://gwkuhfzwdgevnnovfehu.supabase.co';
export const DEFAULT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_o6wzEkoef5n7htKQhsMjiw_EyOYgtHB';

export type SupabaseConnectionSource = 'custom' | 'env' | 'default' | 'none';
export type SupabaseKeyKind = 'publishable' | 'anon_jwt' | 'secret' | 'unknown';

export interface SupabaseDiagnosticStep {
  status: 'ok' | 'warn' | 'error' | 'pending';
  title: string;
  message: string;
  technicalDetail?: string;
}

export interface SupabaseLiveTestResult {
  ok: boolean;
  connectionOk: boolean;
  schemaReady: boolean;
  emailAutoconfirm: boolean | null;
  hasUnclaimedLegacyCompany: boolean;
  legacyCompanyName: string;
  keyKind: SupabaseKeyKind;
  normalizedUrl: string;
  steps: {
    connection: SupabaseDiagnosticStep;
    authConfig: SupabaseDiagnosticStep;
    schema: SupabaseDiagnosticStep;
  };
}

function stripWrappingQuotes(value: string): string {
  let cleaned = value.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = stripWrappingQuotes(rawUrl);
  if (!cleaned) return '';
  // If user pasted a bare Supabase host like xxxxx.supabase.co, normalize to https://
  if (!/^https?:\/\//i.test(cleaned) && /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  cleaned = cleaned.replace(/\/+$|\/(rest|auth)\/v\d+\/?$/i, '');
  return cleaned;
}

export function sanitizeSupabaseKey(rawKey: string): string {
  if (!rawKey) return '';
  return stripWrappingQuotes(rawKey).replace(/\s+/g, '');
}

function isPlaceholderValue(val: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase().trim();
  return (
    lower.includes('your-project-id') ||
    lower.includes('your_project_id') ||
    lower.includes('your-supabase') ||
    lower.includes('your_supabase') ||
    lower.includes('example.com') ||
    lower.includes('placeholder') ||
    lower.includes('<project-id>') ||
    lower.includes('<anon-key>') ||
    lower.includes('<publishable-key>') ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower.length === 0
  );
}

export function isSecretSupabaseKey(key: string): boolean {
  const cleaned = sanitizeSupabaseKey(key);
  return /^sb_secret_/i.test(cleaned);
}

export function getSupabaseKeyKind(key: string): SupabaseKeyKind {
  const cleaned = sanitizeSupabaseKey(key);
  if (!cleaned) return 'unknown';
  if (/^sb_secret_/i.test(cleaned)) return 'secret';
  if (/^sb_publishable_/i.test(cleaned)) return 'publishable';
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cleaned)) return 'anon_jwt';
  return 'unknown';
}

export function isValidSupabaseUrl(url: string): boolean {
  if (!url || !url.startsWith('https://')) return false;
  if (isPlaceholderValue(url)) return false;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname || !parsed.hostname.includes('.')) return false;
    if (
      parsed.hostname === 'localhost' ||
      parsed.hostname.endsWith('.example.com') ||
      parsed.hostname === 'example.com'
    ) {
      return false;
    }
    if (parsed.hostname.includes('your-project') || parsed.hostname.includes('your_project')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isValidSupabaseKey(key: string): boolean {
  if (!key || key.length < 20) return false;
  if (isPlaceholderValue(key)) return false;
  if (isSecretSupabaseKey(key)) return false;
  return true;
}

export function hasCustomSupabaseOverride(): boolean {
  try {
    const storedUrl = sanitizeSupabaseUrl(localStorage.getItem(STORAGE_KEYS.URL) || '');
    const storedKey = sanitizeSupabaseKey(localStorage.getItem(STORAGE_KEYS.KEY) || '');
    return isValidSupabaseUrl(storedUrl) && isValidSupabaseKey(storedKey);
  } catch {
    return false;
  }
}

export function getSavedSupabaseCredentials(): {
  url: string;
  key: string;
  source: SupabaseConnectionSource;
} {
  const envObj: Record<string, string | undefined> =
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || {};
  const envUrl = sanitizeSupabaseUrl(envObj.VITE_SUPABASE_URL || '');
  const envPublishableKey = sanitizeSupabaseKey(envObj.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  const envAnonKey = sanitizeSupabaseKey(envObj.VITE_SUPABASE_ANON_KEY || '');
  const envKey = isValidSupabaseKey(envPublishableKey)
    ? envPublishableKey
    : isValidSupabaseKey(envAnonKey)
      ? envAnonKey
      : envPublishableKey || envAnonKey;

  let storedUrl = '';
  let storedKey = '';
  try {
    storedUrl = sanitizeSupabaseUrl(localStorage.getItem(STORAGE_KEYS.URL) || '');
    storedKey = sanitizeSupabaseKey(localStorage.getItem(STORAGE_KEYS.KEY) || '');
  } catch {
    // ignore storage errors in restricted environments
  }

  // Priority 1: Valid user-saved custom override in browser storage
  if (isValidSupabaseUrl(storedUrl) && isValidSupabaseKey(storedKey)) {
    return { url: storedUrl, key: storedKey, source: 'custom' };
  }

  // Priority 2: Valid build-time VITE_* environment variables
  if (isValidSupabaseUrl(envUrl) && isValidSupabaseKey(envKey)) {
    return { url: envUrl, key: envKey, source: 'env' };
  }

  // Priority 3: Built-in verified public project connection (Publishable Key)
  const defaultUrl = sanitizeSupabaseUrl(DEFAULT_PUBLIC_SUPABASE_URL);
  const defaultKey = sanitizeSupabaseKey(DEFAULT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (isValidSupabaseUrl(defaultUrl) && isValidSupabaseKey(defaultKey)) {
    return { url: defaultUrl, key: defaultKey, source: 'default' };
  }

  return {
    url: storedUrl || envUrl,
    key: storedKey || envKey,
    source: 'none',
  };
}

export function getSupabaseConnectionSource(): SupabaseConnectionSource {
  return getSavedSupabaseCredentials().source;
}

let supabaseInstance: SupabaseClient | null = null;
let currentClientKey = '';

export function getSupabase(): SupabaseClient | null {
  const { url, key } = getSavedSupabaseCredentials();
  if (!isValidSupabaseUrl(url) || !isValidSupabaseKey(key)) {
    supabaseInstance = null;
    currentClientKey = '';
    return null;
  }

  const clientKey = `${url}::${key}`;
  if (supabaseInstance && currentClientKey === clientKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: STORAGE_KEYS.AUTH_SESSION,
      },
    });
    currentClientKey = clientKey;
    return supabaseInstance;
  } catch (err) {
    console.warn('Notice: Could not initialize Supabase client:', err);
    supabaseInstance = null;
    currentClientKey = '';
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSavedSupabaseCredentials();
  return isValidSupabaseUrl(url) && isValidSupabaseKey(key);
}

export function validateSupabaseInputs(
  url: string,
  key: string
): { ok: boolean; error?: string; normalizedUrl: string; normalizedKey: string; keyKind: SupabaseKeyKind } {
  const normalizedUrl = sanitizeSupabaseUrl(url);
  const normalizedKey = sanitizeSupabaseKey(key);
  const keyKind = getSupabaseKeyKind(normalizedKey);

  if (!normalizedUrl) {
    return {
      ok: false,
      error: 'لطفاً آدرس پروژه Supabase (Project URL) را وارد کنید.',
      normalizedUrl,
      normalizedKey,
      keyKind,
    };
  }
  if (normalizedUrl.startsWith('http://')) {
    return {
      ok: false,
      error: 'آدرس پروژه Supabase باید با https:// شروع شود.',
      normalizedUrl,
      normalizedKey,
      keyKind,
    };
  }
  if (!isValidSupabaseUrl(normalizedUrl)) {
    return {
      ok: false,
      error: 'آدرس پروژه Supabase معتبر نیست (نمونه صحیح: https://xxxxx.supabase.co).',
      normalizedUrl,
      normalizedKey,
      keyKind,
    };
  }
  if (!normalizedKey) {
    return {
      ok: false,
      error: 'لطفاً کلید عمومی Publishable Key (یا Anon Key) را وارد کنید.',
      normalizedUrl,
      normalizedKey,
      keyKind,
    };
  }
  if (isSecretSupabaseKey(normalizedKey)) {
    return {
      ok: false,
      error: 'کلید محرمانه (sb_secret_...) در مرورگر مجاز نیست. لطفاً کلید عمومی Publishable Key (sb_publishable_...) را وارد کنید.',
      normalizedUrl,
      normalizedKey,
      keyKind,
    };
  }
  if (!isValidSupabaseKey(normalizedKey)) {
    return {
      ok: false,
      error: 'کلید عمومی (Publishable / Anon Key) واردشده کوتاه یا نامعتبر است.',
      normalizedUrl,
      normalizedKey,
      keyKind,
    };
  }

  return { ok: true, normalizedUrl, normalizedKey, keyKind };
}

export function saveSupabaseCredentialsDetailed(
  url: string,
  key: string
): { ok: boolean; error?: string; normalizedUrl?: string; normalizedKey?: string; keyKind?: SupabaseKeyKind } {
  try {
    const check = validateSupabaseInputs(url, key);
    if (!check.ok) {
      return { ok: false, error: check.error };
    }

    const previousUrl = sanitizeSupabaseUrl(localStorage.getItem(STORAGE_KEYS.URL) || '');
    const previousKey = sanitizeSupabaseKey(localStorage.getItem(STORAGE_KEYS.KEY) || '');

    localStorage.setItem(STORAGE_KEYS.URL, check.normalizedUrl);
    localStorage.setItem(STORAGE_KEYS.KEY, check.normalizedKey);

    // Clear stale auth tokens whenever switching Supabase project/key to avoid 401 Invalid JWT errors
    if (previousUrl !== check.normalizedUrl || previousKey !== check.normalizedKey) {
      try {
        localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      } catch {
        // ignore
      }
    }

    supabaseInstance = createClient(check.normalizedUrl, check.normalizedKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: STORAGE_KEYS.AUTH_SESSION,
      },
    });
    currentClientKey = `${check.normalizedUrl}::${check.normalizedKey}`;
    return {
      ok: true,
      normalizedUrl: check.normalizedUrl,
      normalizedKey: check.normalizedKey,
      keyKind: check.keyKind,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'ذخیره اطلاعات اتصال Supabase با خطا مواجه شد.',
    };
  }
}

export function saveSupabaseCredentials(url: string, key: string): boolean {
  return saveSupabaseCredentialsDetailed(url, key).ok;
}

export function clearSupabaseCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.URL);
    localStorage.removeItem(STORAGE_KEYS.KEY);
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  } catch {
    // ignore
  }
  supabaseInstance = null;
  currentClientKey = '';
}

/**
 * Performs a clean 3-stage live diagnostic directly against Supabase using ONLY
 * the provided Project URL and Publishable/Anon Key (immune to stale browser JWTs).
 *
 * Stage 1: Verify URL reachability & key acceptance via GET /auth/v1/settings
 * Stage 2: Inspect mailer_autoconfirm (Confirm email setting)
 * Stage 3: Verify Multi-Tenant SQL Schema v5.1 via POST /rest/v1/rpc/get_onboarding_status
 */
export async function testSupabaseConnectionLive(
  rawUrl: string,
  rawKey: string
): Promise<SupabaseLiveTestResult> {
  const check = validateSupabaseInputs(rawUrl, rawKey);
  if (!check.ok) {
    return {
      ok: false,
      connectionOk: false,
      schemaReady: false,
      emailAutoconfirm: null,
      hasUnclaimedLegacyCompany: false,
      legacyCompanyName: '',
      keyKind: check.keyKind,
      normalizedUrl: check.normalizedUrl,
      steps: {
        connection: {
          status: 'error',
          title: 'بررسی آدرس پروژه و کلید Publishable',
          message: check.error || 'اطلاعات اتصال نامعتبر است.',
        },
        authConfig: {
          status: 'pending',
          title: 'بررسی وضعیت تایید ایمیل (Confirm Email)',
          message: 'در انتظار تایید مرحله اول',
        },
        schema: {
          status: 'pending',
          title: 'بررسی اسکریپت چندشرکتی پایگاه‌داده (v5.1)',
          message: 'در انتظار تایید مرحله اول',
        },
      },
    };
  }

  const { normalizedUrl, normalizedKey, keyKind } = check;

  // Stage 1 & 2: Direct check against /auth/v1/settings (supports both sb_publishable_ and anon JWT)
  let authSettingsData: any = null;
  try {
    const authRes = await fetch(`${normalizedUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: normalizedKey,
        Accept: 'application/json',
      },
    });

    const bodyText = await authRes.text();
    let parsed: any = null;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsed = null;
    }

    if (!authRes.ok) {
      const serverMsg = parsed?.msg || parsed?.message || parsed?.error_description || bodyText.slice(0, 180);
      let friendlyMsg = `سرور Supabase درخواست را رد کرد (کد ${authRes.status}).`;
      if (authRes.status === 401 || authRes.status === 403) {
        friendlyMsg =
          'کلید عمومی (Publishable / Anon Key) توسط این پروژه تایید نشد (کد ۴۰۱). لطفاً مطمئن شوید کلید را دقیقاً از همین پروژه در بخش Project Settings → API Keys کپی کرده‌اید.';
      } else if (authRes.status === 404) {
        friendlyMsg =
          'آدرس پروژه Supabase صحیح نیست (کد ۴۰۴). آدرس باید دقیقاً به شکل https://xxxxx.supabase.co باشد.';
      }
      return {
        ok: false,
        connectionOk: false,
        schemaReady: false,
        emailAutoconfirm: null,
        hasUnclaimedLegacyCompany: false,
        legacyCompanyName: '',
        keyKind,
        normalizedUrl,
        steps: {
          connection: {
            status: 'error',
            title: 'بررسی آدرس پروژه و کلید Publishable',
            message: friendlyMsg,
            technicalDetail: `HTTP ${authRes.status}: ${serverMsg || 'No body'}`,
          },
          authConfig: {
            status: 'pending',
            title: 'بررسی وضعیت تایید ایمیل (Confirm Email)',
            message: 'در انتظار رفع خطای اتصال',
          },
          schema: {
            status: 'pending',
            title: 'بررسی اسکریپت چندشرکتی پایگاه‌داده (v5.1)',
            message: 'در انتظار رفع خطای اتصال',
          },
        },
      };
    }

    authSettingsData = parsed || {};
  } catch (err: any) {
    return {
      ok: false,
      connectionOk: false,
      schemaReady: false,
      emailAutoconfirm: null,
      hasUnclaimedLegacyCompany: false,
      legacyCompanyName: '',
      keyKind,
      normalizedUrl,
      steps: {
        connection: {
          status: 'error',
          title: 'بررسی آدرس پروژه و کلید Publishable',
          message:
            'امکان دسترسی شبکه‌ای به آدرس پروژه Supabase وجود ندارد. درستی آدرس، اتصال اینترنت یا وضعیت تحریم‌شکن/VPN را بررسی کنید.',
          technicalDetail: String(err?.message || err),
        },
        authConfig: {
          status: 'pending',
          title: 'بررسی وضعیت تایید ایمیل (Confirm Email)',
          message: 'در انتظار برقراری اتصال شبکه',
        },
        schema: {
          status: 'pending',
          title: 'بررسی اسکریپت چندشرکتی پایگاه‌داده (v5.1)',
          message: 'در انتظار برقراری اتصال شبکه',
        },
      },
    };
  }

  const emailAutoconfirm =
    typeof authSettingsData?.mailer_autoconfirm === 'boolean'
      ? Boolean(authSettingsData.mailer_autoconfirm)
      : null;

  const connectionStep: SupabaseDiagnosticStep = {
    status: 'ok',
    title: 'بررسی آدرس پروژه و کلید Publishable',
    message:
      keyKind === 'publishable'
        ? 'اتصال امن با کلید جدید Publishable Key با موفقیت تایید شد.'
        : 'اتصال امن با کلید عمومی پروژه با موفقیت تایید شد.',
  };

  const authConfigStep: SupabaseDiagnosticStep =
    emailAutoconfirm === true
      ? {
          status: 'ok',
          title: 'بررسی وضعیت تایید ایمیل (Confirm Email)',
          message: 'تایید ایمیل غیرفعال است؛ پس از ثبت شرکت جدید ورود به‌صورت فوری انجام می‌شود.',
        }
      : emailAutoconfirm === false
        ? {
            status: 'warn',
            title: 'بررسی وضعیت تایید ایمیل (Confirm Email)',
            message:
              'گزینه «Confirm email» در Supabase روشن است. برای ثبت شرکت بدون نیاز به لینک ایمیل، در مسیر Authentication → Providers → Email آن را خاموش کنید.',
          }
        : {
            status: 'ok',
            title: 'بررسی وضعیت تایید ایمیل (Confirm Email)',
            message: 'سرویس احراز هویت Supabase Auth فعال و در دسترس است.',
          };

  // Stage 3: Check Multi-Tenant SQL Schema v5.1 directly via PostgREST RPC
  // IMPORTANT: Never send sb_publishable_... in Authorization: Bearer (only legacy JWT anon keys go in Authorization)
  const restHeaders: Record<string, string> = {
    apikey: normalizedKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (keyKind === 'anon_jwt') {
    restHeaders['Authorization'] = `Bearer ${normalizedKey}`;
  }

  try {
    const rpcRes = await fetch(`${normalizedUrl}/rest/v1/rpc/get_onboarding_status`, {
      method: 'POST',
      headers: restHeaders,
      body: '{}',
    });

    const rpcText = await rpcRes.text();
    let rpcJson: any = null;
    try {
      rpcJson = rpcText ? JSON.parse(rpcText) : null;
    } catch {
      rpcJson = null;
    }

    if (rpcRes.ok && rpcJson?.schemaReady) {
      return {
        ok: true,
        connectionOk: true,
        schemaReady: true,
        emailAutoconfirm,
        hasUnclaimedLegacyCompany: Boolean(rpcJson.hasUnclaimedLegacyCompany),
        legacyCompanyName: String(rpcJson.legacyCompanyName || ''),
        keyKind,
        normalizedUrl,
        steps: {
          connection: connectionStep,
          authConfig: authConfigStep,
          schema: {
            status: 'ok',
            title: 'بررسی اسکریپت چندشرکتی پایگاه‌داده (v5.1)',
            message: 'جداول و توابع چندشرکتی (نسخه ۵.۱) نصب شده و آماده استفاده هستند.',
          },
        },
      };
    }

    const errCode = String(rpcJson?.code || '').toUpperCase();
    const errMsg = String(rpcJson?.message || rpcText || '').toLowerCase();
    const isMissingFn =
      rpcRes.status === 404 ||
      errCode === 'PGRST202' ||
      errCode === '42883' ||
      errMsg.includes('could not find the function') ||
      errMsg.includes('schema cache');

    if (isMissingFn) {
      return {
        ok: false,
        connectionOk: true,
        schemaReady: false,
        emailAutoconfirm,
        hasUnclaimedLegacyCompany: false,
        legacyCompanyName: '',
        keyKind,
        normalizedUrl,
        steps: {
          connection: connectionStep,
          authConfig: authConfigStep,
          schema: {
            status: 'warn',
            title: 'بررسی اسکریپت چندشرکتی پایگاه‌داده (v5.1)',
            message:
              'اتصال شما کاملاً سالم است! فقط لازم است اسکریپت SQL نسخه ۵.۱ را یک‌بار در Supabase SQL Editor اجرا کنید.',
            technicalDetail: rpcJson?.message || `HTTP ${rpcRes.status}`,
          },
        },
      };
    }

    return {
      ok: false,
      connectionOk: true,
      schemaReady: false,
      emailAutoconfirm,
      hasUnclaimedLegacyCompany: false,
      legacyCompanyName: '',
      keyKind,
      normalizedUrl,
      steps: {
        connection: connectionStep,
        authConfig: authConfigStep,
        schema: {
          status: 'error',
          title: 'بررسی اسکریپت چندشرکتی پایگاه‌داده (v5.1)',
          message: `بررسی توابع پایگاه‌داده با خطای غیرمنتظره مواجه شد (کد ${rpcRes.status}).`,
          technicalDetail: rpcJson?.message || rpcText.slice(0, 220),
        },
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      connectionOk: true,
      schemaReady: false,
      emailAutoconfirm,
      hasUnclaimedLegacyCompany: false,
      legacyCompanyName: '',
      keyKind,
      normalizedUrl,
      steps: {
        connection: connectionStep,
        authConfig: authConfigStep,
        schema: {
          status: 'error',
          title: 'بررسی اسکریپت چندشرکتی پایگاه‌داده (v5.1)',
          message: 'در بررسی لایه پایگاه‌داده (REST API) خطای شبکه رخ داد.',
          technicalDetail: String(err?.message || err),
        },
      },
    };
  }
}
