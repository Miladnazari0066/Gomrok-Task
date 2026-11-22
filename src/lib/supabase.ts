import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEYS = {
  URL: 'gm_supabase_url',
  KEY: 'gm_supabase_anon_key',
};

function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/+$|\/(rest|auth)\/v\d+\/?$/i, '');
  return cleaned;
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
    lower === 'undefined' ||
    lower === 'null' ||
    lower.length === 0
  );
}

function isValidSupabaseUrl(url: string): boolean {
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

function isValidSupabaseKey(key: string): boolean {
  if (!key || key.length < 20) return false;
  if (isPlaceholderValue(key)) return false;
  return true;
}

export function getSavedSupabaseCredentials(): { url: string; key: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  let storedUrl = '';
  let storedKey = '';
  try {
    storedUrl = localStorage.getItem(STORAGE_KEYS.URL) || '';
    storedKey = localStorage.getItem(STORAGE_KEYS.KEY) || '';
  } catch {
    // ignore storage errors in restricted environments
  }

  const rawUrl = envUrl || storedUrl;
  const rawKey = envKey || storedKey;

  const url = sanitizeUrl(rawUrl);
  const key = rawKey.trim();

  return { url, key };
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
        storageKey: 'ctm_supabase_auth_session',
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

export function saveSupabaseCredentials(url: string, key: string): boolean {
  try {
    const cleanedUrl = sanitizeUrl(url);
    const trimmedKey = key.trim();

    if (!isValidSupabaseUrl(cleanedUrl)) {
      throw new Error('آدرس معتبر نیست (باید با https:// شروع شود)');
    }
    if (!isValidSupabaseKey(trimmedKey)) {
      throw new Error('لطفاً کلید معتبر (Anon Key) را وارد کنید.');
    }

    localStorage.setItem(STORAGE_KEYS.URL, cleanedUrl);
    localStorage.setItem(STORAGE_KEYS.KEY, trimmedKey);

    supabaseInstance = createClient(cleanedUrl, trimmedKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'ctm_supabase_auth_session',
      },
    });
    currentClientKey = `${cleanedUrl}::${trimmedKey}`;
    return true;
  } catch (err: any) {
    console.warn('Notice: Invalid Supabase configuration:', err?.message || err);
    return false;
  }
}

export function clearSupabaseCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.URL);
    localStorage.removeItem(STORAGE_KEYS.KEY);
  } catch {
    // ignore
  }
  supabaseInstance = null;
  currentClientKey = '';
}
