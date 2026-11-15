import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Batch,
  DailyTask,
  EntryDoc,
  ExitDoc,
  LabRecord,
  NotificationStateRecord,
  PhysicalExitTransaction,
} from '../types';
import { normalizeAllDataPayload } from '../utils/storage';

export interface AllAppData {
  docs: EntryDoc[];
  batches: Batch[];
  exits: ExitDoc[];
  labRecords: LabRecord[];
  physicalExits?: PhysicalExitTransaction[];
  dailyTasks?: DailyTask[];
  notificationStates?: NotificationStateRecord[];
  importers: string[];
  carriers: string[];
  goodsList: string[];
  brands: string[];
}

export function formatSupabaseError(err: any): Error {
  if (!err) return new Error('خطای نامشخص در دیتابیس');
  if (typeof err === 'string') {
    if (err.includes('Load failed') || err.includes('Failed to fetch') || err.includes('fetch')) {
      const error = new Error('عدم امکان برقراری ارتباط با سرور ابری Supabase (بررسی وضعیت اینترنت یا آدرس پروژه)');
      (error as any).code = 'NETWORK_ERROR';
      (error as any).isNetworkError = true;
      return error;
    }
    return new Error(err);
  }

  const code = err.code || '';
  const message = (err.message || err.details || err.error_description || '').toString();
  const name = (err.name || '').toString();

  const isNetworkFailure =
    name === 'TypeError' ||
    message.includes('Load failed') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('ERR_CONNECTION') ||
    message.includes('ERR_NAME_NOT_RESOLVED') ||
    message.includes('aborted') ||
    message.includes('fetch');

  if (isNetworkFailure) {
    const error = new Error('عدم امکان برقراری ارتباط با سرور ابری Supabase (بررسی وضعیت اینترنت یا آدرس پروژه)');
    (error as any).code = 'NETWORK_ERROR';
    (error as any).isNetworkError = true;
    return error;
  }

  if (
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('Could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  ) {
    const error = new Error('جداول دیتابیس در پروژه‌ی Supabase ساخته نشده‌اند. لطفاً کد SQL را در Supabase SQL Editor اجرا کنید.');
    (error as any).code = 'PGRST205';
    (error as any).isTableMissing = true;
    return error;
  }

  if (code === 'PGRST204' || code === '42703' || (message.includes('column') && message.includes('does not exist'))) {
    const error = new Error('ستون‌های جدید ۹۰/۱۰ هنوز در Supabase ایجاد نشده‌اند. اسکریپت SQL بروزرسانی را اجرا کنید.');
    (error as any).code = code || 'PGRST204';
    (error as any).isColumnMissing = true;
    return error;
  }

  if (code === 'PGRST301' || code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
    const error = new Error('خطای دسترسی دیتابیس (RLS). لطفاً سیاست‌های دسترسی را در Supabase چک کنید.');
    (error as any).code = code;
    return error;
  }

  const friendlyMsg = err.message || err.details || 'خطای برقراری ارتباط با دیتابیس ابری Supabase';
  const error = new Error(friendlyMsg);
  (error as any).code = code;
  return error;
}

// Map Database Row -> EntryDoc
export function mapEntryDocFromDb(row: any): EntryDoc {
  return {
    id: row.id,
    cottage: row.cottage || '',
    bl: row.bl || '',
    file: row.file || '',
    importer: row.importer || '',
    carrier: row.carrier || '',
    goods: row.goods || '',
    brand: row.brand || '',
    mdfThickness: row.mdf_thickness || '',
    unloadDate: row.unload_date || { jy: 1402, jm: 1, jd: 1 },
    trailers: Number(row.trailers || 0),
    unloaded: Number(row.unloaded || 0),
    pallets: Number(row.pallets || 0),
    invoicePaid: Boolean(row.invoice_paid),
    receipt: row.receipt || { number: '', count: '' },
    tasks: row.tasks || { bl: false, arr: false, tali: false },
    clearance: row.clearance && Object.keys(row.clearance).length > 0 ? row.clearance : undefined,
    createdAt: Number(row.created_at || Date.now()),
  };
}

// Map EntryDoc -> Database Row
export function mapEntryDocToDb(doc: EntryDoc, legacyOnly = false) {
  const base: any = {
    id: doc.id,
    cottage: doc.cottage,
    bl: doc.bl,
    file: doc.file,
    importer: doc.importer,
    carrier: doc.carrier,
    goods: doc.goods,
    brand: doc.brand,
    unload_date: doc.unloadDate,
    trailers: doc.trailers,
    unloaded: doc.unloaded,
    pallets: doc.pallets,
    invoice_paid: doc.invoicePaid,
    receipt: doc.receipt,
    tasks: doc.tasks,
    created_at: doc.createdAt,
    updated_at: new Date().toISOString(),
  };

  if (!legacyOnly) {
    base.mdf_thickness = doc.mdfThickness || '';
    base.clearance = doc.clearance || {};
  }

  return base;
}

// Map Database Row -> Batch
export function mapBatchFromDb(row: any): Batch {
  return {
    id: row.id,
    goods: row.goods || '',
    file: row.file || '',
    createdAt: row.created_at || { jy: 1402, jm: 1, jd: 1 },
    docIds: Array.isArray(row.doc_ids) ? row.doc_ids : [],
    finalized: Boolean(row.finalized),
    exited: Boolean(row.exited),
  };
}

// Map Batch -> Database Row
export function mapBatchToDb(batch: Batch) {
  return {
    id: batch.id,
    goods: batch.goods,
    file: batch.file,
    created_at: batch.createdAt,
    doc_ids: batch.docIds,
    finalized: batch.finalized,
    exited: Boolean(batch.exited),
    updated_at: new Date().toISOString(),
  };
}

// Map Database Row -> LabRecord
export function mapLabRecordFromDb(row: any): LabRecord {
  return {
    id: row.id,
    goods: row.goods || '',
    brand: row.brand || '',
    sampleDate: row.sample_date || { jy: 1402, jm: 1, jd: 1 },
    validity: Number(row.validity || 6),
    comment: row.comment || '',
    exitId: row.exit_id || undefined,
    createdAt: Number(row.created_at || Date.now()),
  };
}

// Map LabRecord -> Database Row
export function mapLabRecordToDb(lab: LabRecord) {
  return {
    id: lab.id,
    goods: lab.goods,
    brand: lab.brand,
    sample_date: lab.sampleDate,
    validity: lab.validity,
    comment: lab.comment,
    exit_id: lab.exitId || null,
    created_at: lab.createdAt,
    updated_at: new Date().toISOString(),
  };
}

// Map Database Row -> ExitDoc
export function mapExitDocFromDb(row: any): ExitDoc {
  return {
    id: row.id,
    cottage: row.cottage || '',
    bl: row.bl || '',
    file: row.file || '',
    unloadDate: row.unload_date || { jy: 1402, jm: 1, jd: 1 },
    importer: row.importer || '',
    carrier: row.carrier || '',
    goods: row.goods || '',
    brand: row.brand || '',
    trailers: Number(row.trailers || 0),
    pallets: Number(row.pallets || 0),
    batchId: row.batch_id || '',
    entryDocId: row.entry_doc_id || undefined,
    route: row.route || 'yellow',
    partialExit: row.partial_exit || undefined,
    evaluator: row.evaluator || { done: false, comment: '' },
    jihad: row.jihad || { done: false, comment: '' },
    lab: row.lab || {
      needed: false,
      sampled: false,
      sampleDate: null,
      sent: false,
      tested: false,
      comment: '',
      reusedFrom: null,
      recordId: null,
      validity: 6,
    },
    expert: row.expert || { done: false },
    gate: row.gate || { done: false },
    invoice: row.invoice || { paid: false },
    createdAt: Number(row.created_at || Date.now()),
  };
}

// Map ExitDoc -> Database Row
export function mapExitDocToDb(exit: ExitDoc, legacyOnly = false) {
  const base: any = {
    id: exit.id,
    cottage: exit.cottage,
    bl: exit.bl,
    file: exit.file,
    unload_date: exit.unloadDate,
    importer: exit.importer,
    carrier: exit.carrier,
    goods: exit.goods,
    brand: exit.brand,
    trailers: exit.trailers,
    pallets: exit.pallets,
    batch_id: exit.batchId,
    route: exit.route,
    evaluator: exit.evaluator,
    jihad: exit.jihad,
    lab: exit.lab,
    expert: exit.expert,
    gate: exit.gate,
    invoice: exit.invoice,
    created_at: exit.createdAt,
    updated_at: new Date().toISOString(),
  };

  if (!legacyOnly) {
    base.partial_exit = exit.partialExit || null;
    base.entry_doc_id = exit.entryDocId || '';
  }

  return base;
}

// Map Database Row -> PhysicalExitTransaction
export function mapPhysicalExitFromDb(row: any): PhysicalExitTransaction {
  return {
    id: row.id,
    entryDocId: row.entry_doc_id || '',
    exitDocId: row.exit_doc_id || undefined,
    cottage: row.cottage || '',
    stage: row.stage === 'remaining_10' ? 'remaining_10' : 'first_90',
    exitDate: row.exit_date || { jy: 1403, jm: 1, jd: 1 },
    truckInfo: row.truck_info || '',
    pallets: Math.max(0, Math.floor(Number(row.pallets || 0))),
    driverInfo: row.driver_info || '',
    documents: Array.isArray(row.documents) ? row.documents : [],
    notes: row.notes || '',
    responsibleUser: row.responsible_user || '',
    fingerprint: row.fingerprint || '',
    createdAt: Number(row.created_at || Date.now()),
  };
}

// Map PhysicalExitTransaction -> Database Row
export function mapPhysicalExitToDb(tx: PhysicalExitTransaction) {
  return {
    id: tx.id,
    entry_doc_id: tx.entryDocId,
    exit_doc_id: tx.exitDocId || '',
    cottage: tx.cottage,
    stage: tx.stage,
    exit_date: tx.exitDate,
    truck_info: tx.truckInfo,
    pallets: Math.max(1, Math.floor(tx.pallets)),
    driver_info: tx.driverInfo || '',
    documents: tx.documents || [],
    notes: tx.notes || '',
    responsible_user: tx.responsibleUser || '',
    fingerprint: tx.fingerprint || '',
    created_at: tx.createdAt,
    updated_at: new Date().toISOString(),
  };
}

// Map Database Row -> DailyTask
export function mapDailyTaskFromDb(row: any): DailyTask {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    cottage: row.cottage || undefined,
    relatedRecordType: row.related_record_type || undefined,
    relatedRecordId: row.related_record_id || undefined,
    assignedTo: row.assigned_to || 'نظری',
    priority: row.priority || 'medium',
    dueDate: row.due_date || { jy: 1403, jm: 1, jd: 1 },
    createdAtDate: row.created_at_date || row.due_date || { jy: 1403, jm: 1, jd: 1 },
    createdAt: Number(row.created_at || Date.now()),
    status: row.status || 'pending',
    notes: row.notes || '',
    completionDate: row.completion_date || null,
    completedAt: row.completed_at ? Number(row.completed_at) : undefined,
    createdBy: row.created_by || 'مدیر',
    isAuto: Boolean(row.is_auto),
    autoSourceKey: row.auto_source_key || undefined,
  };
}

