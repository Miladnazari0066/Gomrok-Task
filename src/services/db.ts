import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Batch,
  CustomsLetter,
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

export interface TenantQueryScope {
  companyId: string;
  enableImport?: boolean;
  enableExport?: boolean;
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
    const error = new Error('جداول دیتابیس چندشرکتی در Supabase ساخته نشده‌اند. لطفاً اسکریپت SQL مهاجرت را اجرا کنید.');
    (error as any).code = 'PGRST205';
    (error as any).isTableMissing = true;
    return error;
  }

  if (code === 'PGRST204' || code === '42703' || (message.includes('column') && message.includes('does not exist'))) {
    const error = new Error('ستون‌های جدید چندشرکتی هنوز در Supabase ایجاد نشده‌اند. اسکریپت SQL مهاجرت را اجرا کنید.');
    (error as any).code = code || 'PGRST204';
    (error as any).isColumnMissing = true;
    return error;
  }

  if (code === 'PGRST301' || code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
    const error = new Error('دسترسی به این عملیات توسط سیاست‌های امنیتی دیتابیس (RLS) محدود شده است.');
    (error as any).code = code;
    (error as any).isRlsDenied = true;
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

// Map EntryDoc -> Database Row (strictly stamped with verified company_id)
export function mapEntryDocToDb(doc: EntryDoc, companyId: string) {
  return {
    id: doc.id,
    company_id: companyId,
    cottage: doc.cottage,
    bl: doc.bl,
    file: doc.file,
    importer: doc.importer,
    carrier: doc.carrier,
    goods: doc.goods,
    brand: doc.brand,
    mdf_thickness: doc.mdfThickness || '',
    unload_date: doc.unloadDate,
    trailers: doc.trailers,
    unloaded: doc.unloaded,
    pallets: doc.pallets,
    invoice_paid: doc.invoicePaid,
    receipt: doc.receipt,
    tasks: doc.tasks,
    clearance: doc.clearance || {},
    created_at: doc.createdAt,
    updated_at: new Date().toISOString(),
  };
}

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

export function mapBatchToDb(batch: Batch, companyId: string) {
  return {
    id: batch.id,
    company_id: companyId,
    goods: batch.goods,
    file: batch.file,
    created_at: batch.createdAt,
    doc_ids: batch.docIds,
    finalized: batch.finalized,
    exited: Boolean(batch.exited),
    updated_at: new Date().toISOString(),
  };
}

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

export function mapLabRecordToDb(lab: LabRecord, companyId: string) {
  return {
    id: lab.id,
    company_id: companyId,
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

export function mapExitDocToDb(exit: ExitDoc, companyId: string) {
  return {
    id: exit.id,
    company_id: companyId,
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
    entry_doc_id: exit.entryDocId || '',
    route: exit.route,
    partial_exit: exit.partialExit || null,
    evaluator: exit.evaluator,
    jihad: exit.jihad,
    lab: exit.lab,
    expert: exit.expert,
    gate: exit.gate,
    invoice: exit.invoice,
    created_at: exit.createdAt,
    updated_at: new Date().toISOString(),
  };
}

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

export function mapPhysicalExitToDb(tx: PhysicalExitTransaction, companyId: string) {
  return {
    id: tx.id,
    company_id: companyId,
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

export function mapDailyTaskFromDb(row: any): DailyTask {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    cottage: row.cottage || undefined,
    relatedRecordType: row.related_record_type || undefined,
    relatedRecordId: row.related_record_id || undefined,
    assignedTo: row.assigned_to || '',
    priority: row.priority || 'medium',
    dueDate: row.due_date || { jy: 1403, jm: 1, jd: 1 },
    createdAtDate: row.created_at_date || row.due_date || { jy: 1403, jm: 1, jd: 1 },
    createdAt: Number(row.created_at || Date.now()),
    status: row.status || 'pending',
    notes: row.notes || '',
    completionDate: row.completion_date || null,
    completedAt: row.completed_at ? Number(row.completed_at) : undefined,
    createdBy: row.created_by || '',
    isAuto: Boolean(row.is_auto),
    autoSourceKey: row.auto_source_key || undefined,
  };
}

export function mapDailyTaskToDb(task: DailyTask, companyId: string) {
  return {
    id: task.id,
    company_id: companyId,
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

export function mapNotificationStateFromDb(row: any): NotificationStateRecord {
  return {
    dedupeKey: row.dedupe_key,
    read: Boolean(row.read),
    archived: Boolean(row.archived),
    readAt: row.read_at ? Number(row.read_at) : undefined,
    archivedAt: row.archived_at ? Number(row.archived_at) : undefined,
  };
}

export function mapNotificationStateToDb(rec: NotificationStateRecord, companyId: string) {
  return {
    company_id: companyId,
    dedupe_key: rec.dedupeKey,
    read: Boolean(rec.read),
    archived: Boolean(rec.archived),
    read_at: rec.readAt || null,
    archived_at: rec.archivedAt || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapCustomsLetterFromDb(row: any): CustomsLetter {
  return {
    id: row.id,
    title: row.title || '',
    imageUrl: row.image_data || '',
    imageName: row.image_name || undefined,
    sizeKb: Number(row.image_size_kb || 0) || undefined,
    date: row.letter_date || undefined,
    note: row.notes || undefined,
    createdAt: Number(row.created_at || Date.now()),
  };
}

export function mapCustomsLetterToDb(letter: CustomsLetter, companyId: string) {
  return {
    id: letter.id,
    company_id: companyId,
    title: letter.title,
    letter_date: letter.date || { jy: 1403, jm: 1, jd: 1 },
    notes: letter.note || '',
    image_data: letter.imageUrl || '',
    image_name: letter.imageName || '',
    image_size_kb: Math.round(Number(letter.sizeKb || 0)),
    created_at: letter.createdAt || Date.now(),
    updated_at: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------
// TENANT-SCOPED DATABASE SERVICE METHODS (RLS + EXPLICIT company_id)
// ----------------------------------------------------------------------

export async function fetchAllDataFromCloud(scope: TenantQueryScope): Promise<AllAppData | null> {
  if (!isSupabaseConfigured() || !scope.companyId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { companyId, enableImport = true, enableExport = true } = scope;

  try {
    const [
      docsRes,
      batchesRes,
      exitsRes,
      labRes,
      lookupRes,
      physRes,
      tasksRes,
      notifRes,
    ] = await Promise.all([
      enableImport
        ? supabase.from('entry_docs').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      enableImport
        ? supabase.from('batches').select('*').eq('company_id', companyId)
        : Promise.resolve({ data: [], error: null }),
      enableExport
        ? supabase.from('exit_docs').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      enableExport
        ? supabase.from('lab_records').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('lookup_options').select('*').eq('company_id', companyId).maybeSingle(),
      enableExport
        ? supabase.from('physical_exits').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('daily_tasks').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('notification_states').select('*').eq('company_id', companyId),
    ]);

    // Tolerate individual RLS-denied tables gracefully (e.g., Import Operator querying only Import tables)
    const docs = !docsRes.error && Array.isArray(docsRes.data) ? docsRes.data.map(mapEntryDocFromDb) : [];
    const batches = !batchesRes.error && Array.isArray(batchesRes.data) ? batchesRes.data.map(mapBatchFromDb) : [];
    const exits = !exitsRes.error && Array.isArray(exitsRes.data) ? exitsRes.data.map(mapExitDocFromDb) : [];
    const labRecords = !labRes.error && Array.isArray(labRes.data) ? labRes.data.map(mapLabRecordFromDb) : [];
    const physicalExits =
      !physRes.error && Array.isArray(physRes.data) ? physRes.data.map(mapPhysicalExitFromDb) : [];
    const dailyTasks =
      !tasksRes.error && Array.isArray(tasksRes.data) ? tasksRes.data.map(mapDailyTaskFromDb) : [];
    const notificationStates =
      !notifRes.error && Array.isArray(notifRes.data)
        ? notifRes.data.map(mapNotificationStateFromDb)
        : [];

    const lookupData = !lookupRes.error ? lookupRes.data : null;
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
    throw formatSupabaseError(err);
  }
}

export async function saveEntryDocCloud(doc: EntryDoc, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('entry_docs').upsert(mapEntryDocToDb(doc, companyId));
  if (error) throw formatSupabaseError(error);
}

export async function deleteEntryDocCloud(id: string, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('entry_docs').delete().eq('id', id).eq('company_id', companyId);
  if (error) throw formatSupabaseError(error);
}

export async function saveBatchCloud(batch: Batch, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('batches').upsert(mapBatchToDb(batch, companyId));
  if (error) throw formatSupabaseError(error);
}

export async function deleteBatchCloud(id: string, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('batches').delete().eq('id', id).eq('company_id', companyId);
  if (error) throw formatSupabaseError(error);
}

export async function saveExitDocCloud(exit: ExitDoc, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('exit_docs').upsert(mapExitDocToDb(exit, companyId));
  if (error) throw formatSupabaseError(error);
}

export async function deleteExitDocCloud(id: string, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('exit_docs').delete().eq('id', id).eq('company_id', companyId);
  if (error) throw formatSupabaseError(error);
}

export async function saveLabRecordCloud(lab: LabRecord, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('lab_records').upsert(mapLabRecordToDb(lab, companyId));
  if (error) throw formatSupabaseError(error);
}

export async function deleteLabRecordCloud(id: string, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('lab_records').delete().eq('id', id).eq('company_id', companyId);
  if (error) throw formatSupabaseError(error);
}

export async function savePhysicalExitCloud(tx: PhysicalExitTransaction, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('physical_exits').upsert(mapPhysicalExitToDb(tx, companyId));
  if (error) throw formatSupabaseError(error);
}

export async function deletePhysicalExitCloud(id: string, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('physical_exits').delete().eq('id', id).eq('company_id', companyId);
  if (error) throw formatSupabaseError(error);
}

export async function saveDailyTaskCloud(task: DailyTask, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('daily_tasks').upsert(mapDailyTaskToDb(task, companyId));
  if (error) throw formatSupabaseError(error);
}

export async function deleteDailyTaskCloud(id: string, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase.from('daily_tasks').delete().eq('id', id).eq('company_id', companyId);
  if (error) throw formatSupabaseError(error);
}

export async function saveNotificationStatesCloud(
  states: NotificationStateRecord[],
  companyId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId || !states.length) return;
  const rows = states.map((s) => mapNotificationStateToDb(s, companyId));
  const { error } = await supabase
    .from('notification_states')
    .upsert(rows, { onConflict: 'company_id,dedupe_key' });
  if (error) throw formatSupabaseError(error);
}

export async function saveLookupOptionsCloud(
  options: {
    importers?: string[];
    carriers?: string[];
    goodsList?: string[];
    brands?: string[];
  },
  companyId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;

  const payload: any = {
    id: `options_${companyId}`,
    company_id: companyId,
    updated_at: new Date().toISOString(),
  };

  if (options.importers !== undefined) payload.importers = options.importers;
  if (options.carriers !== undefined) payload.carriers = options.carriers;
  if (options.goodsList !== undefined) payload.goods_list = options.goodsList;
  if (options.brands !== undefined) payload.brands = options.brands;

  const { error } = await supabase
    .from('lookup_options')
    .upsert(payload, { onConflict: 'company_id' });
  if (error) throw formatSupabaseError(error);
}

export async function fetchCustomsLettersCloud(companyId: string): Promise<CustomsLetter[]> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return [];
  const { data, error } = await supabase
    .from('customs_letters')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw formatSupabaseError(error);
  return (data || []).map(mapCustomsLetterFromDb);
}

export async function saveCustomsLetterCloud(letter: CustomsLetter, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase
    .from('customs_letters')
    .upsert(mapCustomsLetterToDb(letter, companyId));
  if (error) throw formatSupabaseError(error);
}

export async function deleteCustomsLetterCloud(id: string, companyId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return;
  const { error } = await supabase
    .from('customs_letters')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId);
  if (error) throw formatSupabaseError(error);
}

// Bulk Sync All Local Data to Cloud Database (strictly scoped to verified companyId)
export async function migrateLocalDataToCloud(
  localData: AllAppData,
  scope: TenantQueryScope
): Promise<{
  docsSynced: number;
  batchesSynced: number;
  exitsSynced: number;
  labSynced: number;
  physicalExitsSynced: number;
  tasksSynced: number;
}> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('اتصال دیتابیس ابری برقرار نیست');
  if (!scope.companyId) throw new Error('شناسه شرکت معتبر نیست');

  const { companyId, enableImport = true, enableExport = true } = scope;

  let docsSynced = 0;
  let batchesSynced = 0;
  let exitsSynced = 0;
  let labSynced = 0;
  let physicalExitsSynced = 0;
  let tasksSynced = 0;

  if (enableImport && localData.docs && localData.docs.length > 0) {
    const rows = localData.docs.map((d) => mapEntryDocToDb(d, companyId));
    const { error } = await supabase.from('entry_docs').upsert(rows);
    if (!error) docsSynced = rows.length;
  }

  if (enableImport && localData.batches && localData.batches.length > 0) {
    const rows = localData.batches.map((b) => mapBatchToDb(b, companyId));
    const { error } = await supabase.from('batches').upsert(rows);
    if (!error) batchesSynced = rows.length;
  }

  if (enableExport && localData.exits && localData.exits.length > 0) {
    const rows = localData.exits.map((x) => mapExitDocToDb(x, companyId));
    const { error } = await supabase.from('exit_docs').upsert(rows);
    if (!error) exitsSynced = rows.length;
  }

  if (enableExport && localData.labRecords && localData.labRecords.length > 0) {
    const rows = localData.labRecords.map((l) => mapLabRecordToDb(l, companyId));
    const { error } = await supabase.from('lab_records').upsert(rows);
    if (!error) labSynced = rows.length;
  }

  if (enableExport && localData.physicalExits && localData.physicalExits.length > 0) {
    const rows = localData.physicalExits.map((tx) => mapPhysicalExitToDb(tx, companyId));
    const { error } = await supabase.from('physical_exits').upsert(rows);
    if (!error) physicalExitsSynced = rows.length;
  }

  if (localData.dailyTasks && localData.dailyTasks.length > 0) {
    const rows = localData.dailyTasks.map((t) => mapDailyTaskToDb(t, companyId));
    const { error } = await supabase.from('daily_tasks').upsert(rows);
    if (!error) tasksSynced = rows.length;
  }

  if (localData.notificationStates && localData.notificationStates.length > 0) {
    const rows = localData.notificationStates.map((s) => mapNotificationStateToDb(s, companyId));
    await supabase.from('notification_states').upsert(rows, { onConflict: 'company_id,dedupe_key' });
  }

  try {
    await saveLookupOptionsCloud(
      {
        importers: localData.importers,
        carriers: localData.carriers,
        goodsList: localData.goodsList,
        brands: localData.brands,
      },
      companyId
    );
  } catch {
    // Non-fatal if user lacks lookup write permission (e.g. Report Viewer)
  }

  return {
    docsSynced,
    batchesSynced,
    exitsSynced,
    labSynced,
    physicalExitsSynced,
    tasksSynced,
  };
}
