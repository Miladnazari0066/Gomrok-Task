import { UserRole } from '../components/LoginGate';
import { toJalali, WDN, JMONTHS, fa, pad2 } from './jalali';

// Storage keys
const SEC_KEYS = {
  SALT: 'gm_sec_salt',
  ADMIN_HASH: 'gm_sec_admin_hash',
  VIEWER_HASH: 'gm_sec_viewer_hash',
  MASTER_HASH: 'gm_sec_master_hash',
  LOGS: 'gm_sec_audit_logs',
  LOCKOUT: 'gm_sec_lockout_info',
  IDLE_TIMEOUT: 'gm_sec_idle_timeout_min',
  PASSWORD_CHANGED: 'gm_sec_pw_changed',
  SESSION_TOKEN: 'gm_sec_session_token',
};

// Default unhashed credentials (used only for initial seed before user customization)
const INITIAL_DEFAULTS = {
  ADMIN: '12345',
  VIEWER: '54321',
  MASTER: 'milad',
};

export interface SecurityLogEvent {
  id: string;
  timestamp: number;
  jalaliTime: string;
  type:
    | 'login_success'
    | 'login_failed'
    | 'lockout'
    | 'logout'
    | 'password_changed'
    | 'permission_changed'
    | 'doc_deleted'
    | 'doc_created'
    | 'data_cleared'
    | 'cloud_sync'
    | 'auto_lock'
    | 'unauthorized_attempt';
  user: string;
  role: string;
  description: string;
  severity: 'info' | 'warning' | 'danger';
}

// Pure JS SHA-256 implementation as reliable fallback
function sha256Fallback(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let compositeClear = ascii + '\x80';
  while ((compositeClear.length % 64) !== 56) compositeClear += '\x00';

  for (i = 0; i < compositeClear.length; i++) {
    j = compositeClear.charCodeAt(i);
    words[i >> 2] = (words[i >> 2] || 0) | (j << (((3 - i) % 4) * 8));
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] || 0;
      const w2 = w[i - 2] || 0;
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? (w[i] || 0)
            : ((w[i - 16] || 0) +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                (w[i - 7] || 0) +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

// Generate or retrieve persistent salt for password hashing
function getOrCreateSalt(): string {
  let salt = localStorage.getItem(SEC_KEYS.SALT);
  if (!salt || salt.length < 16) {
    const array = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < 16; i++) array[i] = Math.floor(Math.random() * 256);
    }
    salt = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(SEC_KEYS.SALT, salt);
  }
  return salt;
}

// Hash plain string with salt using standard SHA-256
export function hashString(plain: string): string {
  const salt = getOrCreateSalt();
  const salted = `__GOMROK_SALT__:${salt}:${plain.trim()}:__END__`;
  return sha256Fallback(salted);
}

// Format current timestamp in Jalali for audit logs
export function getNowJalaliFormatted(): string {
  const now = new Date();
  const j = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  return `${fa(j.jy)}/${pad2(j.jm)}/${pad2(j.jd)} - ${fa(time)}`;
}

// Ensure initial hashes are stored
export function initializeSecurity(): void {
  getOrCreateSalt();

  if (!localStorage.getItem(SEC_KEYS.ADMIN_HASH)) {
    localStorage.setItem(SEC_KEYS.ADMIN_HASH, hashString(INITIAL_DEFAULTS.ADMIN));
  }
  if (!localStorage.getItem(SEC_KEYS.VIEWER_HASH)) {
    localStorage.setItem(SEC_KEYS.VIEWER_HASH, hashString(INITIAL_DEFAULTS.VIEWER));
  }
  if (!localStorage.getItem(SEC_KEYS.MASTER_HASH)) {
    localStorage.setItem(SEC_KEYS.MASTER_HASH, hashString(INITIAL_DEFAULTS.MASTER));
  }
  if (!localStorage.getItem(SEC_KEYS.IDLE_TIMEOUT)) {
    localStorage.setItem(SEC_KEYS.IDLE_TIMEOUT, '15'); // 15 minutes default
  }
}

// Check if default credentials are still in use
export function isUsingDefaultPasswords(): boolean {
  return localStorage.getItem(SEC_KEYS.PASSWORD_CHANGED) !== 'true';
}

// -------------------------------------------------------------
// BRUTE-FORCE RATE LIMITING & LOCKOUT
// -------------------------------------------------------------
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

