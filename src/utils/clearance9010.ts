import {
  ClearanceStatus,
  EntryClearanceInfo,
  EntryDoc,
  ExitDoc,
  JalaliDate,
  PhysicalExitTransaction,
} from '../types';
import { en, fa, j2d, todayJ } from './jalali';

export interface Split9010Result {
  totalPallets: number;
  firstStagePallets: number;
  remainingPallets: number;
}

export interface PalletBalances {
  totalPallets: number;
  firstStagePallets: number;
  remainingPallets: number;
  firstStageAuthorized: number;
  firstStageExited: number;
  firstStageRemaining: number;
  remainingStageExited: number;
  remainingStageAvailable: number;
  remainingStageLocked: boolean;
  totalExited: number;
  totalRemaining: number;
  sataReceived: boolean;
  sataConfirmed: boolean;
  isFullyExited: boolean;
}

export const CLEARANCE_STATUS_META: Record<
  ClearanceStatus,
  { label: string; shortLabel: string; badgeCls: string; color: string }
> = {
  awaiting_initial_clearance: {
    label: 'در انتظار ترخیص اولیه (۹۰٪)',
    shortLabel: 'انتظار ترخیص اولیه',
    badgeCls: 'bg-slate-500/15 border-slate-400/40 text-slate-300',
    color: '#94a3b8',
  },
  initial_90_completed: {
    label: 'ترخیص ۹۰٪ اول تکمیل شد',
    shortLabel: '۹۰٪ تکمیل شده',
    badgeCls: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300',
    color: '#06b6d4',
  },
  remaining_10_awaiting_sata: {
    label: '۱۰٪ باقی‌مانده در انتظار ساتا',
    shortLabel: 'انتظار ساتا (۱۰٪)',
    badgeCls: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
    color: '#f59e0b',
  },
  sata_received: {
    label: 'کد ساتا دریافت شد (در انتظار تایید)',
    shortLabel: 'ساتا دریافت‌شده',
    badgeCls: 'bg-orange-500/15 border-orange-400/40 text-orange-300',
    color: '#fb923c',
  },
  sata_confirmed: {
    label: 'کد ساتا تایید شد · ۱۰٪ آزاد',
    shortLabel: 'ساتا تاییدشده',
    badgeCls: 'bg-indigo-500/15 border-indigo-400/40 text-indigo-300',
    color: '#818cf8',
  },
  remaining_clearance_in_progress: {
    label: 'ترخیص ۱۰٪ باقی‌مانده در حال انجام',
    shortLabel: 'ترخیص ۱۰٪ در جریان',
    badgeCls: 'bg-blue-500/15 border-blue-400/40 text-blue-300',
    color: '#3b82f6',
  },
  fully_cleared: {
    label: 'ترخیص گمرکی کامل شد (در انتظار خروج فیزیکی)',
    shortLabel: 'ترخیص کامل',
    badgeCls: 'bg-teal-500/15 border-teal-400/40 text-teal-300',
    color: '#14b8a6',
  },
  fully_exited: {
    label: 'خروج فیزیکی کامل · آماده اختتام',
    shortLabel: 'خروج کامل فیزیکی',
    badgeCls: 'bg-purple-500/15 border-purple-400/40 text-purple-300',
    color: '#a855f7',
  },
  case_closed: {
    label: 'پرونده مختومه شد ✓',
    shortLabel: 'مختومه',
    badgeCls: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300',
    color: '#10b981',
  },
};

/**
 * Exact 90% / 10% integer split rule (never decimal):
 * firstStagePallets = Math.floor(totalPallets * 0.9)
 * remainingPallets = totalPallets - firstStagePallets
 */
export function calculateSplit9010(totalPallets: number): Split9010Result {
  const safeTotal = Math.max(0, Math.floor(Number(totalPallets) || 0));
  const firstStagePallets = Math.floor(safeTotal * 0.9);
  const remainingPallets = safeTotal - firstStagePallets;
  return {
    totalPallets: safeTotal,
    firstStagePallets,
    remainingPallets,
  };
}

/**
 * Infer MDF thickness from goods text when missing on legacy docs
 */
