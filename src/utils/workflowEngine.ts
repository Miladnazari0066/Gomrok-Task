import {
  AppNotification,
  DailyTask,
  EntryDoc,
  ExitDoc,
  JalaliDate,
  LabRecord,
  NotificationPriority,
  NotificationStateRecord,
  PhysicalExitTransaction,
  TaskViewFilter,
} from '../types';
import { addMonthsJ, daysUntil, fa, fmtJ, j2d, todayJ, uid } from './jalali';
import { computePalletBalances, normalizeEntryClearance } from './clearance9010';

export const LAB_EXPIRY_WARNING_DAYS = 30;
export const CLEARANCE_OVERDUE_DAYS = 7;

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function compareJalaliDates(a: JalaliDate, b: JalaliDate): number {
  const da = j2d(a.jy, a.jm, a.jd);
  const db = j2d(b.jy, b.jm, b.jd);
  return da - db;
}

export function matchesTaskView(task: DailyTask, view: TaskViewFilter, refToday: JalaliDate = todayJ()): boolean {
  const isCompleted = task.status === 'completed' || task.status === 'cancelled';
  if (view === 'all') return true;
  if (view === 'completed') return isCompleted;

  if (isCompleted) return false;
  const diff = compareJalaliDates(task.dueDate, refToday);
  if (view === 'today') return diff === 0;
  if (view === 'overdue') return diff < 0;
  if (view === 'upcoming') return diff > 0;
  return true;
}

export interface WorkflowEvaluationInput {
  docs: EntryDoc[];
  exits: ExitDoc[];
  labRecords: LabRecord[];
  physicalExits: PhysicalExitTransaction[];
  tasks: DailyTask[];
  notificationStates: NotificationStateRecord[];
  refToday?: JalaliDate;
  nowMs?: number;
}