interface LockoutState {
  failedCount: number;
  lockoutUntil: number;
}

function getLockoutState(): LockoutState {
  try {
    const raw = localStorage.getItem(SEC_KEYS.LOCKOUT);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        failedCount: parsed.failedCount || 0,
        lockoutUntil: parsed.lockoutUntil || 0,
      };
    }
  } catch {
    // fallback
  }
  return { failedCount: 0, lockoutUntil: 0 };
}

function setLockoutState(state: LockoutState): void {
  localStorage.setItem(SEC_KEYS.LOCKOUT, JSON.stringify(state));
}

export function getLockoutRemainingSeconds(): number {
  const state = getLockoutState();
  const now = Date.now();
  if (state.lockoutUntil > now) {
    return Math.ceil((state.lockoutUntil - now) / 1000);
  }
  return 0;
}

export function isAccountLocked(): boolean {
  return getLockoutRemainingSeconds() > 0;
}

export function recordFailedAttempt(sourceContext: string = 'ورود به سامانه'): {
  locked: boolean;
  remainingSeconds: number;
  attemptsLeft: number;
} {
  const state = getLockoutState();
  const newCount = state.failedCount + 1;

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    setLockoutState({ failedCount: newCount, lockoutUntil });

    logSecurityEvent({
      type: 'lockout',
      user: 'ناشناس',
      role: 'ندارد',
      description: `مسدودسازی موقت سامانه به دلیل ${MAX_FAILED_ATTEMPTS} بار ورود ناموفق (${sourceContext})`,
      severity: 'danger',
    });

    return {
      locked: true,
      remainingSeconds: 60,
      attemptsLeft: 0,
    };
  }

  setLockoutState({ failedCount: newCount, lockoutUntil: 0 });
  const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - newCount);

  logSecurityEvent({
    type: 'login_failed',
    user: 'ناشناس',
    role: 'ندارد',
    description: `تلاش ناموفق برای ورود به سامانه (${sourceContext}). باقی‌مانده مجاز: ${attemptsLeft}`,
    severity: 'warning',
  });

  return {
    locked: false,
    remainingSeconds: 0,
    attemptsLeft,
  };
}

export function resetFailedAttempts(): void {
  setLockoutState({ failedCount: 0, lockoutUntil: 0 });
}

// -------------------------------------------------------------
// CREDENTIAL VERIFICATION
// -------------------------------------------------------------
export function verifyAdminAccessCode(code: string): boolean {
  initializeSecurity();
  const expectedHash = localStorage.getItem(SEC_KEYS.ADMIN_HASH);
  const inputHash = hashString(code);
  return Boolean(expectedHash && inputHash === expectedHash);
}

export function verifyViewerAccessCode(code: string): boolean {
  initializeSecurity();
  const expectedHash = localStorage.getItem(SEC_KEYS.VIEWER_HASH);
  const inputHash = hashString(code);
  return Boolean(expectedHash && inputHash === expectedHash);
}

export function verifyMasterPassword(password: string): boolean {
  initializeSecurity();
  const expectedHash = localStorage.getItem(SEC_KEYS.MASTER_HASH);
  const inputHash = hashString(password);
  // Also check if admin access code was entered as master password for convenience
  const adminHash = localStorage.getItem(SEC_KEYS.ADMIN_HASH);
  return Boolean((expectedHash && inputHash === expectedHash) || (adminHash && inputHash === adminHash));
}

// Check which role a given access code belongs to
export function checkAccessCodeRole(code: string): UserRole | null {
  if (isAccountLocked()) return null;

  if (verifyAdminAccessCode(code)) {
    resetFailedAttempts();
    return 'admin';
  }

  if (verifyViewerAccessCode(code)) {
    resetFailedAttempts();
    return 'viewer';
  }

  return null;
}

// -------------------------------------------------------------
// CREDENTIAL UPDATES (BY ADMIN)
// -------------------------------------------------------------
export function updateAdminAccessCode(newCode: string): boolean {
  if (!newCode || newCode.trim().length < 4) {
    throw new Error('کد دسترسی مدیر باید حداقل ۴ کاراکتر باشد.');
  }
  initializeSecurity();
  localStorage.setItem(SEC_KEYS.ADMIN_HASH, hashString(newCode.trim()));
  localStorage.setItem(SEC_KEYS.PASSWORD_CHANGED, 'true');

  logSecurityEvent({
    type: 'password_changed',
    user: 'مدیر',
    role: 'admin',
    description: 'کد دسترسی مدیریت با موفقیت تغییر یافت.',
    severity: 'info',
  });
  return true;
}