export function inferMdfThickness(goods: string): string {
  const clean = en(String(goods || '').trim());
  const matchMm = clean.match(/(\d+(?:\.\d+)?)\s*(?:mm|میل|میلیمتر)/i);
  if (matchMm) return `${matchMm[1]}mm`;
  const matchDim = clean.match(/\*\s*(3|8|12|16|18|25|32)(?:\b|$)/);
  if (matchDim) return `${matchDim[1]}mm`;
  return '';
}

export function createDefaultClearanceInfo(totalPallets: number, createdAt?: number): EntryClearanceInfo {
  const split = calculateSplit9010(totalPallets);
  return {
    status: split.firstStagePallets === 0 && split.remainingPallets > 0
      ? 'remaining_10_awaiting_sata'
      : 'awaiting_initial_clearance',
    firstStage: {
      status: split.firstStagePallets === 0 ? 'completed' : 'pending',
      clearanceDate: null,
      authorizedPallets: 0,
      documents: [],
      notes: '',
    },
    sata: {
      code: '',
      receivedDate: null,
      confirmed: false,
      confirmedDate: null,
      referenceLetterNo: '',
      documents: [],
      notes: '',
    },
    remainingStage: {
      status: 'locked',
      clearanceDate: null,
      documents: [],
      notes: '',
    },
    closure: {
      closed: false,
      closedDate: null,
      notes: '',
    },
    statusUpdatedAt: createdAt || Date.now(),
  };
}

export function normalizeEntryClearance(
  doc: EntryDoc,
  physicalExits: PhysicalExitTransaction[] = []
): EntryClearanceInfo {
  const base = createDefaultClearanceInfo(doc.pallets, doc.createdAt);
  const raw = doc.clearance;
  if (!raw) {
    const merged: EntryClearanceInfo = { ...base };
    merged.status = deriveClearanceStatus({ ...doc, clearance: merged }, physicalExits);
    return merged;
  }

  const split = calculateSplit9010(doc.pallets);
  const rawFirst = raw.firstStage || base.firstStage;
  const rawSata = raw.sata || base.sata;
  const rawRem = raw.remainingStage || base.remainingStage;
  const rawClosure = raw.closure || base.closure;

  const firstStatus =
    split.firstStagePallets === 0
      ? 'completed'
      : rawFirst.status || 'pending';

  const normalizedAuth =
    firstStatus === 'completed'
      ? Math.min(
          split.firstStagePallets,
          Math.max(0, Math.floor(rawFirst.authorizedPallets || split.firstStagePallets))
        )
      : Math.min(split.firstStagePallets, Math.max(0, Math.floor(rawFirst.authorizedPallets || 0)));

  const sataConfirmed = Boolean(rawSata.confirmed);
  let remStatus = rawRem.status || 'locked';
  if (!sataConfirmed && split.remainingPallets > 0) {
    remStatus = 'locked';
  } else if (sataConfirmed && remStatus === 'locked') {
    remStatus = 'ready';
  }

  const normalized: EntryClearanceInfo = {
    status: raw.status || base.status,
    firstStage: {
      status: firstStatus,
      clearanceDate: rawFirst.clearanceDate || null,
      authorizedPallets: normalizedAuth,
      documents: Array.isArray(rawFirst.documents) ? rawFirst.documents : [],
      notes: rawFirst.notes || '',
      updatedBy: rawFirst.updatedBy,
      updatedAt: rawFirst.updatedAt,
    },
    sata: {
      code: rawSata.code || '',
      receivedDate: rawSata.receivedDate || null,
      receivedBy: rawSata.receivedBy,
      confirmed: sataConfirmed,
      confirmedDate: rawSata.confirmedDate || null,
      confirmedBy: rawSata.confirmedBy,
      referenceLetterNo: rawSata.referenceLetterNo || '',
      documents: Array.isArray(rawSata.documents) ? rawSata.documents : [],
      notes: rawSata.notes || '',
    },
    remainingStage: {
      status: remStatus,
      clearanceDate: rawRem.clearanceDate || null,
      documents: Array.isArray(rawRem.documents) ? rawRem.documents : [],
      notes: rawRem.notes || '',
      updatedBy: rawRem.updatedBy,
      updatedAt: rawRem.updatedAt,
    },
    closure: {
      closed: Boolean(rawClosure.closed),
      closedDate: rawClosure.closedDate || null,
      closedBy: rawClosure.closedBy,
      notes: rawClosure.notes || '',
    },
    statusUpdatedAt: raw.statusUpdatedAt || doc.createdAt || Date.now(),
  };

  normalized.status = deriveClearanceStatus({ ...doc, clearance: normalized }, physicalExits);
  return normalized;
}

