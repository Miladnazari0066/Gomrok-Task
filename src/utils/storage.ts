import {
  Batch,
  DailyTask,
  EntryDoc,
  ExitDoc,
  LabRecord,
  NotificationStateRecord,
  PhysicalExitTransaction,
} from '../types';
import {
  inferMdfThickness,
  normalizeEntryClearance,
  buildPhysicalExitFingerprint,
} from './clearance9010';

function getScopedKeys(companyId?: string) {
  const prefix = companyId ? `gm_t_${companyId}_` : 'gm_';
  return {
    DOCS: `${prefix}docs`,
    BATCHES: `${prefix}batches`,
    CARRIERS: `${prefix}carriers`,
    IMPORTERS: `${prefix}importers`,
    GOODS: `${prefix}goods`,
    BRANDS: `${prefix}brands`,
    EXITS: `${prefix}exits`,
    LABRECS: `${prefix}labrecs`,
    PHYSICAL_EXITS: `${prefix}physical_exits`,
    DAILY_TASKS: `${prefix}daily_tasks`,
    NOTIFICATION_STATES: `${prefix}notification_states`,
    LETTERS: `${prefix}customs_letters`,
  };
}

export const DEFAULT_IMPORTERS: string[] = [];
export const DEFAULT_CARRIERS: string[] = [];
export const DEFAULT_GOODS: string[] = [];
export const DEFAULT_BRANDS: string[] = [];

export function getItem<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

export function normalizeLegacyEntryDoc(
  doc: EntryDoc,
  physicalExits: PhysicalExitTransaction[] = []
): EntryDoc {
  const mdfThickness =
    doc.mdfThickness !== undefined ? doc.mdfThickness : inferMdfThickness(doc.goods || '');
  const clearance = normalizeEntryClearance(doc, physicalExits);
  return {
    ...doc,
    mdfThickness,
    pallets: Math.max(0, Math.floor(Number(doc.pallets) || 0)),
    trailers: Math.max(0, Math.floor(Number(doc.trailers) || 0)),
    unloaded: Math.max(0, Math.floor(Number(doc.unloaded) || 0)),
    clearance,
  };
}

export function normalizeLegacyPhysicalExit(tx: PhysicalExitTransaction): PhysicalExitTransaction {
  const pallets = Math.max(0, Math.floor(Number(tx.pallets) || 0));
  const fingerprint =
    tx.fingerprint ||
    buildPhysicalExitFingerprint({
      entryDocId: tx.entryDocId,
      stage: tx.stage,
      exitDate: tx.exitDate,
      truckInfo: tx.truckInfo,
      pallets,
    });

  return {
    ...tx,
    pallets,
    documents: Array.isArray(tx.documents) ? tx.documents : [],
    notes: tx.notes || '',
    driverInfo: tx.driverInfo || '',
    responsibleUser: tx.responsibleUser || 'مدیر',
    fingerprint,
  };
}

export function normalizeAllDataPayload(payload: {
  docs?: EntryDoc[];
  batches?: Batch[];
  exits?: ExitDoc[];
  labRecords?: LabRecord[];
  physicalExits?: PhysicalExitTransaction[];
  dailyTasks?: DailyTask[];
  notificationStates?: NotificationStateRecord[];
  importers?: string[];
  carriers?: string[];
  goodsList?: string[];
  brands?: string[];
}) {
  const physicalExits = Array.isArray(payload.physicalExits)
    ? payload.physicalExits.map(normalizeLegacyPhysicalExit)
    : [];
  const docs = Array.isArray(payload.docs)
    ? payload.docs.map((d) => normalizeLegacyEntryDoc(d, physicalExits))
    : [];
  const batches = Array.isArray(payload.batches) ? payload.batches : [];
  const exits = Array.isArray(payload.exits) ? payload.exits : [];
  const labRecords = Array.isArray(payload.labRecords) ? payload.labRecords : [];
  const dailyTasks = Array.isArray(payload.dailyTasks) ? payload.dailyTasks : [];
  const notificationStates = Array.isArray(payload.notificationStates)
    ? payload.notificationStates
    : [];

  return {
    docs,
    batches,
    exits,
    labRecords,
    physicalExits,
    dailyTasks,
    notificationStates,
    importers: Array.isArray(payload.importers) ? payload.importers : [],
    carriers: Array.isArray(payload.carriers) ? payload.carriers : [],
    goodsList: Array.isArray(payload.goodsList) ? payload.goodsList : [],
    brands: Array.isArray(payload.brands) ? payload.brands : [],
  };
}