export function generateNotifications(input: WorkflowEvaluationInput): AppNotification[] {
  const {
    docs,
    exits,
    labRecords,
    physicalExits,
    tasks,
    notificationStates,
    refToday = todayJ(),
    nowMs = Date.now(),
  } = input;

  const stateMap = new Map<string, NotificationStateRecord>();
  notificationStates.forEach((s) => stateMap.set(s.dedupeKey, s));

  const todayJdn = j2d(refToday.jy, refToday.jm, refToday.jd);
  const results: AppNotification[] = [];

  const pushNotif = (
    item: Omit<AppNotification, 'id' | 'read' | 'archived'>
  ) => {
    const savedState = stateMap.get(item.dedupeKey);
    results.push({
      ...item,
      id: item.dedupeKey,
      read: Boolean(savedState?.read),
      archived: Boolean(savedState?.archived),
    });
  };

  // Evaluate EntryDocs for 90/10, Sata, docs, overdue steps, physical exits
  docs.forEach((doc) => {
    const clearance = normalizeEntryClearance(doc, physicalExits);
    const balances = computePalletBalances({ ...doc, clearance }, physicalExits);

    if (clearance.closure.closed) return;

    const firstCompleted =
      balances.firstStagePallets === 0 || clearance.firstStage.status === 'completed';

    // 1. Remaining 10% awaiting Sata
    if (
      firstCompleted &&
      balances.remainingPallets > 0 &&
      !balances.sataReceived &&
      !balances.sataConfirmed
    ) {
      pushNotif({
        dedupeKey: `notif:remaining_10_awaiting_sata:${doc.id}`,
        category: 'remaining_10_awaiting_sata',
        title: `۱۰٪ باقی‌مانده در انتظار ساتا — کوتاژ ${fa(doc.cottage)}`,
        description: `${fa(balances.remainingPallets)} پالت باقی‌مانده کالا (${doc.goods}${doc.mdfThickness ? ` · ${doc.mdfThickness}` : ''}) تا دریافت و تایید کد ساتا قفل است.`,
        createdAt: clearance.statusUpdatedAt || doc.createdAt,
        jalaliDate: refToday,
        priority: 'high',
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        cottage: doc.cottage,
        actionLabel: 'مدیریت ساتا',
      });
    }

    // 2. Sata received but not confirmed
    if (balances.remainingPallets > 0 && balances.sataReceived && !balances.sataConfirmed) {
      pushNotif({
        dedupeKey: `notif:sata_received_unconfirmed:${doc.id}`,
        category: 'sata_received_unconfirmed',
        title: `کد ساتا دریافت‌شده در انتظار تایید — کوتاژ ${fa(doc.cottage)}`,
        description: `کد ساتا (${clearance.sata.code || 'ثبت‌شده'}) نیاز به تایید نهایی توسط کاربر مجاز دارد تا ${fa(balances.remainingPallets)} پالت ۱۰٪ آزاد شود.`,
        createdAt: clearance.statusUpdatedAt || doc.createdAt,
        jalaliDate: clearance.sata.receivedDate || refToday,
        priority: 'critical',
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        cottage: doc.cottage,
        actionLabel: 'تایید ساتا',
      });
    }

    // 5. Missing or incomplete documents
    const missingItems: string[] = [];
    if (!doc.invoicePaid) missingItems.push('تسویه صورت‌حساب');
    if (!doc.receipt?.number) missingItems.push('شماره قبض انبار');
    if (!doc.tasks?.bl) missingItems.push('بارنامه');
    if (!doc.tasks?.arr) missingItems.push('اعلام وصول');
    if (!doc.tasks?.tali) missingItems.push('تالی');
    if (doc.unloaded < doc.trailers) missingItems.push('تکمیل تخلیه تریلی‌ها');

    if (missingItems.length > 0) {
      pushNotif({
        dedupeKey: `notif:missing_documents:${doc.id}`,
        category: 'missing_documents',
        title: `مدارک یا مراحل ورودی ناقص — کوتاژ ${fa(doc.cottage)}`,
        description: `موارد ناقص: ${missingItems.join('، ')}.`,
        createdAt: doc.createdAt,
        jalaliDate: doc.unloadDate || refToday,
        priority: missingItems.length >= 3 ? 'high' : 'medium',
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        cottage: doc.cottage,
        actionLabel: 'تکمیل مدارک',
      });
    }

    // 6. Overdue clearance steps (> 7 days)
    const unloadJdn = doc.unloadDate ? j2d(doc.unloadDate.jy, doc.unloadDate.jm, doc.unloadDate.jd) : todayJdn;
    const daysSinceUnload = todayJdn - unloadJdn;
    const daysSinceUpdate = Math.floor((nowMs - (clearance.statusUpdatedAt || doc.createdAt)) / 86400000);
    const maxDelay = Math.max(daysSinceUnload, daysSinceUpdate);

    if (maxDelay > CLEARANCE_OVERDUE_DAYS && !balances.isFullyExited) {
      pushNotif({
        dedupeKey: `notif:overdue_clearance:${doc.id}`,
        category: 'overdue_clearance',
        title: `تاخیر در فرآیند ترخیص/خروج (${fa(maxDelay)} روز) — کوتاژ ${fa(doc.cottage)}`,
        description: `بیش از ${fa(CLEARANCE_OVERDUE_DAYS)} روز از ثبت/به‌روزرسانی گذشته و هنوز ${fa(balances.totalRemaining)} پالت باقی مانده است.`,
        createdAt: clearance.statusUpdatedAt || doc.createdAt,
        jalaliDate: doc.unloadDate || refToday,
        priority: maxDelay >= 14 ? 'critical' : 'high',
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        cottage: doc.cottage,
        actionLabel: 'بررسی تاخیر',
      });
    }

    // 9. Shipment cleared but not physically exited
    const isFullyCleared =
      firstCompleted &&
      (balances.remainingPallets === 0 || (balances.sataConfirmed && clearance.remainingStage.status === 'completed'));

    if (
      balances.totalPallets > 0 &&
      balances.totalExited === 0 &&
      (isFullyCleared || (firstCompleted && balances.firstStageAuthorized > 0))
    ) {
      pushNotif({
        dedupeKey: `notif:cleared_not_exited:${doc.id}`,
        category: 'cleared_not_exited',
        title: `محموله ترخیص‌شده بدون خروج فیزیکی — کوتاژ ${fa(doc.cottage)}`,
        description: isFullyCleared
          ? `ترخیص کل ${fa(balances.totalPallets)} پالت کامل است اما هنوز هیچ خروج فیزیکی ثبت نشده است.`
          : `ترخیص مرحله اول (${fa(balances.firstStageAuthorized)} پالت) کامل است اما هنوز تریلی خروجی ثبت نشده است.`,
        createdAt: clearance.statusUpdatedAt || doc.createdAt,
        jalaliDate: clearance.firstStage.clearanceDate || refToday,
        priority: 'high',
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        cottage: doc.cottage,
        actionLabel: 'ثبت خروج فیزیکی',
      });
    }

    // 10. Shipment with remaining pallets requiring follow-up
    if (balances.totalExited > 0 && balances.totalRemaining > 0) {
      pushNotif({
        dedupeKey: `notif:remaining_pallets_followup:${doc.id}`,
        category: 'remaining_pallets_followup',
        title: `نیاز به پیگیری پالت‌های باقی‌مانده — کوتاژ ${fa(doc.cottage)}`,
        description: `${fa(balances.totalExited)} از ${fa(balances.totalPallets)} پالت خارج شده و ${fa(balances.totalRemaining)} پالت باقی‌مانده نیازمند پیگیری خروج است.`,
        createdAt: clearance.statusUpdatedAt || doc.createdAt,
        jalaliDate: refToday,
        priority: balances.sataConfirmed || balances.firstStageRemaining > 0 ? 'medium' : 'low',
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        cottage: doc.cottage,
        actionLabel: 'پیگیری خروج',
      });
    }
  });

  // 3 & 4. Lab validity approaching expiration (<= 30 days) or expired (< 0 days)
  labRecords.forEach((rec) => {
    const expDate = addMonthsJ(rec.sampleDate, rec.validity || 6);
    const remainingDays = daysUntil(expDate);
    if (remainingDays < 0) {
      pushNotif({
        dedupeKey: `notif:lab_expired:${rec.id}`,
        category: 'lab_expired',
        title: `انقضای گواهی آزمایشگاه — ${rec.goods}`,
        description: `اعتبار گواهی آزمایشگاه (${rec.brand || 'بدون برند'}) ${fa(Math.abs(remainingDays))} روز پیش (${fmtJ(expDate)}) منقضی شده است.`,
        createdAt: rec.createdAt,
        jalaliDate: expDate,
        priority: 'critical',
        relatedRecordType: 'lab',
        relatedRecordId: rec.id,
        actionLabel: 'سوابق آزمایشگاه',
      });
    } else if (remainingDays <= LAB_EXPIRY_WARNING_DAYS) {
      pushNotif({
        dedupeKey: `notif:lab_expiring_soon:${rec.id}`,
        category: 'lab_expiring_soon',
        title: `نزدیک شدن انقضای آزمایشگاه — ${rec.goods}`,
        description: `فقط ${fa(remainingDays)} روز تا پایان اعتبار گواهی آزمایشگاه (${fmtJ(expDate)}) باقی مانده است.`,
        createdAt: rec.createdAt,
        jalaliDate: expDate,
        priority: remainingDays <= 7 ? 'high' : 'medium',
        relatedRecordType: 'lab',
        relatedRecordId: rec.id,
        actionLabel: 'سوابق آزمایشگاه',
      });
    }
  });

  // Also check active ExitDocs needing lab with their own sampleDate if not tied to a labRecord already covered
  exits.forEach((ex) => {
    if (ex.lab?.needed && ex.lab.sampleDate && !ex.lab.reusedFrom && !ex.lab.recordId) {
      const expDate = addMonthsJ(ex.lab.sampleDate, ex.lab.validity || 6);
      const remainingDays = daysUntil(expDate);
      if (remainingDays < 0) {
        pushNotif({
          dedupeKey: `notif:lab_expired:exit:${ex.id}`,
          category: 'lab_expired',
          title: `انقضای آزمایشگاه سند خروج — کوتاژ ${fa(ex.cottage)}`,
          description: `اعتبار آزمایشگاه این سند خروج در تاریخ ${fmtJ(expDate)} منقضی شده است.`,
          createdAt: ex.createdAt,
          jalaliDate: expDate,
          priority: 'critical',
          relatedRecordType: 'exit',
          relatedRecordId: ex.id,
          cottage: ex.cottage,
          actionLabel: 'مشاهده خروج',
        });
      } else if (remainingDays <= LAB_EXPIRY_WARNING_DAYS) {
        pushNotif({
          dedupeKey: `notif:lab_expiring_soon:exit:${ex.id}`,
          category: 'lab_expiring_soon',
          title: `نزدیک شدن انقضای آزمایشگاه خروج — کوتاژ ${fa(ex.cottage)}`,
          description: `${fa(remainingDays)} روز تا انقضای آزمایشگاه (${fmtJ(expDate)}) باقی مانده است.`,
          createdAt: ex.createdAt,
          jalaliDate: expDate,
          priority: 'medium',
          relatedRecordType: 'exit',
          relatedRecordId: ex.id,
          cottage: ex.cottage,
          actionLabel: 'مشاهده خروج',
        });
      }
    }
  });

  // 7 & 8. Tasks due today & Overdue tasks
  tasks.forEach((task) => {
    if (task.status === 'completed' || task.status === 'cancelled') return;
    const diff = compareJalaliDates(task.dueDate, refToday);
    if (diff < 0) {
      pushNotif({
        dedupeKey: `notif:task_overdue:${task.id}`,
        category: 'task_overdue',
        title: `کار عقب‌افتاده: ${task.title}`,
        description: `سررسید این کار (${fmtJ(task.dueDate)}) گذشته است · مسئول: ${task.assignedTo}${task.cottage ? ` · کوتاژ ${fa(task.cottage)}` : ''}.`,
        createdAt: task.createdAt,
        jalaliDate: task.dueDate,
        priority: task.priority === 'critical' ? 'critical' : 'high',
        relatedRecordType: 'task',
        relatedRecordId: task.id,
        cottage: task.cottage,
        actionLabel: 'باز کردن کارها',
      });
    } else if (diff === 0) {
      pushNotif({
        dedupeKey: `notif:task_due_today:${task.id}`,
        category: 'task_due_today',
        title: `کار سررسید امروز: ${task.title}`,
        description: `امروز سررسید انجام این کار است · مسئول: ${task.assignedTo}${task.cottage ? ` · کوتاژ ${fa(task.cottage)}` : ''}.`,
        createdAt: task.createdAt,
        jalaliDate: task.dueDate,
        priority: task.priority === 'critical' || task.priority === 'high' ? task.priority : 'medium',
        relatedRecordType: 'task',
        relatedRecordId: task.id,
        cottage: task.cottage,
        actionLabel: 'باز کردن کارها',
      });
    }
  });

  // Sort: unread first, then priority, then newest
  return results.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    if (a.read !== b.read) return a.read ? 1 : -1;
    const pDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (pDiff !== 0) return pDiff;
    return b.createdAt - a.createdAt;
  });
}