export function computePalletBalances(
  doc: EntryDoc,
  physicalExits: PhysicalExitTransaction[] = []
): PalletBalances {
  const split = calculateSplit9010(doc.pallets);
  const docExits = physicalExits.filter((t) => t.entryDocId === doc.id);

  const firstStageExited = docExits
    .filter((t) => t.stage === 'first_90')
    .reduce((sum, t) => sum + Math.max(0, Math.floor(t.pallets || 0)), 0);

  const remainingStageExited = docExits
    .filter((t) => t.stage === 'remaining_10')
    .reduce((sum, t) => sum + Math.max(0, Math.floor(t.pallets || 0)), 0);

  const rawFirst = doc.clearance?.firstStage;
  const firstStatus =
    split.firstStagePallets === 0 ? 'completed' : rawFirst?.status || 'pending';

  const firstStageAuthorized =
    firstStatus === 'completed'
      ? Math.min(
          split.firstStagePallets,
          Math.max(0, Math.floor(rawFirst?.authorizedPallets || split.firstStagePallets))
        )
      : Math.min(split.firstStagePallets, Math.max(0, Math.floor(rawFirst?.authorizedPallets || 0)));

  const firstStageRemaining = Math.max(0, firstStageAuthorized - firstStageExited);

  const sataCode = (doc.clearance?.sata?.code || '').trim();
  const sataReceived = Boolean(sataCode || doc.clearance?.sata?.receivedDate);
  const sataConfirmed = Boolean(doc.clearance?.sata?.confirmed);

  const remainingStageLocked = split.remainingPallets > 0 && !sataConfirmed;
  const remainingStageAvailable = remainingStageLocked
    ? 0
    : Math.max(0, split.remainingPallets - remainingStageExited);

  const totalExited = firstStageExited + remainingStageExited;
  const totalRemaining = Math.max(0, split.totalPallets - totalExited);
  const isFullyExited = split.totalPallets > 0 ? totalRemaining === 0 && totalExited === split.totalPallets : false;

  return {
    totalPallets: split.totalPallets,
    firstStagePallets: split.firstStagePallets,
    remainingPallets: split.remainingPallets,
    firstStageAuthorized,
    firstStageExited,
    firstStageRemaining,
    remainingStageExited,
    remainingStageAvailable,
    remainingStageLocked,
    totalExited,
    totalRemaining,
    sataReceived,
    sataConfirmed,
    isFullyExited,
  };
}

export function deriveClearanceStatus(
  doc: EntryDoc,
  physicalExits: PhysicalExitTransaction[] = []
): ClearanceStatus {
  const balances = computePalletBalances(doc, physicalExits);
  const c = doc.clearance;

  // Never auto-close: only closed when explicit closure flag is set
  if (c?.closure?.closed) {
    return 'case_closed';
  }

  if (balances.totalPallets > 0 && balances.isFullyExited) {
    return 'fully_exited';
  }

  const firstCompleted =
    balances.firstStagePallets === 0 || c?.firstStage?.status === 'completed';

  const remainingStageCompleted =
    balances.remainingPallets === 0 ||
    (balances.sataConfirmed && c?.remainingStage?.status === 'completed');

  if (firstCompleted && remainingStageCompleted) {
    return 'fully_cleared';
  }

  if (balances.sataConfirmed) {
    if (
      c?.remainingStage?.status === 'in_progress' ||
      balances.remainingStageExited > 0
    ) {
      return 'remaining_clearance_in_progress';
    }
    return 'sata_confirmed';
  }

  if (balances.sataReceived) {
    return 'sata_received';
  }

  if (firstCompleted) {
    if (
      balances.remainingPallets > 0 &&
      (balances.firstStageExited >= balances.firstStagePallets ||
        c?.remainingStage?.status === 'locked')
    ) {
      return balances.firstStageExited >= balances.firstStagePallets || balances.firstStagePallets === 0
        ? 'remaining_10_awaiting_sata'
        : 'initial_90_completed';
    }
    return 'initial_90_completed';
  }

  return 'awaiting_initial_clearance';
}