// Map DailyTask -> Database Row
export function mapDailyTaskToDb(task: DailyTask) {
  return {
    id: task.id,
    title: task.title,
    description: task.description || '',
    cottage: task.cottage || '',
    related_record_type: task.relatedRecordType || '',
    related_record_id: task.relatedRecordId || '',
    assigned_to: task.assignedTo || '',
    priority: task.priority || 'medium',
    due_date: task.dueDate,
    created_at_date: task.createdAtDate,
    created_at: task.createdAt,
    status: task.status || 'pending',
    notes: task.notes || '',
    completion_date: task.completionDate || null,
    completed_at: task.completedAt || null,
    created_by: task.createdBy || '',
    is_auto: Boolean(task.isAuto),
    auto_source_key: task.autoSourceKey || null,
    updated_at: new Date().toISOString(),
  };
}

// Map NotificationStateRecord
export function mapNotificationStateFromDb(row: any): NotificationStateRecord {
  return {
    dedupeKey: row.dedupe_key,
    read: Boolean(row.read),
    archived: Boolean(row.archived),
    readAt: row.read_at ? Number(row.read_at) : undefined,
    archivedAt: row.archived_at ? Number(row.archived_at) : undefined,
  };
}

export function mapNotificationStateToDb(rec: NotificationStateRecord) {
  return {
    dedupe_key: rec.dedupeKey,
    read: Boolean(rec.read),
    archived: Boolean(rec.archived),
    read_at: rec.readAt || null,
    archived_at: rec.archivedAt || null,
    updated_at: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------
// API / DATABASE SERVICE METHODS
// ----------------------------------------------------------------------

export async function fetchAllDataFromCloud(): Promise<AllAppData | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const [
      { data: docsData, error: docsErr },
      { data: batchesData, error: batchesErr },
      { data: exitsData, error: exitsErr },
      { data: labData, error: labErr },
      { data: lookupData },
    ] = await Promise.all([
      supabase.from('entry_docs').select('*').order('created_at', { ascending: false }),
      supabase.from('batches').select('*'),
      supabase.from('exit_docs').select('*').order('created_at', { ascending: false }),
      supabase.from('lab_records').select('*').order('created_at', { ascending: false }),
      supabase.from('lookup_options').select('*').eq('id', 'global_options').maybeSingle(),
    ]);

    if (docsErr) throw formatSupabaseError(docsErr);
    if (batchesErr) throw formatSupabaseError(batchesErr);
    if (exitsErr) throw formatSupabaseError(exitsErr);
    if (labErr) throw formatSupabaseError(labErr);

    // Fetch v4 extension tables gracefully so legacy DB projects still load
    let physicalExits: PhysicalExitTransaction[] = [];
    let dailyTasks: DailyTask[] = [];
    let notificationStates: NotificationStateRecord[] = [];

    const [physRes, tasksRes, notifRes] = await Promise.all([
      supabase.from('physical_exits').select('*').order('created_at', { ascending: false }),
      supabase.from('daily_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('notification_states').select('*'),
    ]);

    if (!physRes.error && Array.isArray(physRes.data)) {
      physicalExits = physRes.data.map(mapPhysicalExitFromDb);
    }
    if (!tasksRes.error && Array.isArray(tasksRes.data)) {
      dailyTasks = tasksRes.data.map(mapDailyTaskFromDb);
    }
    if (!notifRes.error && Array.isArray(notifRes.data)) {
      notificationStates = notifRes.data.map(mapNotificationStateFromDb);
    }

    const docs = (docsData || []).map(mapEntryDocFromDb);
    const batches = (batchesData || []).map(mapBatchFromDb);
    const exits = (exitsData || []).map(mapExitDocFromDb);
    const labRecords = (labData || []).map(mapLabRecordFromDb);

    const importers = Array.isArray(lookupData?.importers) ? lookupData.importers : [];
    const carriers = Array.isArray(lookupData?.carriers) ? lookupData.carriers : [];
    const goodsList = Array.isArray(lookupData?.goods_list) ? lookupData.goods_list : [];
    const brands = Array.isArray(lookupData?.brands) ? lookupData.brands : [];

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
  } catch (err) {
    const formatted = formatSupabaseError(err);
    if ((formatted as any).isTableMissing) {
      console.warn('Supabase DB notice (tables missing):', formatted.message);
    } else if ((formatted as any).isNetworkError) {
      console.warn('Supabase DB notice (offline/unreachable):', formatted.message);
    } else {
      console.warn('Supabase DB notice:', formatted.message);
    }
    throw formatted;
  }
}

// Save or Update EntryDoc (falls back safely if new columns aren't migrated yet)
export async function saveEntryDocCloud(doc: EntryDoc): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = mapEntryDocToDb(doc, false);
    const { error } = await supabase.from('entry_docs').upsert(row);
    if (error) {
      const formatted = formatSupabaseError(error);
      if ((formatted as any).isColumnMissing) {
        const legacyRow = mapEntryDocToDb(doc, true);
        const retry = await supabase.from('entry_docs').upsert(legacyRow);
        if (retry.error) throw formatSupabaseError(retry.error);
        console.warn('EntryDoc saved with legacy columns. Run latest SQL migration for mdf_thickness/clearance.');
        return;
      }
      throw formatted;
    }
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Delete EntryDoc
export async function deleteEntryDocCloud(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('entry_docs').delete().eq('id', id);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Save or Update Batch
export async function saveBatchCloud(batch: Batch): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = mapBatchToDb(batch);
    const { error } = await supabase.from('batches').upsert(row);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Delete Batch
export async function deleteBatchCloud(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('batches').delete().eq('id', id);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Save or Update ExitDoc (falls back safely if new columns aren't migrated yet)
export async function saveExitDocCloud(exit: ExitDoc): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = mapExitDocToDb(exit, false);
    const { error } = await supabase.from('exit_docs').upsert(row);
    if (error) {
      const formatted = formatSupabaseError(error);
      if ((formatted as any).isColumnMissing) {
        const legacyRow = mapExitDocToDb(exit, true);
        const retry = await supabase.from('exit_docs').upsert(legacyRow);
        if (retry.error) throw formatSupabaseError(retry.error);
        console.warn('ExitDoc saved with legacy columns. Run latest SQL migration for partial_exit/entry_doc_id.');
        return;
      }
      throw formatted;
    }
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Delete ExitDoc
export async function deleteExitDocCloud(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('exit_docs').delete().eq('id', id);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Save or Update LabRecord
export async function saveLabRecordCloud(lab: LabRecord): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = mapLabRecordToDb(lab);
    const { error } = await supabase.from('lab_records').upsert(row);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Delete LabRecord
export async function deleteLabRecordCloud(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('lab_records').delete().eq('id', id);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Save or Update Physical Exit Transaction
export async function savePhysicalExitCloud(tx: PhysicalExitTransaction): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = mapPhysicalExitToDb(tx);
    const { error } = await supabase.from('physical_exits').upsert(row);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

export async function deletePhysicalExitCloud(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('physical_exits').delete().eq('id', id);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Save or Update Daily Task
export async function saveDailyTaskCloud(task: DailyTask): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = mapDailyTaskToDb(task);
    const { error } = await supabase.from('daily_tasks').upsert(row);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

export async function deleteDailyTaskCloud(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('daily_tasks').delete().eq('id', id);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Save Notification States
export async function saveNotificationStatesCloud(states: NotificationStateRecord[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !states.length) return;
  try {
    const rows = states.map(mapNotificationStateToDb);
    const { error } = await supabase.from('notification_states').upsert(rows);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Save Lookup Options
export async function saveLookupOptionsCloud(options: {
  importers?: string[];
  carriers?: string[];
  goodsList?: string[];
  brands?: string[];
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const payload: any = {
      id: 'global_options',
      updated_at: new Date().toISOString(),
    };

    if (options.importers !== undefined) payload.importers = options.importers;
    if (options.carriers !== undefined) payload.carriers = options.carriers;
    if (options.goodsList !== undefined) payload.goods_list = options.goodsList;
    if (options.brands !== undefined) payload.brands = options.brands;

    const { error } = await supabase.from('lookup_options').upsert(payload);
    if (error) throw formatSupabaseError(error);
  } catch (err) {
    throw formatSupabaseError(err);
  }
}

// Bulk Sync All Local Data to Cloud Database (Migration)
export async function migrateLocalDataToCloud(localData: AllAppData): Promise<{
  docsSynced: number;
  batchesSynced: number;
  exitsSynced: number;
  labSynced: number;
  physicalExitsSynced: number;
  tasksSynced: number;
}> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('اتصال دیتابیس ابری برقرار نیست');

  let docsSynced = 0;
  let batchesSynced = 0;
  let exitsSynced = 0;
  let labSynced = 0;
  let physicalExitsSynced = 0;
  let tasksSynced = 0;

  try {
    if (localData.docs && localData.docs.length > 0) {
      const rows = localData.docs.map((d) => mapEntryDocToDb(d, false));
      const { error } = await supabase.from('entry_docs').upsert(rows);
      if (error) {
        const formatted = formatSupabaseError(error);
        if ((formatted as any).isColumnMissing) {
          const legacyRows = localData.docs.map((d) => mapEntryDocToDb(d, true));
          const retry = await supabase.from('entry_docs').upsert(legacyRows);
          if (retry.error) throw formatSupabaseError(retry.error);
        } else {
          throw formatted;
        }
      }
      docsSynced = rows.length;
    }

    if (localData.batches && localData.batches.length > 0) {
      const rows = localData.batches.map(mapBatchToDb);
      const { error } = await supabase.from('batches').upsert(rows);
      if (error) throw formatSupabaseError(error);
      batchesSynced = rows.length;
    }

    if (localData.exits && localData.exits.length > 0) {
      const rows = localData.exits.map((x) => mapExitDocToDb(x, false));
      const { error } = await supabase.from('exit_docs').upsert(rows);
      if (error) {
        const formatted = formatSupabaseError(error);
        if ((formatted as any).isColumnMissing) {
          const legacyRows = localData.exits.map((x) => mapExitDocToDb(x, true));
          const retry = await supabase.from('exit_docs').upsert(legacyRows);
          if (retry.error) throw formatSupabaseError(retry.error);
        } else {
          throw formatted;
        }
      }
      exitsSynced = rows.length;
    }

    if (localData.labRecords && localData.labRecords.length > 0) {
      const rows = localData.labRecords.map(mapLabRecordToDb);
      const { error } = await supabase.from('lab_records').upsert(rows);
      if (error) throw formatSupabaseError(error);
      labSynced = rows.length;
    }

    if (localData.physicalExits && localData.physicalExits.length > 0) {
      const rows = localData.physicalExits.map(mapPhysicalExitToDb);
      const { error } = await supabase.from('physical_exits').upsert(rows);
      if (!error) physicalExitsSynced = rows.length;
      else if (!formatSupabaseError(error).message.includes('ساخته نشده')) {
        console.warn('physical_exits sync warning:', error.message);
      }
    }

    if (localData.dailyTasks && localData.dailyTasks.length > 0) {
      const rows = localData.dailyTasks.map(mapDailyTaskToDb);
      const { error } = await supabase.from('daily_tasks').upsert(rows);
      if (!error) tasksSynced = rows.length;
      else console.warn('daily_tasks sync warning:', error.message);
    }

    if (localData.notificationStates && localData.notificationStates.length > 0) {
      const rows = localData.notificationStates.map(mapNotificationStateToDb);
      const { error } = await supabase.from('notification_states').upsert(rows);
      if (error) console.warn('notification_states sync warning:', error.message);
    }

    await saveLookupOptionsCloud({
      importers: localData.importers,
      carriers: localData.carriers,
      goodsList: localData.goodsList,
      brands: localData.brands,
    });

    return {
      docsSynced,
      batchesSynced,
      exitsSynced,
      labSynced,
      physicalExitsSynced,
      tasksSynced,
    };
  } catch (err) {
    throw formatSupabaseError(err);
  }
}
