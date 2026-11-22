import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  ShieldCheck,
  Lock,
  Unlock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  KeyRound,
  FolderCheck,
  UserCheck,
  ClipboardList,
} from 'lucide-react';
import {
  EntryDoc,
  ExitDoc,
  Batch,
  JalaliDate,
  PhysicalExitTransaction,
  UserPermissions,
} from '../types';
import {
  CLEARANCE_STATUS_META,
  computePalletBalances,
  normalizeEntryClearance,
  validateCaseClosure,
  validatePhysicalExitTransaction,
  buildPhysicalExitFingerprint,
} from '../utils/clearance9010';
import { JalaliDatePicker } from './JalaliDatePicker';
import { fa, fmtJ, todayJ, uid, en } from '../utils/jalali';

interface Clearance9010DrawerProps {
  isOpen: boolean;
  doc: EntryDoc | null;
  exits: ExitDoc[];
  batches: Batch[];
  physicalExits: PhysicalExitTransaction[];
  currentUser: string;
  permissions: UserPermissions;
  isViewOnly: boolean;
  onClose: () => void;
  onUpdateDoc: (updatedDoc: EntryDoc, auditDesc?: string) => void;
  onRequestMasterPassword: (message: string, onSuccess: () => void) => void;
  onAddPhysicalExit: (tx: PhysicalExitTransaction) => void;
  onUpdatePhysicalExit: (tx: PhysicalExitTransaction) => void;
  onDeletePhysicalExit: (id: string) => void;
  onCreateFollowUpTask: (doc: EntryDoc) => void;
  addToast: (text: string, type?: 'ok' | 'err' | 'info') => void;
}

type DrawerSection = 'first90' | 'sata10' | 'physical' | 'closure';