export function buildPhysicalExitFingerprint(input: {
  entryDocId: string;
  stage: 'first_90' | 'remaining_10';
  exitDate: JalaliDate;
  truckInfo: string;
  pallets: number;
}): string {
  const normTruck = en(String(input.truckInfo || '').trim().toLowerCase()).replace(/\s+/g, '');
  return `${input.entryDocId}|${input.stage}|${input.exitDate.jy}-${input.exitDate.jm}-${input.exitDate.jd}|${normTruck}|${Math.floor(input.pallets)}`;
}

export interface PhysicalExitValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePhysicalExitTransaction(
  input: {
    id?: string;
    entryDocId: string;
    stage: 'first_90' | 'remaining_10';
    exitDate: JalaliDate;
    truckInfo: string;
    pallets: number;
    driverInfo?: string;
  },
  doc: EntryDoc,
  existingTransactions: PhysicalExitTransaction[]
): PhysicalExitValidationResult {
  if (!doc) {
    return { valid: false, error: 'سند ورود مرجع یافت نشد.' };
  }

  if (doc.clearance?.closure?.closed) {
    return { valid: false, error: 'این پرونده مختومه شده است و امکان ثبت یا تغییر خروج فیزیکی جدید وجود ندارد.' };
  }

  if (typeof input.pallets !== 'number' || !Number.isFinite(input.pallets) || !Number.isInteger(input.pallets) || input.pallets <= 0) {
    return { valid: false, error: 'تعداد پالت باید یک عدد صحیح و بزرگ‌تر از صفر باشد (پالت اعشاری مجاز نیست).' };
  }

  const cleanTruck = (input.truckInfo || '').trim();
  if (!cleanTruck) {
    return { valid: false, error: 'مشخصات کامیون / تریلی (شماره پلاک یا کد) الزامی است.' };
  }

  if (!input.exitDate || !input.exitDate.jy || !input.exitDate.jm || !input.exitDate.jd) {
    return { valid: false, error: 'تاریخ خروج فیزیکی نامعتبر است.' };
  }

  // Exclude self when editing an existing transaction
  const otherTx = existingTransactions.filter((t) => t.id !== input.id);
  const balances = computePalletBalances(doc, otherTx);

  if (balances.totalPallets <= 0) {
    return { valid: false, error: 'برای این کوتاژ تعداد پالت کل (بزرگ‌تر از صفر) ثبت نشده است.' };
  }

  // Total shipment cap check
  if (balances.totalExited + input.pallets > balances.totalPallets) {
    return {
      valid: false,
      error: `مجموع خروج فیزیکی (${fa(balances.totalExited + input.pallets)} پالت) نمی‌تواند از کل محموله (${fa(balances.totalPallets)} پالت) بیشتر شود.`,
    };
  }

  if (input.stage === 'first_90') {
    if (balances.firstStagePallets === 0) {
      return {
        valid: false,
        error: 'با توجه به فرمول ۹۰/۱۰ برای این محموله، سهمیه مرحله اول (۹۰٪) صفر پالت است و کل بار در سهمیه ۱۰٪ باقی‌مانده قرار دارد.',
      };
    }

    const firstStatus = doc.clearance?.firstStage?.status || 'pending';
    if (firstStatus === 'pending' && balances.firstStageAuthorized === 0) {
      return {
        valid: false,
        error: 'ابتدا ترخیص گمرکی مرحله ۹۰٪ اول را تایید یا تعداد پالت مجاز آن را مشخص کنید.',
      };
    }

    if (input.pallets > balances.firstStageRemaining) {
      return {
        valid: false,
        error: `تعداد درخواستی (${fa(input.pallets)} پالت) از سهمیه باقی‌مانده مرحله ۹۰٪ اول (${fa(balances.firstStageRemaining)} پالت) بیشتر است.`,
      };
    }
  } else {
    // remaining_10
    if (balances.remainingPallets <= 0) {
      return {
        valid: false,
        error: 'سهمیه ۱۰٪ باقی‌مانده برای این محموله صفر است.',
      };
    }

    if (!balances.sataConfirmed) {
      return {
        valid: false,
        error: balances.sataReceived
          ? 'کد ساتا ثبت شده اما هنوز توسط کاربر مجاز تایید نهایی نشده است؛ سهمیه ۱۰٪ تا تایید ساتا قفل است.'
          : 'تا پیش از دریافت و تایید نهایی کد ساتا توسط کاربر مجاز، امکان خروج سهمیه ۱۰٪ وجود ندارد.',
      };
    }

    if (input.pallets > balances.remainingStageAvailable) {
      return {
        valid: false,
        error: `تعداد درخواستی (${fa(input.pallets)} پالت) از موجودی باقی‌مانده ۱۰٪ (${fa(balances.remainingStageAvailable)} پالت) بیشتر است.`,
      };
    }
  }

  // Duplicate transaction check
  const fp = buildPhysicalExitFingerprint({
    entryDocId: input.entryDocId,
    stage: input.stage,
    exitDate: input.exitDate,
    truckInfo: cleanTruck,
    pallets: input.pallets,
  });

  const isDuplicate = otherTx.some(
    (t) =>
      t.entryDocId === input.entryDocId &&
      (t.fingerprint === fp ||
        buildPhysicalExitFingerprint({
          entryDocId: t.entryDocId,
          stage: t.stage,
          exitDate: t.exitDate,
          truckInfo: t.truckInfo,
          pallets: t.pallets,
        }) === fp)
  );

  if (isDuplicate) {
    return {
      valid: false,
      error: 'رکورد تکراری: تراکنش خروج مشابهی با همین تاریخ، مرحله، تریلی و تعداد پالت قبلاً ثبت شده است.',
    };
  }

  return { valid: true };
}