export function loadEmptyData() {
  return normalizeAllDataPayload({
    docs: [],
    batches: [],
    exits: [],
    labRecords: [],
    physicalExits: [],
    dailyTasks: [],
    notificationStates: [],
    importers: [],
    carriers: [],
    goodsList: [],
    brands: [],
  });
}

export function loadAllData(companyId?: string) {
  if (!companyId) {
    return loadEmptyData();
  }
  const keys = getScopedKeys(companyId);

  const importers = getItem<string[]>(keys.IMPORTERS, DEFAULT_IMPORTERS);
  const carriers = getItem<string[]>(keys.CARRIERS, DEFAULT_CARRIERS);
  const goodsList = getItem<string[]>(keys.GOODS, DEFAULT_GOODS);
  const brands = getItem<string[]>(keys.BRANDS, DEFAULT_BRANDS);
  const docs = getItem<EntryDoc[]>(keys.DOCS, []);
  const batches = getItem<Batch[]>(keys.BATCHES, []);
  const exits = getItem<ExitDoc[]>(keys.EXITS, []);
  const labRecords = getItem<LabRecord[]>(keys.LABRECS, []);
  const physicalExits = getItem<PhysicalExitTransaction[]>(keys.PHYSICAL_EXITS, []);
  const dailyTasks = getItem<DailyTask[]>(keys.DAILY_TASKS, []);
  const notificationStates = getItem<NotificationStateRecord[]>(keys.NOTIFICATION_STATES, []);

  return normalizeAllDataPayload({
    docs,
    batches,
    exits,
    labRecords,
    physicalExits,
    dailyTasks,
    notificationStates,
    importers,
    carriers,
    goodsList,
    brands,
  });
}

export function saveAllData(
  data: {
    docs?: EntryDoc[];
    batches?: Batch[];
    exits?: ExitDoc[];
    labRecords?: LabRecord[];
    physicalExits?: PhysicalExitTransaction[];
    dailyTasks?: DailyTask[];
    notificationStates?: NotificationStateRecord[];
    importers?: string[];
    carriers?: string[];
    goodsList?: string[];
    brands?: string[];
  },
  companyId?: string
) {
  if (!companyId) return;
  const keys = getScopedKeys(companyId);
  if (data.docs !== undefined) setItem(keys.DOCS, data.docs);
  if (data.batches !== undefined) setItem(keys.BATCHES, data.batches);
  if (data.exits !== undefined) setItem(keys.EXITS, data.exits);
  if (data.labRecords !== undefined) setItem(keys.LABRECS, data.labRecords);
  if (data.physicalExits !== undefined) setItem(keys.PHYSICAL_EXITS, data.physicalExits);
  if (data.dailyTasks !== undefined) setItem(keys.DAILY_TASKS, data.dailyTasks);
  if (data.notificationStates !== undefined) setItem(keys.NOTIFICATION_STATES, data.notificationStates);
  if (data.importers !== undefined) setItem(keys.IMPORTERS, data.importers);
  if (data.carriers !== undefined) setItem(keys.CARRIERS, data.carriers);
  if (data.goodsList !== undefined) setItem(keys.GOODS, data.goodsList);
  if (data.brands !== undefined) setItem(keys.BRANDS, data.brands);
}

export function clearCompanyLocalCache(companyId?: string): void {
  if (!companyId) return;
  const keys = getScopedKeys(companyId);
  try {
    for (const k of Object.values(keys)) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

export function clearAllTestData(companyId?: string): void {
  clearCompanyLocalCache(companyId);
}