export function updateViewerAccessCode(newCode: string): boolean {
  if (!newCode || newCode.trim().length < 4) {
    throw new Error('کد دسترسی بازدیدکننده باید حداقل ۴ کاراکتر باشد.');
  }
  initializeSecurity();
  localStorage.setItem(SEC_KEYS.VIEWER_HASH, hashString(newCode.trim()));
  localStorage.setItem(SEC_KEYS.PASSWORD_CHANGED, 'true');

  logSecurityEvent({
    type: 'password_changed',
    user: 'مدیر',
    role: 'admin',
    description: 'کد دسترسی بازدیدکننده (ناظر) بروزرسانی شد.',
    severity: 'info',
  });
  return true;
}

export function updateMasterPassword(newPassword: string): boolean {
  if (!newPassword || newPassword.trim().length < 4) {
    throw new Error('رمز اصلی عملیات مدیریتی باید حداقل ۴ کاراکتر باشد.');
  }
  initializeSecurity();
  localStorage.setItem(SEC_KEYS.MASTER_HASH, hashString(newPassword.trim()));
  localStorage.setItem(SEC_KEYS.PASSWORD_CHANGED, 'true');

  logSecurityEvent({
    type: 'password_changed',
    user: 'مدیر',
    role: 'admin',
    description: 'رمز اصلی عملیات حساس (حذف و ویرایش اسناد) تغییر یافت.',
    severity: 'info',
  });
  return true;
}

// -------------------------------------------------------------
// INACTIVITY AUTO-LOCK SETTINGS
// -------------------------------------------------------------
export function getIdleTimeoutMinutes(): number {
  initializeSecurity();
  const val = parseInt(localStorage.getItem(SEC_KEYS.IDLE_TIMEOUT) || '15', 10);
  return isNaN(val) ? 15 : val;
}

export function setIdleTimeoutMinutes(minutes: number): void {
  initializeSecurity();
  localStorage.setItem(SEC_KEYS.IDLE_TIMEOUT, String(minutes));

  logSecurityEvent({
    type: 'permission_changed',
    user: 'مدیر',
    role: 'admin',
    description: `مدت زمان قفل خودکار عدم فعالیت به ${minutes === 0 ? 'غیرفعال' : `${fa(minutes)} دقیقه`} تغییر یافت.`,
    severity: 'info',
  });
}

// -------------------------------------------------------------
// SESSION INTEGRITY TOKEN
// -------------------------------------------------------------
export function createSessionToken(role: UserRole): string {
  const salt = getOrCreateSalt();
  const timestamp = Date.now();
  const raw = `${role}:${timestamp}:${salt}`;
  const token = sha256Fallback(raw);
  sessionStorage.setItem(SEC_KEYS.SESSION_TOKEN, token);
  return token;
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(SEC_KEYS.SESSION_TOKEN);
}

// -------------------------------------------------------------
// AUDIT LOGGING SYSTEM
// -------------------------------------------------------------
const MAX_LOGS = 120;

export function logSecurityEvent(
  event: Omit<SecurityLogEvent, 'id' | 'timestamp' | 'jalaliTime'>
): void {
  try {
    const raw = localStorage.getItem(SEC_KEYS.LOGS);
    const logs: SecurityLogEvent[] = raw ? JSON.parse(raw) : [];

    const newEvent: SecurityLogEvent = {
      ...event,
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      jalaliTime: getNowJalaliFormatted(),
    };

    const updated = [newEvent, ...logs].slice(0, MAX_LOGS);
    localStorage.setItem(SEC_KEYS.LOGS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to write security audit log:', e);
  }
}

export function getSecurityAuditLogs(): SecurityLogEvent[] {
  try {
    const raw = localStorage.getItem(SEC_KEYS.LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSecurityAuditLogs(): void {
  localStorage.setItem(SEC_KEYS.LOGS, JSON.stringify([]));
  logSecurityEvent({
    type: 'data_cleared',
    user: 'مدیر',
    role: 'admin',
    description: 'لاگ‌های امنیتی سیستم توسط مدیر پاکسازی شدند.',
    severity: 'warning',
  });
}

// -------------------------------------------------------------
// INPUT SANITIZER
// -------------------------------------------------------------
export function sanitizeInputText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[<>]/g, '') // strip html tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}