export const Clearance9010Drawer: React.FC<Clearance9010DrawerProps> = ({
  isOpen,
  doc,
  exits,
  batches,
  physicalExits,
  currentUser,
  permissions,
  isViewOnly,
  onClose,
  onUpdateDoc,
  onRequestMasterPassword,
  onAddPhysicalExit,
  onUpdatePhysicalExit,
  onDeletePhysicalExit,
  onCreateFollowUpTask,
  addToast,
}) => {
  const [activeSection, setActiveSection] = useState<DrawerSection>('first90');

  // First stage state
  const [firstStatus, setFirstStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');
  const [firstDate, setFirstDate] = useState<JalaliDate | null>(null);
  const [firstAuthPallets, setFirstAuthPallets] = useState<string>('0');
  const [firstDocsInput, setFirstDocsInput] = useState<string>('');
  const [firstNotes, setFirstNotes] = useState<string>('');

  // Sata & Remaining 10% state
  const [sataCode, setSataCode] = useState<string>('');
  const [sataReceivedDate, setSataReceivedDate] = useState<JalaliDate | null>(null);
  const [sataRefLetter, setSataRefLetter] = useState<string>('');
  const [sataDocsInput, setSataDocsInput] = useState<string>('');
  const [sataNotes, setSataNotes] = useState<string>('');
  const [remStatus, setRemStatus] = useState<'locked' | 'ready' | 'in_progress' | 'completed'>('locked');
  const [remClearanceDate, setRemClearanceDate] = useState<JalaliDate | null>(null);
  const [remNotes, setRemNotes] = useState<string>('');

  // Physical exit form state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txStage, setTxStage] = useState<'first_90' | 'remaining_10'>('first_90');
  const [txDate, setTxDate] = useState<JalaliDate>(todayJ());
  const [txTruck, setTxTruck] = useState<string>('');
  const [txPallets, setTxPallets] = useState<string>('');
  const [txDriver, setTxDriver] = useState<string>('');
  const [txDocsInput, setTxDocsInput] = useState<string>('');
  const [txNotes, setTxNotes] = useState<string>('');
  const [txExitDocId, setTxExitDocId] = useState<string>('');
  const [txError, setTxError] = useState<string>('');

  // Closure notes
  const [closureNotes, setClosureNotes] = useState<string>('');

  useEffect(() => {
    if (!doc) return;
    const clearance = normalizeEntryClearance(doc, physicalExits);
    const balances = computePalletBalances({ ...doc, clearance }, physicalExits);

    setFirstStatus(clearance.firstStage.status);
    setFirstDate(clearance.firstStage.clearanceDate);
    setFirstAuthPallets(
      String(
        clearance.firstStage.authorizedPallets ||
          (clearance.firstStage.status === 'completed' ? balances.firstStagePallets : balances.firstStagePallets)
      )
    );
    setFirstDocsInput((clearance.firstStage.documents || []).join('، '));
    setFirstNotes(clearance.firstStage.notes || '');

    setSataCode(clearance.sata.code || '');
    setSataReceivedDate(clearance.sata.receivedDate || todayJ());
    setSataRefLetter(clearance.sata.referenceLetterNo || '');
    setSataDocsInput((clearance.sata.documents || []).join('، '));
    setSataNotes(clearance.sata.notes || '');
    setRemStatus(clearance.remainingStage.status);
    setRemClearanceDate(clearance.remainingStage.clearanceDate);
    setRemNotes(clearance.remainingStage.notes || '');
    setClosureNotes(clearance.closure.notes || '');

    setEditingTxId(null);
    setTxStage(balances.firstStagePallets === 0 ? 'remaining_10' : 'first_90');
    setTxDate(todayJ());
    setTxTruck('');
    setTxPallets('');
    setTxDriver('');
    setTxDocsInput('');
    setTxNotes('');
    setTxExitDocId('');
    setTxError('');
  }, [doc?.id, isOpen]);

  if (!isOpen || !doc) return null;

  const clearance = normalizeEntryClearance(doc, physicalExits);
  const balances = computePalletBalances({ ...doc, clearance }, physicalExits);
  const statusMeta = CLEARANCE_STATUS_META[clearance.status];
  const isClosed = clearance.closure.closed;
  const canEditClearance = !isViewOnly && !isClosed && (permissions.canEditEntry || permissions.canEditCriticalClearance !== false);

  // Find ExitDocs connected either directly or via consolidation batch
  const linkedExits = exits.filter((ex) => {
    if (ex.entryDocId === doc.id) return true;
    const b = batches.find((bt) => String(bt.id) === String(ex.batchId));
    return Boolean(b && b.docIds.includes(doc.id));
  });

  const docPhysicalExits = physicalExits
    .filter((t) => t.entryDocId === doc.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const closureCheck = validateCaseClosure(doc, physicalExits, linkedExits);

  const parseDocTags = (raw: string): string[] =>
    raw
      .split(/[,،\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSaveFirstStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditClearance) {
      addToast('مجوز ویرایش اطلاعات ترخیص را ندارید یا پرونده مختومه است.', 'err');
      return;
    }

    const parsedAuth = Math.floor(Number(en(firstAuthPallets)) || 0);
    if (parsedAuth < 0 || parsedAuth > balances.firstStagePallets) {
      addToast(`تعداد پالت مجاز مرحله اول باید بین ۰ تا ${fa(balances.firstStagePallets)} باشد.`, 'err');
      return;
    }
    if (parsedAuth < balances.firstStageExited) {
      addToast(`تعداد مجاز نمی‌تواند کمتر از پالت‌های خارج‌شده فعلی (${fa(balances.firstStageExited)}) باشد.`, 'err');
      return;
    }

    const finalAuth =
      firstStatus === 'completed' && parsedAuth === 0 && balances.firstStagePallets > 0
        ? balances.firstStagePallets
        : parsedAuth;

    const updatedClearance = normalizeEntryClearance(
      {
        ...doc,
        clearance: {
          ...clearance,
          firstStage: {
            status: firstStatus,
            clearanceDate: firstDate || (firstStatus === 'completed' ? todayJ() : null),
            authorizedPallets: finalAuth,
            documents: parseDocTags(firstDocsInput),
            notes: firstNotes.trim(),
            updatedBy: currentUser,
            updatedAt: Date.now(),
          },
          statusUpdatedAt: Date.now(),
        },
      },
      physicalExits
    );

    onUpdateDoc(
      { ...doc, clearance: updatedClearance },
      `بروزرسانی ترخیص ۹۰٪ اول کوتاژ ${fa(doc.cottage)} (${firstStatus})`
    );
    addToast('اطلاعات ترخیص مرحله اول (۹۰٪) ذخیره شد.', 'ok');
  };

  const handleRecordSataReceived = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditClearance) {
      addToast('مجوز ثبت اطلاعات ساتا را ندارید.', 'err');
      return;
    }
    if (!sataCode.trim()) {
      addToast('لطفاً کد ساتا را وارد کنید.', 'err');
      return;
    }

    const updatedClearance = normalizeEntryClearance(
      {
        ...doc,
        clearance: {
          ...clearance,
          sata: {
            ...clearance.sata,
            code: en(sataCode.trim()),
            receivedDate: sataReceivedDate || todayJ(),
            receivedBy: clearance.sata.receivedBy || currentUser,
            referenceLetterNo: en(sataRefLetter.trim()),
            documents: parseDocTags(sataDocsInput),
            notes: sataNotes.trim(),
          },
          statusUpdatedAt: Date.now(),
        },
      },
      physicalExits
    );

    onUpdateDoc(
      { ...doc, clearance: updatedClearance },
      `ثبت دریافت کد ساتا (${en(sataCode.trim())}) برای کوتاژ ${fa(doc.cottage)} — در انتظار تایید`
    );
    addToast('کد ساتا به عنوان «دریافت‌شده» ثبت شد. سهمیه ۱۰٪ تا زمان تایید نهایی همچنان قفل است.', 'info');
  };

  const handleConfirmSata = () => {
    if (isViewOnly || isClosed) return;
    if (permissions.canConfirmSata === false) {
      addToast('شما مجوز تایید نهایی کد ساتا و آزادسازی ۱۰٪ را ندارید.', 'err');
      return;
    }
    if (!sataCode.trim() && !clearance.sata.code.trim()) {
      addToast('ابتدا کد ساتا را ثبت کنید.', 'err');
      return;
    }

    onRequestMasterPassword(
      `برای تایید نهایی کد ساتا و آزادسازی ${fa(balances.remainingPallets)} پالت ۱۰٪ کوتاژ ${fa(doc.cottage)} رمز مدیریت را وارد کنید.`,
      () => {
        const updatedClearance = normalizeEntryClearance(
          {
            ...doc,
            clearance: {
              ...clearance,
              sata: {
                ...clearance.sata,
                code: en((sataCode || clearance.sata.code).trim()),
                receivedDate: sataReceivedDate || clearance.sata.receivedDate || todayJ(),
                receivedBy: clearance.sata.receivedBy || currentUser,
                confirmed: true,
                confirmedDate: todayJ(),
                confirmedBy: currentUser,
                referenceLetterNo: en(sataRefLetter.trim()),
                documents: parseDocTags(sataDocsInput),
                notes: sataNotes.trim(),
              },
              remainingStage: {
                ...clearance.remainingStage,
                status: 'ready',
                updatedBy: currentUser,
                updatedAt: Date.now(),
              },
              statusUpdatedAt: Date.now(),
            },
          },
          physicalExits
        );

        onUpdateDoc(
          { ...doc, clearance: updatedClearance },
          `تایید نهایی کد ساتا و آزادسازی ۱۰٪ کوتاژ ${fa(doc.cottage)} توسط ${currentUser}`
        );
        addToast('کد ساتا تایید نهایی شد و سهمیه ۱۰٪ باقی‌مانده آزاد گردید.', 'ok');
      }
    );
  };

  const handleSaveRemainingStage = () => {
    if (!canEditClearance) return;
    if (!balances.sataConfirmed) {
      addToast('تا پیش از تایید نهایی ساتا امکان تغییر وضعیت ۱۰٪ وجود ندارد.', 'err');
      return;
    }
    const updatedClearance = normalizeEntryClearance(
      {
        ...doc,
        clearance: {
          ...clearance,
          remainingStage: {
            ...clearance.remainingStage,
            status: remStatus,
            clearanceDate: remClearanceDate || (remStatus === 'completed' ? todayJ() : null),
            notes: remNotes.trim(),
            updatedBy: currentUser,
            updatedAt: Date.now(),
          },
          statusUpdatedAt: Date.now(),
        },
      },
      physicalExits
    );
    onUpdateDoc(
      { ...doc, clearance: updatedClearance },
      `بروزرسانی ترخیص ۱۰٪ باقی‌مانده کوتاژ ${fa(doc.cottage)}`
    );
    addToast('وضعیت ترخیص ۱۰٪ باقی‌مانده ذخیره شد.', 'ok');
  };

  const handleSubmitPhysicalExit = (e: React.FormEvent) => {
    e.preventDefault();
    setTxError('');

    if (isViewOnly || !permissions.canCreateExit) {
      setTxError('شما مجوز ثبت خروج فیزیکی را ندارید.');
      return;
    }
    if (editingTxId && permissions.canModifyCompletedExits === false) {
      setTxError('شما مجوز ویرایش تراکنش‌های خروج ثبت‌شده را ندارید.');
      return;
    }

    const rawPallets = Number(en(txPallets.trim()));
    const validation = validatePhysicalExitTransaction(
      {
        id: editingTxId || undefined,
        entryDocId: doc.id,
        stage: txStage,
        exitDate: txDate,
        truckInfo: txTruck,
        pallets: rawPallets,
        driverInfo: txDriver,
      },
      doc,
      physicalExits
    );

    if (!validation.valid) {
      setTxError(validation.error || 'خطا در اعتبارسنجی خروج فیزیکی');
      return;
    }

    const txObj: PhysicalExitTransaction = {
      id: editingTxId || `pex-${uid()}`,
      entryDocId: doc.id,
      exitDocId: txExitDocId || undefined,
      cottage: doc.cottage,
      stage: txStage,
      exitDate: txDate,
      truckInfo: txTruck.trim(),
      pallets: rawPallets,
      driverInfo: txDriver.trim(),
      documents: parseDocTags(txDocsInput),
      notes: txNotes.trim(),
      responsibleUser: currentUser || 'مدیر',
      createdAt: editingTxId
        ? docPhysicalExits.find((t) => t.id === editingTxId)?.createdAt || Date.now()
        : Date.now(),
      updatedAt: editingTxId ? Date.now() : undefined,
      fingerprint: buildPhysicalExitFingerprint({
        entryDocId: doc.id,
        stage: txStage,
        exitDate: txDate,
        truckInfo: txTruck.trim(),
        pallets: rawPallets,
      }),
    };

    const commitTx = () => {
      if (editingTxId) {
        onUpdatePhysicalExit(txObj);
        addToast('تراکنش خروج فیزیکی بروزرسانی شد.', 'ok');
      } else {
        onAddPhysicalExit(txObj);
        addToast(`خروج فیزیکی ${fa(rawPallets)} پالت با موفقیت ثبت شد.`, 'ok');
      }
      setEditingTxId(null);
      setTxTruck('');
      setTxPallets('');
      setTxDriver('');
      setTxDocsInput('');
      setTxNotes('');
      setTxError('');
    };

    if (editingTxId) {
      onRequestMasterPassword(
        `برای ویرایش تراکنش خروج فیزیکی ثبت‌شده کوتاژ ${fa(doc.cottage)} رمز مدیریت را وارد کنید.`,
        commitTx
      );
    } else {
      commitTx();
    }
  };

  const handleStartEditTx = (tx: PhysicalExitTransaction) => {
    if (isClosed || isViewOnly || permissions.canModifyCompletedExits === false) {
      addToast('امکان ویرایش این تراکنش وجود ندارد.', 'err');
      return;
    }
    setEditingTxId(tx.id);
    setTxStage(tx.stage);
    setTxDate(tx.exitDate);
    setTxTruck(tx.truckInfo);
    setTxPallets(String(tx.pallets));
    setTxDriver(tx.driverInfo);
    setTxDocsInput((tx.documents || []).join('، '));
    setTxNotes(tx.notes);
    setTxExitDocId(tx.exitDocId || '');
    setTxError('');
  };

  const handleDeleteTx = (tx: PhysicalExitTransaction) => {
    if (isClosed || isViewOnly || permissions.canModifyCompletedExits === false || !permissions.canDeleteItems) {
      addToast('امکان حذف این تراکنش خروج برای شما مجاز نیست.', 'err');
      return;
    }
    onRequestMasterPassword(
      `برای حذف تراکنش خروج فیزیکی (${fa(tx.pallets)} پالت · ${tx.truckInfo}) رمز مدیریت را وارد کنید.`,
      () => {
        onDeletePhysicalExit(tx.id);
        addToast('تراکنش خروج فیزیکی حذف شد و موجودی پالت‌ها بروزرسانی گردید.', 'info');
      }
    );
  };

  const handleFinalClosure = () => {
    if (isViewOnly || isClosed) return;
    if (permissions.canCloseCase === false) {
      addToast('شما مجوز اختتام نهایی پرونده را ندارید.', 'err');
      return;
    }
    if (!closureCheck.canClose) {
      addToast('شرایط اختتام نهایی پرونده هنوز تکمیل نشده است.', 'err');
      return;
    }

    onRequestMasterPassword(
      `تایید نهایی اختتام پرونده کوتاژ ${fa(doc.cottage)} پس از خروج کامل ${fa(balances.totalPallets)} پالت:`,
      () => {
        const updatedClearance = normalizeEntryClearance(
          {
            ...doc,
            clearance: {
              ...clearance,
              closure: {
                closed: true,
                closedDate: todayJ(),
                closedBy: currentUser,
                notes: closureNotes.trim(),
              },
              statusUpdatedAt: Date.now(),
            },
          },
          physicalExits
        );
        onUpdateDoc(
          { ...doc, clearance: updatedClearance },
          `اختتام نهایی پرونده کوتاژ ${fa(doc.cottage)} توسط ${currentUser}`
        );
        addToast(`پرونده کوتاژ ${fa(doc.cottage)} با موفقیت مختومه شد ✓`, 'ok');
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center safe-modal-backdrop sm:p-4 bg-black/80 backdrop-blur-xl animate-in fade-in font-vazir dir-rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ios-glass-modal rounded-3xl w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.95)] text-slate-100"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03] flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-cyan-500/25 to-amber-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-lalezar text-base sm:text-xl text-slate-100 tracking-wide">
                  ترخیص ۹۰/۱۰ و خروج · کوتاژ {fa(doc.cottage)}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${statusMeta.badgeCls}`}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
                {doc.goods} {doc.mdfThickness ? `· ضخامت ${doc.mdfThickness}` : ''} · پرونده {fa(doc.file)} · بارنامه {doc.bl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onCreateFollowUpTask(doc)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-bold cursor-pointer transition-all"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>کار پیگیری</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-white/15 cursor-pointer transition-colors"
              aria-label="بستن پنجره ۹۰/۱۰"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 5-KPI Tabular Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-4 sm:px-5 py-3 bg-slate-950/50 border-b border-white/10 shrink-0">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
            <span className="text-[10px] text-slate-400 block">کل پالت محموله</span>
            <b className="font-mono tabular-nums text-base text-slate-100">{fa(balances.totalPallets)}</b>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-2.5 text-center">
            <span className="text-[10px] text-cyan-300 block">سهمیه ۹۰٪ اول</span>
            <b className="font-mono tabular-nums text-base text-cyan-200">
              {fa(balances.firstStagePallets)} <span className="text-[10px] font-normal">(مانده: {fa(balances.firstStageRemaining)})</span>
            </b>
          </div>
          <div
            className={`rounded-xl p-2.5 text-center border ${
              balances.remainingStageLocked
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-indigo-500/10 border-indigo-400/40'
            }`}
          >
            <span className="text-[10px] text-amber-200 flex items-center justify-center gap-1">
              {balances.remainingStageLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 text-emerald-400" />}
              سهمیه ۱۰٪ باقی‌مانده
            </span>
            <b className="font-mono tabular-nums text-base text-amber-100">
              {fa(balances.remainingPallets)}{' '}
              <span className="text-[10px] font-normal">
                ({balances.remainingStageLocked ? 'قفل تا ساتا' : `آزاد: ${fa(balances.remainingStageAvailable)}`})
              </span>
            </b>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 text-center">
            <span className="text-[10px] text-emerald-300 block">خروج فیزیکی ثبت‌شده</span>
            <b className="font-mono tabular-nums text-base text-emerald-200">{fa(balances.totalExited)}</b>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-2.5 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] text-purple-300 block">کل پالت باقی‌مانده</span>
            <b className="font-mono tabular-nums text-base text-purple-200">{fa(balances.totalRemaining)}</b>
          </div>
        </div>

        {/* Section Selector Bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/50 border-b border-white/10 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'first90', label: '۱. ترخیص ۹۰٪ اول' },
            { id: 'sata10', label: '۲. ۱۰٪ باقی‌مانده و ساتا' },
            { id: 'physical', label: `۳. خروج فیزیکی تریلی‌ها (${fa(docPhysicalExits.length)})` },
            { id: 'closure', label: '۴. اختتام نهایی پرونده' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id as DrawerSection)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                activeSection === tab.id
                  ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200 shadow-sm'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isClosed && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/50 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-emerald-200">
                <FolderCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold">این پرونده در تاریخ {fmtJ(clearance.closure.closedDate)} توسط «{clearance.closure.closedBy || 'مدیر'}» به‌صورت قطعی مختومه شده است.</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">تمامی تاریخچه ترخیص، تایید ساتا و تراکنش‌های خروج فیزیکی به‌صورت آرشیو قابل مشاهده است.</p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: FIRST STAGE 90% */}
          {activeSection === 'first90' && (
            <form onSubmit={handleSaveFirstStage} className="space-y-4">
              <div className="ios-glass-card p-4 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-cyan-200">مدیریت مستقل مرحله اول (۹۰٪ سهمیه کل)</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      سهمیه محاسبه‌شده: {fa(balances.firstStagePallets)} پالت · خارج‌شده فیزیکی: {fa(balances.firstStageExited)} پالت · باقی‌مانده مجاز: {fa(balances.firstStageRemaining)} پالت
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">وضعیت ترخیص ۹۰٪ اول:</label>
                    <select
                      value={firstStatus}
                      disabled={!canEditClearance || balances.firstStagePallets === 0}
                      onChange={(e) => {
                        const val = e.target.value as 'pending' | 'in_progress' | 'completed';
                        setFirstStatus(val);
                        if (val === 'completed' && (Number(en(firstAuthPallets)) || 0) === 0) {
                          setFirstAuthPallets(String(balances.firstStagePallets));
                        }
                      }}
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none"
                    >
                      <option value="pending" className="bg-slate-900">در انتظار ترخیص اولیه</option>
                      <option value="in_progress" className="bg-slate-900">در حال انجام ترخیص</option>
                      <option value="completed" className="bg-slate-900">ترخیص ۹۰٪ تکمیل شده</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">تاریخ ترخیص ۹۰٪:</label>
                    <JalaliDatePicker
                      value={firstDate}
                      onChange={setFirstDate}
                      allowClear
                      placeholder="انتخاب تاریخ ترخیص"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">پالت مجاز برای خروج (حداکثر {fa(balances.firstStagePallets)}):</label>
                    <input
                      type="number"
                      min={balances.firstStageExited}
                      max={balances.firstStagePallets}
                      disabled={!canEditClearance || balances.firstStagePallets === 0}
                      value={firstAuthPallets}
                      onChange={(e) => setFirstAuthPallets(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs font-mono tabular-nums outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">مدارک مرتبط (جداشده با ویرگول):</label>
                    <input
                      type="text"
                      disabled={!canEditClearance}
                      value={firstDocsInput}
                      onChange={(e) => setFirstDocsInput(e.target.value)}
                      placeholder="مثلاً: پروانه سبز، قبض انبار، بیجک اول"
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">یادداشت ترخیص ۹۰٪:</label>
                    <input
                      type="text"
                      disabled={!canEditClearance}
                      value={firstNotes}
                      onChange={(e) => setFirstNotes(e.target.value)}
                      placeholder="توضیحات ارزیابی یا مجوز خروج..."
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none"
                    />
                  </div>
                </div>

                {canEditClearance && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl ios-glass-btn-primary text-xs font-bold cursor-pointer"
                    >
                      ذخیره وضعیت ۹۰٪ اول
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* SECTION 2: REMAINING 10% & SATA */}
          {activeSection === 'sata10' && (
            <div className="space-y-4">
              {/* Lock / Unlock Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 flex-wrap text-xs ${
                  balances.sataConfirmed
                    ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200'
                    : balances.sataReceived
                    ? 'bg-orange-500/15 border-orange-400/40 text-orange-200'
                    : 'bg-amber-500/10 border-amber-400/40 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {balances.sataConfirmed ? (
                    <Unlock className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold">
                      {balances.sataConfirmed
                        ? `کد ساتا توسط ${clearance.sata.confirmedBy || 'مدیر'} در تاریخ ${fmtJ(clearance.sata.confirmedDate)} تایید نهایی شده و ${fa(balances.remainingPallets)} پالت آزاد است.`
                        : balances.sataReceived
                        ? `کد ساتا (${clearance.sata.code}) ثبت شده اما هنوز تایید نهایی نشده است — خروج سهمیه ۱۰٪ همچنان قفل است!`
                        : `سهمیه ۱۰٪ باقی‌مانده (${fa(balances.remainingPallets)} پالت) تا زمان دریافت و تایید نهایی کد ساتا قفل است.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step A: Record Sata Code Received */}
              <form onSubmit={handleRecordSataReceived} className="ios-glass-card p-4 rounded-2xl border border-white/10 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h4 className="font-bold text-sm text-amber-200">الف) ثبت دریافت کد ساتا (بدون آزادسازی خودکار)</h4>
                  {clearance.sata.receivedBy && (
                    <span className="text-[11px] text-slate-400">ثبت‌کننده: {clearance.sata.receivedBy}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">کد ساتا:</label>
                    <input
                      type="text"
                      disabled={!canEditClearance || balances.sataConfirmed}
                      value={sataCode}
                      onChange={(e) => setSataCode(e.target.value)}
                      placeholder="مثلاً: SATA-14039821"
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs font-mono ltr text-left outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">تاریخ دریافت ساتا:</label>
                    <JalaliDatePicker
                      value={sataReceivedDate}
                      onChange={setSataReceivedDate}
                      allowClear
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">شماره نامه مرجع:</label>
                    <input
                      type="text"
                      disabled={!canEditClearance || balances.sataConfirmed}
                      value={sataRefLetter}
                      onChange={(e) => setSataRefLetter(e.target.value)}
                      placeholder="شماره نامه / مکاتبه ساتا"
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">مدارک ساتا (ویرگول جدا):</label>
                    <input
                      type="text"
                      disabled={!canEditClearance || balances.sataConfirmed}
                      value={sataDocsInput}
                      onChange={(e) => setSataDocsInput(e.target.value)}
                      placeholder="نامه بانک مرکزی، تخصیص ارز، تاییدیه..."
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">توضیحات ساتا:</label>
                    <input
                      type="text"
                      disabled={!canEditClearance || balances.sataConfirmed}
                      value={sataNotes}
                      onChange={(e) => setSataNotes(e.target.value)}
                      placeholder="یادداشت پیگیری ساتا..."
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
                  {canEditClearance && !balances.sataConfirmed && (
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold cursor-pointer transition-all"
                    >
                      ثبت دریافت کد ساتا (بدون تایید)
                    </button>
                  )}

                  {!isViewOnly && !isClosed && !balances.sataConfirmed && balances.remainingPallets > 0 && (
                    <button
                      type="button"
                      onClick={handleConfirmSata}
                      disabled={permissions.canConfirmSata === false}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-40 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>تایید نهایی ساتا و آزادسازی ۱۰٪ (نیازمند رمز مدیر)</span>
                    </button>
                  )}
                </div>
              </form>

              {/* Step B: Remaining 10% clearance status (only after Sata confirmed) */}
              {balances.sataConfirmed && (
                <div className="ios-glass-card p-4 rounded-2xl border border-indigo-400/30 space-y-3 text-xs">
                  <h4 className="font-bold text-sm text-indigo-200">ب) ترخیص ۱۰٪ باقی‌مانده پس از تایید ساتا</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">وضعیت ترخیص ۱۰٪:</label>
                      <select
                        value={remStatus}
                        disabled={!canEditClearance}
                        onChange={(e) => setRemStatus(e.target.value as any)}
                        className="w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none"
                      >
                        <option value="ready" className="bg-slate-900">آماده ترخیص ۱۰٪</option>
                        <option value="in_progress" className="bg-slate-900">ترخیص باقی‌مانده در حال انجام</option>
                        <option value="completed" className="bg-slate-900">ترخیص ۱۰٪ کامل شد</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">تاریخ ترخیص ۱۰٪:</label>
                      <JalaliDatePicker value={remClearanceDate} onChange={setRemClearanceDate} allowClear />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">یادداشت مرحله ۱۰٪:</label>
                      <input
                        type="text"
                        disabled={!canEditClearance}
                        value={remNotes}
                        onChange={(e) => setRemNotes(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none"
                      />
                    </div>
                  </div>
                  {canEditClearance && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveRemainingStage}
                        className="px-4 py-2 rounded-xl ios-glass-btn-primary font-bold cursor-pointer"
                      >
                        ذخیره وضعیت ترخیص ۱۰٪
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: PHYSICAL EXITS */}
          {activeSection === 'physical' && (
            <div className="space-y-4">
              {!isViewOnly && !isClosed && permissions.canCreateExit && (
                <form onSubmit={handleSubmitPhysicalExit} className="ios-glass-card p-4 rounded-2xl border border-cyan-400/25 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="font-bold text-sm text-cyan-200 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-cyan-400" />
                      <span>{editingTxId ? 'ویرایش تراکنش خروج فیزیکی' : 'ثبت تراکنش جدید خروج فیزیکی تریلی'}</span>
                    </h4>
                    {editingTxId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTxId(null);
                          setTxError('');
                        }}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        انصراف از ویرایش
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">مرحله سهمیه خروج:</label>
                      <select
                        value={txStage}
                        onChange={(e) => setTxStage(e.target.value as 'first_90' | 'remaining_10')}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                      >
                        <option value="first_90" className="bg-slate-900">
                          ۹۰٪ اول (مانده مجاز: {fa(balances.firstStageRemaining)} پالت)
                        </option>
                        <option value="remaining_10" className="bg-slate-900">
                          ۱۰٪ باقی‌مانده ({balances.sataConfirmed ? `آزاد: ${fa(balances.remainingStageAvailable)} پالت` : 'قفل تا تایید ساتا'})
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">تعداد پالت خروجی (عدد صحیح):</label>
                      <input
                        type="number"
                        step={1}
                        min={1}
                        value={txPallets}
                        onChange={(e) => setTxPallets(e.target.value)}
                        placeholder="مثلاً 30"
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono tabular-nums outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">تاریخ خروج فیزیکی:</label>
                      <JalaliDatePicker value={txDate} onChange={setTxDate} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">مشخصات تریلی / پلاک:</label>
                      <input
                        type="text"
                        value={txTruck}
                        onChange={(e) => setTxTruck(e.target.value)}
                        placeholder="مثلاً: 14 ع 235 ایران 11"
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">راننده / باربری:</label>
                      <input
                        type="text"
                        value={txDriver}
                        onChange={(e) => setTxDriver(e.target.value)}
                        placeholder="نام راننده یا شرکت حمل"
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">اتصال به سند خروج (اختیاری):</label>
                      <select
                        value={txExitDocId}
                        onChange={(e) => setTxExitDocId(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                      >
                        <option value="" className="bg-slate-900">— خروج مستقیم کوتاژ (بدون سند خروج) —</option>
                        {linkedExits.map((ex) => (
                          <option key={ex.id} value={ex.id} className="bg-slate-900">
                            سند خروج {fa(ex.cottage)} ({ex.bl})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">مدارک خروج (بیجک / بارنامه):</label>
                      <input
                        type="text"
                        value={txDocsInput}
                        onChange={(e) => setTxDocsInput(e.target.value)}
                        placeholder="بیجک خروج، برگه باسکول..."
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">یادداشت:</label>
                      <input
                        type="text"
                        value={txNotes}
                        onChange={(e) => setTxNotes(e.target.value)}
                        placeholder="توضیحات تکمیلی خروج..."
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                      />
                    </div>
                  </div>

                  {txError && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 flex items-center gap-2 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{txError}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl ios-glass-btn-primary font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{editingTxId ? 'ذخیره اصلاح خروج' : 'ثبت خروج فیزیکی'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* History Table */}
              <div className="ios-glass-card p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-200">
                    تاریخچه تراکنش‌های خروج فیزیکی ({fa(docPhysicalExits.length)})
                  </h4>
                  <span className="text-xs text-slate-400 font-mono tabular-nums">
                    مجموع خارج‌شده: {fa(balances.totalExited)} از {fa(balances.totalPallets)} پالت
                  </span>
                </div>

                {docPhysicalExits.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    هنوز هیچ خروج فیزیکی برای این کوتاژ ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {docPhysicalExits.map((tx) => {
                      const linkedEx = exits.find((x) => x.id === tx.exitDocId);
                      return (
                        <div
                          key={tx.id}
                          className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 flex-wrap text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono tabular-nums font-bold text-emerald-300">
                                {fa(tx.pallets)} پالت
                              </span>
                              <span className="text-slate-500">·</span>
                              <span
                                className={`font-semibold ${
                                  tx.stage === 'first_90' ? 'text-cyan-300' : 'text-indigo-300'
                                }`}
                              >
                                {tx.stage === 'first_90' ? 'مرحله اول (۹۰٪)' : 'سهمیه ۱۰٪ باقی‌مانده'}
                              </span>
                              <span className="text-slate-500">·</span>
                              <span className="text-slate-200 font-semibold">{tx.truckInfo}</span>
                              {tx.driverInfo && (
                                <>
                                  <span className="text-slate-500">·</span>
                                  <span className="text-slate-300">{tx.driverInfo}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                              <span>تاریخ: {fmtJ(tx.exitDate)}</span>
                              <span>·</span>
                              <span>مسئول: {tx.responsibleUser}</span>
                              {linkedEx && (
                                <>
                                  <span>·</span>
                                  <span className="text-blue-300">متصل به سند خروج {fa(linkedEx.cottage)}</span>
                                </>
                              )}
                              {tx.documents.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span>مدارک: {tx.documents.join('، ')}</span>
                                </>
                              )}
                              {tx.notes && (
                                <>
                                  <span>·</span>
                                  <span className="text-slate-300">{tx.notes}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {!isClosed && !isViewOnly && permissions.canModifyCompletedExits !== false && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditTx(tx)}
                                className="p-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 cursor-pointer"
                                title="ویرایش (نیازمند رمز مدیر)"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {permissions.canDeleteItems && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTx(tx)}
                                  className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 cursor-pointer"
                                  title="حذف (نیازمند رمز مدیر)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 4: FINAL CASE CLOSURE */}
          {activeSection === 'closure' && (
            <div className="ios-glass-card p-5 rounded-2xl border border-white/10 space-y-4 text-xs">
              <div className="border-b border-white/10 pb-3">
                <h4 className="font-bold text-sm text-emerald-200 flex items-center gap-2">
                  <FolderCheck className="w-4 h-4 text-emerald-400" />
                  <span>بررسی شروط و اختتام نهایی پرونده</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  پرونده هرگز با تکمیل تشریفات گمرکی به‌صورت خودکار بسته نمی‌شود و نیازمند خروج فیزیکی ۱۰۰٪ پالت‌ها و تایید کاربر مجاز است.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <span>تطبیق خروج فیزیکی کل پالت‌ها ({fa(balances.totalExited)} از {fa(balances.totalPallets)})</span>
                  <span className={balances.isFullyExited ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                    {balances.isFullyExited ? 'تکمیل شده ✓' : `${fa(balances.totalRemaining)} پالت باقی‌مانده`}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <span>تکمیل ترخیص ۹۰٪ اول</span>
                  <span className={balances.firstStagePallets === 0 || clearance.firstStage.status === 'completed' ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                    {balances.firstStagePallets === 0 || clearance.firstStage.status === 'completed' ? 'تکمیل شده ✓' : 'در انتظار تکمیل'}
                  </span>
                </div>

                {balances.remainingPallets > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <span>تایید نهایی ساتا و تکمیل ترخیص ۱۰٪</span>
                    <span className={balances.sataConfirmed && clearance.remainingStage.status === 'completed' ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                      {balances.sataConfirmed && clearance.remainingStage.status === 'completed'
                        ? 'تایید و تکمیل شده ✓'
                        : !balances.sataConfirmed
                        ? 'در انتظار تایید ساتا'
                        : 'ترخیص ۱۰٪ در انتظار تکمیل'}
                    </span>
                  </div>
                )}
              </div>

              {!closureCheck.canClose && !isClosed && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                  <p className="font-bold">موانع اختتام پرونده:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {closureCheck.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!isClosed && !isViewOnly && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">یادداشت اختتام نهایی (اختیاری):</label>
                    <input
                      type="text"
                      value={closureNotes}
                      onChange={(e) => setClosureNotes(e.target.value)}
                      placeholder="توضیحات نهایی تسویه و تحویل کامل محموله..."
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-xs outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!closureCheck.canClose || permissions.canCloseCase === false}
                    onClick={handleFinalClosure}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تایید اختتام نهایی پرونده (نیازمند رمز مدیر)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