/**
 * Generate deduplicated follow-up tasks for active workflow events.
 * Uses `autoSourceKey` so refreshing never duplicates existing tasks.
 */
export function generateAutoFollowUpTasks(input: {
  docs: EntryDoc[];
  labRecords: LabRecord[];
  physicalExits: PhysicalExitTransaction[];
  existingTasks: DailyTask[];
  refToday?: JalaliDate;
  defaultAssignee?: string;
}): DailyTask[] {
  const {
    docs,
    labRecords,
    physicalExits,
    existingTasks,
    refToday = todayJ(),
    defaultAssignee = 'نظری',
  } = input;

  const existingKeys = new Set(
    existingTasks.map((t) => t.autoSourceKey).filter(Boolean) as string[]
  );

  const newTasks: DailyTask[] = [];
  const todayJdn = j2d(refToday.jy, refToday.jm, refToday.jd);

  const addIfMissing = (candidate: Omit<DailyTask, 'id' | 'createdAt' | 'createdAtDate'>) => {
    if (!candidate.autoSourceKey || existingKeys.has(candidate.autoSourceKey)) return;
    existingKeys.add(candidate.autoSourceKey);
    newTasks.push({
      ...candidate,
      id: `task-${uid()}`,
      createdAtDate: refToday,
      createdAt: Date.now(),
    });
  };

  docs.forEach((doc) => {
    const clearance = normalizeEntryClearance(doc, physicalExits);
    const balances = computePalletBalances({ ...doc, clearance }, physicalExits);
    if (clearance.closure.closed) return;

    const firstCompleted =
      balances.firstStagePallets === 0 || clearance.firstStage.status === 'completed';

    // Auto Task 1: Follow up on Sata approval
    if (firstCompleted && balances.remainingPallets > 0 && !balances.sataReceived && !balances.sataConfirmed) {
      addIfMissing({
        autoSourceKey: `auto:sata_followup:${doc.id}`,
        title: `پیگیری دریافت کد ساتا — کوتاژ ${fa(doc.cottage)}`,
        description: `پیگیری صدور و ثبت کد ساتا جهت آزادسازی ${fa(balances.remainingPallets)} پالت ۱۰٪ باقی‌مانده (${doc.goods}).`,
        cottage: doc.cottage,
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        assignedTo: defaultAssignee,
        priority: 'high',
        dueDate: refToday,
        status: 'pending',
        notes: 'تولید خودکار پس از تکمیل مرحله ۹۰٪ اول',
        createdBy: 'سیستم هوشمند',
        isAuto: true,
      });
    }

    // Auto Task 2: Confirm Sata code
    if (balances.remainingPallets > 0 && balances.sataReceived && !balances.sataConfirmed) {
      addIfMissing({
        autoSourceKey: `auto:confirm_sata:${doc.id}`,
        title: `تایید نهایی کد ساتا — کوتاژ ${fa(doc.cottage)}`,
        description: `کد ساتا (${clearance.sata.code || 'ثبت‌شده'}) دریافت شده و نیازمند تایید کاربر مجاز برای آزادسازی ${fa(balances.remainingPallets)} پالت است.`,
        cottage: doc.cottage,
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        assignedTo: 'نظری',
        priority: 'critical',
        dueDate: refToday,
        status: 'pending',
        notes: 'تولید خودکار هنگام دریافت کد ساتا',
        createdBy: 'سیستم هوشمند',
        isAuto: true,
      });
    }

    // Auto Task 3: Complete missing documentation
    const unloadJdn = doc.unloadDate ? j2d(doc.unloadDate.jy, doc.unloadDate.jm, doc.unloadDate.jd) : todayJdn;
    const missingDocs = !doc.invoicePaid || !doc.receipt?.number || !doc.tasks?.bl || !doc.tasks?.arr || !doc.tasks?.tali;
    if (missingDocs && todayJdn - unloadJdn >= 2) {
      addIfMissing({
        autoSourceKey: `auto:missing_docs:${doc.id}`,
        title: `تکمیل مدارک و قبض انبار — کوتاژ ${fa(doc.cottage)}`,
        description: `مدارک ورودی (بارنامه/اعلام وصول/تالی/قبض انبار) برای محموله ${doc.goods} هنوز تکمیل نشده است.`,
        cottage: doc.cottage,
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        assignedTo: defaultAssignee,
        priority: 'medium',
        dueDate: refToday,
        status: 'pending',
        notes: 'تولید خودکار برای مدارک ناقص ورودی',
        createdBy: 'سیستم هوشمند',
        isAuto: true,
      });
    }

    // Auto Task 4: Complete remaining physical exits when cleared
    if (
      balances.totalRemaining > 0 &&
      (balances.firstStageRemaining > 0 || (balances.sataConfirmed && balances.remainingStageAvailable > 0))
    ) {
      addIfMissing({
        autoSourceKey: `auto:remaining_exit:${doc.id}`,
        title: `ثبت خروج فیزیکی پالت‌های آزادشده — کوتاژ ${fa(doc.cottage)}`,
        description: `${fa(balances.firstStageRemaining + balances.remainingStageAvailable)} پالت آماده خروج فیزیکی از انبار است.`,
        cottage: doc.cottage,
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        assignedTo: defaultAssignee,
        priority: 'high',
        dueDate: refToday,
        status: 'pending',
        notes: 'تولید خودکار برای بار آماده خروج',
        createdBy: 'سیستم هوشمند',
        isAuto: true,
      });
    }

    // Auto Task 5: Review incomplete / overdue shipment
    if (todayJdn - unloadJdn > CLEARANCE_OVERDUE_DAYS && !balances.isFullyExited) {
      addIfMissing({
        autoSourceKey: `auto:incomplete_shipment:${doc.id}`,
        title: `بررسی پرونده تاخیردار — کوتاژ ${fa(doc.cottage)}`,
        description: `بیش از ${fa(CLEARANCE_OVERDUE_DAYS)} روز از تخلیه گذشته و ${fa(balances.totalRemaining)} پالت هنوز خارج نشده است.`,
        cottage: doc.cottage,
        relatedRecordType: 'entry',
        relatedRecordId: doc.id,
        assignedTo: defaultAssignee,
        priority: 'critical',
        dueDate: refToday,
        status: 'pending',
        notes: 'تولید خودکار برای محموله دارای تاخیر',
        createdBy: 'سیستم هوشمند',
        isAuto: true,
      });
    }
  });

  // Auto Task 6: Follow up on lab expiration
  labRecords.forEach((rec) => {
    const expDate = addMonthsJ(rec.sampleDate, rec.validity || 6);
    const remainingDays = daysUntil(expDate);
    if (remainingDays <= LAB_EXPIRY_WARNING_DAYS) {
      addIfMissing({
        autoSourceKey: `auto:lab_expiry:${rec.id}`,
        title: remainingDays < 0 ? `تمدید فوری گواهی آزمایشگاه منقضی — ${rec.goods}` : `پیگیری انقضای گواهی آزمایشگاه — ${rec.goods}`,
        description:
          remainingDays < 0
            ? `اعتبار گواهی آزمایشگاه در تاریخ ${fmtJ(expDate)} منقضی شده و نیازمند نمونه‌برداری یا تمدید است.`
            : `تا ${fa(remainingDays)} روز دیگر (${fmtJ(expDate)}) گواهی آزمایشگاه منقضی می‌شود.`,
        relatedRecordType: 'lab',
        relatedRecordId: rec.id,
        assignedTo: defaultAssignee,
        priority: remainingDays <= 0 ? 'critical' : 'high',
        dueDate: refToday,
        status: 'pending',
        notes: 'تولید خودکار برای انقضای آزمایشگاه',
        createdBy: 'سیستم هوشمند',
        isAuto: true,
      });
    }
  });

  return newTasks;
}