export interface CaseClosureValidationResult {
  canClose: boolean;
  reasons: string[];
}

export function validateCaseClosure(
  doc: EntryDoc,
  physicalExits: PhysicalExitTransaction[],
  linkedExits: ExitDoc[] = []
): CaseClosureValidationResult {
  const reasons: string[] = [];
  const clearance = normalizeEntryClearance(doc, physicalExits);
  const balances = computePalletBalances({ ...doc, clearance }, physicalExits);

  if (clearance.closure.closed) {
    reasons.push('این پرونده قبلاً مختومه شده است.');
  }

  if (balances.totalPallets <= 0) {
    reasons.push('تعداد کل پالت‌های محموله مشخص نیست (باید بیشتر از صفر باشد).');
  } else if (balances.totalExited !== balances.totalPallets || balances.totalRemaining > 0) {
    reasons.push(
      `هنوز ${fa(balances.totalRemaining)} پالت از مجموع ${fa(balances.totalPallets)} پالت به‌صورت فیزیکی خارج نشده است.`
    );
  }

  if (balances.firstStagePallets > 0 && clearance.firstStage.status !== 'completed') {
    reasons.push('وضعیت ترخیص گمرکی مرحله ۹۰٪ اول هنوز تکمیل نشده است.');
  }

  if (balances.remainingPallets > 0) {
    if (!clearance.sata.confirmed) {
      reasons.push('کد ساتا برای سهمیه ۱۰٪ باقی‌مانده هنوز تایید نهایی نشده است.');
    }
    if (clearance.remainingStage.status !== 'completed') {
      reasons.push('ترخیص گمرکی ۱۰٪ باقی‌مانده هنوز در وضعیت تکمیل‌شده ثبت نشده است.');
    }
  }

  const incompleteLinkedExit = linkedExits.find((ex) => !ex.gate?.done || !ex.invoice?.paid);
  if (incompleteLinkedExit) {
    reasons.push(
      `سند خروج متصل (کوتاژ ${fa(incompleteLinkedExit.cottage)}) هنوز در مرحله درب خروج یا پرداخت صورت‌حساب گمرکی تکمیل نشده است.`
    );
  }

  return {
    canClose: reasons.length === 0,
    reasons,
  };
}

export function getDaysElapsedSinceJalali(date: JalaliDate | null | undefined): number {
  if (!date || !date.jy || !date.jm || !date.jd) return 0;
  const t = todayJ();
  return j2d(t.jy, t.jm, t.jd) - j2d(date.jy, date.jm, date.jd);
}

export function formatJalaliInputDate(date: JalaliDate | null | undefined): JalaliDate {
  if (date && date.jy && date.jm && date.jd) return date;
  return todayJ();
}
