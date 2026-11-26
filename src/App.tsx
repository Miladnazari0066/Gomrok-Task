import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { LoginGate, UserRole } from './components/LoginGate';
import { CompanyOnboardingWizard } from './components/CompanyOnboardingWizard';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import { PasswordModal } from './components/PasswordModal';
import { EntryForm } from './components/EntryForm';
import { EntryCard } from './components/EntryCard';
import { ConsolidationSection } from './components/ConsolidationSection';
import { ExitForm } from './components/ExitForm';
import { ExitCard } from './components/ExitCard';
import { LabRecordsSection } from './components/LabRecordsSection';
import { ReportsSection } from './components/ReportsSection';
import { CustomsLettersSection } from './components/CustomsLettersSection';
import { CommoditySummaryModal } from './components/CommoditySummaryModal';
import { SecurityCenterModal } from './components/SecurityCenterModal';
import { JalaliDatePicker } from './components/JalaliDatePicker';
import { CloudDbSyncModal } from './components/CloudDbSyncModal';
import { Clearance9010Drawer } from './components/Clearance9010Drawer';
import { NotificationCenterDrawer } from './components/NotificationCenterDrawer';
import { DailyTasksDrawer } from './components/DailyTasksDrawer';
import { PWAInstallGate } from './components/PWAInstallGate';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileToolsView } from './components/MobileToolsView';
import { useDeviceEnvironment } from './hooks/useDeviceEnvironment';
import {
  initializeSecurity,
  getIdleTimeoutMinutes,
  clearSessionToken,
  logSecurityEvent,
} from './utils/security';
import {
  EntryDoc,
  Batch,
  ExitDoc,
  LabRecord,
  MainTabType,
  EntrySubTab,
  ExitSubTab,
  EntryFilterType,
  ExitFilterType,
  JalaliDate,
  UserPermissions,
  PhysicalExitTransaction,
  DailyTask,
  NotificationStateRecord,
  AppNotification,
  WorkspaceContextData,
  CompanyRole,
  CompanyMember,
} from './types';
import {
  loadAllData,
  loadEmptyData,
  saveAllData,
  clearAllTestData,
  clearCompanyLocalCache,
  DEFAULT_IMPORTERS,
  DEFAULT_CARRIERS,
  DEFAULT_BRANDS,
} from './utils/storage';
import { fa, uid, todayJ, en, j2d, d2j, jMonthLen } from './utils/jalali';
import {
  CLEARANCE_STATUS_META,
  computePalletBalances,
  deriveClearanceStatus,
  inferMdfThickness,
  normalizeEntryClearance,
} from './utils/clearance9010';
import { generateNotifications, generateAutoFollowUpTasks, matchesTaskView } from './utils/workflowEngine';
import { getSupabase, isSupabaseConfigured } from './lib/supabase';
import { EMPTY_PERMISSIONS } from './utils/permissions';
import {
  fetchWorkspaceContext,
  getSelectedCompanyId,
  setSelectedCompanyId,
  listCompanyRolesApi,
  listCompanyUsersApi,
} from './services/workspaceApi';
import {
  fetchAllDataFromCloud,
  migrateLocalDataToCloud,
  saveEntryDocCloud,
  deleteEntryDocCloud,
  saveBatchCloud,
  deleteBatchCloud,
  saveExitDocCloud,
  deleteExitDocCloud,
  saveLabRecordCloud,
  savePhysicalExitCloud,
  deletePhysicalExitCloud,
  saveDailyTaskCloud,
  deleteDailyTaskCloud,
  saveNotificationStatesCloud,
  saveLookupOptionsCloud,
  AllAppData,
} from './services/db';
import {
  isMiladNazariAccount,
  DELETE_FORBIDDEN_MESSAGE,
} from './utils/deleteGuard';
import {
  PackageCheck,
  LogOut,
  BarChart3,
  FileSignature,
  Layers,
  FlaskConical,
  Search,
  Calendar,
  X,
  ListFilter,
  PlusCircle,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

export default function App() {
  const device = useDeviceEnvironment();
  const [previewBypassed, setPreviewBypassed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ctm_preview_bypass') === '1';
    } catch {
      return false;
    }
  });

  const handleBypassPreview = () => {
    try {
      sessionStorage.setItem('ctm_preview_bypass', '1');
    } catch {}
    setPreviewBypassed(true);
  };

  // Multi-Tenant Auth & Workspace State
  const [authView, setAuthView] = useState<'checking' | 'login' | 'onboarding' | 'ready'>('checking');
  const [onboardingMode, setOnboardingMode] = useState<'create' | 'restart' | 'claim_legacy'>('create');
  const [authExternalError, setAuthExternalError] = useState<string>('');
  const [workspace, setWorkspace] = useState<WorkspaceContextData | null>(null);
  const [wizardRoles, setWizardRoles] = useState<CompanyRole[]>([]);
  const [wizardMembers, setWizardMembers] = useState<CompanyMember[]>([]);

  const isAuthenticated = authView === 'ready' && Boolean(workspace);
  const company = workspace?.company || null;
  const companyId = company?.id || '';
  const enableImport = company ? company.enableImport : false;
  const enableExport = company ? company.enableExport : false;

  const [mainTab, setMainTab] = useState<MainTabType>('entry');
  const [entrySubTab, setEntrySubTab] = useState<EntrySubTab>('docs');
  const [exitSubTab, setExitSubTab] = useState<ExitSubTab>('docs');

  // Modals State
  const [isCloudDbModalOpen, setIsCloudDbModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isCompanySettingsOpen, setIsCompanySettingsOpen] = useState(false);

  // Initialize Security layer on app launch
  useEffect(() => {
    initializeSecurity();
  }, []);

  // Application Data States
  const [docs, setDocs] = useState<EntryDoc[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [exits, setExits] = useState<ExitDoc[]>([]);
  const [labRecords, setLabRecords] = useState<LabRecord[]>([]);
  const [physicalExits, setPhysicalExits] = useState<PhysicalExitTransaction[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [notificationStates, setNotificationStates] = useState<NotificationStateRecord[]>([]);
  const [importers, setImporters] = useState<string[]>([]);
  const [carriers, setCarriers] = useState<string[]>([]);
  const [goodsList, setGoodsList] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const dataLoadedRef = useRef(false);

  // Drawers & Navigation Highlight States
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isDailyTasksDrawerOpen, setIsDailyTasksDrawerOpen] = useState(false);
  const [clearanceDrawerDocId, setClearanceDrawerDocId] = useState<string | null>(null);
  const [taskPrefillDoc, setTaskPrefillDoc] = useState<EntryDoc | null>(null);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [highlightedExitId, setHighlightedExitId] = useState<string | null>(null);

  // Editing States
  const [editingDoc, setEditingDoc] = useState<EntryDoc | null>(null);
  const [editingExitDoc, setEditingExitDoc] = useState<ExitDoc | null>(null);

  // Mobile Device Form vs List View Switcher States ('list' | 'form')
  const [mobileEntryMode, setMobileEntryMode] = useState<'list' | 'form'>('list');
  const [mobileExitMode, setMobileExitMode] = useState<'list' | 'form'>('list');

  // Cloud Auto Sync State
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<Date | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Silent background auto-save to Supabase every 15 seconds (tenant-scoped)
  useEffect(() => {
    if (!isSupabaseConfigured() || !isAuthenticated || !companyId) return;

    const interval = setInterval(() => {
      setIsCloudSyncing(true);
      const currentAppData: AllAppData = {
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
      };
      migrateLocalDataToCloud(currentAppData, { companyId, enableImport, enableExport })
        .then(() => {
          setLastCloudSyncTime(new Date());
        })
        .catch(() => {
          // Silent background sync failure, do not interrupt user
        })
        .finally(() => {
          setTimeout(() => setIsCloudSyncing(false), 600);
        });
    }, 15000);

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    companyId,
    enableImport,
    enableExport,
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
  ]);

  // Manual cloud sync triggered by user button (tenant-scoped)
  const handleManualCloudSync = async () => {
    if (!isSupabaseConfigured() || !companyId) {
      addToast('دیتابیس ابری متصل نیست. لطفاً ابتدا از بخش تنظیمات اتصال را برقرار نمایید.', 'err');
      return;
    }
    setIsCloudSyncing(true);
    const currentAppData: AllAppData = {
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
    };
    try {
      await migrateLocalDataToCloud(currentAppData, { companyId, enableImport, enableExport });
      setLastCloudSyncTime(new Date());
      addToast('تمامی تغییرات و اسناد ثبت‌شده با موفقیت در دیتابیس ابری همگام‌سازی و ذخیره شدند.', 'ok');
    } catch (err: any) {
      addToast(`خطا در همگام‌سازی ابری: ${err?.message || 'مشکل در برقراری ارتباط'}`, 'err');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Search & Filter (Entry)
  const [entrySearch, setEntrySearch] = useState('');
  const [entryFilter, setEntryFilter] = useState<EntryFilterType>('all');
  const [entryStartDate, setEntryStartDate] = useState<JalaliDate | null>(null);
  const [entryEndDate, setEntryEndDate] = useState<JalaliDate | null>(null);
  const [showEntryDateFilter, setShowEntryDateFilter] = useState(false);

  // Search & Filter (Exit)
  const [exitSearch, setExitSearch] = useState('');
  const [exitFilter, setExitFilter] = useState<ExitFilterType>('all');
  const [exitStartDate, setExitStartDate] = useState<JalaliDate | null>(null);
  const [exitEndDate, setExitEndDate] = useState<JalaliDate | null>(null);
  const [showExitDateFilter, setShowExitDateFilter] = useState(false);

  // Preset Handlers
  const setEntryPreset = (type: 'today' | '7days' | '30days' | 'thisYear') => {
    const t = todayJ();
    const todayJdn = j2d(t.jy, t.jm, t.jd);
    if (type === 'today') {
      setEntryStartDate(t);
      setEntryEndDate(t);
    } else if (type === '7days') {
      setEntryStartDate(d2j(todayJdn - 6));
      setEntryEndDate(t);
    } else if (type === '30days') {
      setEntryStartDate(d2j(todayJdn - 29));
      setEntryEndDate(t);
    } else if (type === 'thisYear') {
      setEntryStartDate({ jy: t.jy, jm: 1, jd: 1 });
      setEntryEndDate({ jy: t.jy, jm: 12, jd: jMonthLen(t.jy, 12) });
    }
  };

  const setExitPreset = (type: 'today' | '7days' | '30days' | 'thisYear') => {
    const t = todayJ();
    const todayJdn = j2d(t.jy, t.jm, t.jd);
    if (type === 'today') {
      setExitStartDate(t);
      setExitEndDate(t);
    } else if (type === '7days') {
      setExitStartDate(d2j(todayJdn - 6));
      setExitEndDate(t);
    } else if (type === '30days') {
      setExitStartDate(d2j(todayJdn - 29));
      setExitEndDate(t);
    } else if (type === 'thisYear') {
      setExitStartDate({ jy: t.jy, jm: 1, jd: 1 });
      setExitEndDate({ jy: t.jy, jm: 12, jd: jMonthLen(t.jy, 12) });
    }
  };

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals
  const [passModal, setPassModal] = useState<{
    isOpen: boolean;
    message: string;
    action: () => void;
  }>({ isOpen: false, message: '', action: () => {} });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    text: string;
    okLabel?: string;
    requireDeletePassword?: boolean;
    action: () => void;
  }>({ isOpen: false, title: '', text: '', action: () => {} });

  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  const addToast = useCallback((text: string, type: 'ok' | 'err' | 'info' = 'info') => {
    const newToast: ToastMessage = {
      id: uid(),
      text,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 3500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const resetInMemoryTenantData = useCallback(() => {
    const empty = loadEmptyData();
    setDocs(empty.docs);
    setBatches(empty.batches);
    setExits(empty.exits);
    setLabRecords(empty.labRecords);
    setPhysicalExits(empty.physicalExits);
    setDailyTasks(empty.dailyTasks);
    setNotificationStates(empty.notificationStates);
    setImporters(empty.importers);
    setCarriers(empty.carriers);
    setGoodsList(empty.goodsList);
    setBrands(empty.brands);
    setEditingDoc(null);
    setEditingExitDoc(null);
    setClearanceDrawerDocId(null);
    dataLoadedRef.current = false;
  }, []);

  // Load Tenant Data from company-scoped cache & Supabase Cloud DB
  const loadTenantData = useCallback(
    async (targetCompanyId: string, impEnabled: boolean, expEnabled: boolean) => {
      if (!targetCompanyId) return;
      // 1. Load company-scoped local cache for instant paint
      const localData = loadAllData(targetCompanyId);
      setDocs(impEnabled ? localData.docs : []);
      setBatches(impEnabled ? localData.batches : []);
      setExits(expEnabled ? localData.exits : []);
      setLabRecords(expEnabled ? localData.labRecords : []);
      setPhysicalExits(expEnabled ? localData.physicalExits : []);
      setDailyTasks(localData.dailyTasks);
      setNotificationStates(localData.notificationStates);
      setImporters(localData.importers);
      setCarriers(localData.carriers);
      setGoodsList(localData.goodsList);
      setBrands(localData.brands);
      dataLoadedRef.current = true;

      // 2. Fetch authoritative tenant data from Supabase (protected by RLS)
      if (isSupabaseConfigured()) {
        try {
          const cloudData = await fetchAllDataFromCloud({
            companyId: targetCompanyId,
            enableImport: impEnabled,
            enableExport: expEnabled,
          });
          if (cloudData) {
            setDocs(cloudData.docs);
            setBatches(cloudData.batches);
            setExits(cloudData.exits);
            setLabRecords(cloudData.labRecords);
            setPhysicalExits(cloudData.physicalExits || []);
            setDailyTasks(cloudData.dailyTasks || []);
            setNotificationStates(cloudData.notificationStates || []);
            setImporters(cloudData.importers);
            setCarriers(cloudData.carriers);
            setGoodsList(cloudData.goodsList);
            setBrands(cloudData.brands);
            setLastCloudSyncTime(new Date());
            saveAllData(
              {
                docs: cloudData.docs,
                batches: cloudData.batches,
                exits: cloudData.exits,
                labRecords: cloudData.labRecords,
                physicalExits: cloudData.physicalExits || [],
                dailyTasks: cloudData.dailyTasks || [],
                notificationStates: cloudData.notificationStates || [],
                importers: cloudData.importers,
                carriers: cloudData.carriers,
                goodsList: cloudData.goodsList,
                brands: cloudData.brands,
              },
              targetCompanyId
            );
          }
        } catch (err: any) {
          if (
            err?.code === 'PGRST205' ||
            err?.isTableMissing ||
            err?.message?.includes('PGRST205') ||
            err?.message?.includes('جداول دیتابیس')
          ) {
            addToast(
              'جداول دیتابیس ابری در Supabase ساخته نشده‌اند. لطفاً از بخش «دیتابیس ابری»، اسکریپت SQL را کپی و اجرا نمایید.',
              'err'
            );
          } else if (err?.isNetworkError || err?.code === 'NETWORK_ERROR') {
            console.warn('Supabase host is currently unreachable. Continuing with company local cache.');
          } else {
            console.warn('Could not load tenant data from Supabase:', err?.message || err);
          }
        }
      }
    },
    [addToast]
  );

  // Resolve authenticated user's company workspace from server API
  const refreshWorkspace = useCallback(
    async (overrideCompanyId?: string | null) => {
      const supabase = getSupabase();
      if (!supabase) {
        setWorkspace(null);
        setAuthView('login');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setWorkspace(null);
        resetInMemoryTenantData();
        setAuthView('login');
        return;
      }

      try {
        const ctx = await fetchWorkspaceContext(overrideCompanyId ?? getSelectedCompanyId());
        setWorkspace(ctx);
        setSelectedCompanyId(ctx.company.id);
        setAuthExternalError('');

        if (!ctx.company.onboardingCompleted) {
          if (ctx.member.isOwner) {
            try {
              const [rolesRes, usersRes] = await Promise.all([
                listCompanyRolesApi().catch(() => ({ roles: [] })),
                listCompanyUsersApi().catch(() => ({ members: [] })),
              ]);
              setWizardRoles(rolesRes.roles || []);
              setWizardMembers(usersRes.members || []);
            } catch {
              // fallback to defaults inside wizard
            }
            setOnboardingMode('restart');
            setAuthView('onboarding');
          } else {
            setAuthExternalError(
              'راه‌اندازی اولیه شرکت شما هنوز توسط مالک شرکت تکمیل نشده است. لطفاً با مدیر سیستم تماس بگیرید.'
            );
            await supabase.auth.signOut().catch(() => {});
            setWorkspace(null);
            setAuthView('login');
          }
          return;
        }

        setAuthView('ready');
        await loadTenantData(ctx.company.id, ctx.company.enableImport, ctx.company.enableExport);
      } catch (err: any) {
        console.warn('Workspace resolution failed:', err?.message || err);
        const status = err?.status;
        if (status === 401 || status === 403) {
          setAuthExternalError(
            err?.message || 'حساب کاربری شما غیرفعال است یا به هیچ شرکتی متصل نشده است.'
          );
          await supabase.auth.signOut().catch(() => {});
          setSelectedCompanyId(null);
          setWorkspace(null);
          resetInMemoryTenantData();
          setAuthView('login');
        } else {
          setAuthExternalError(err?.message || 'خطا در اتصال به سرور فضای کاری.');
          setAuthView('login');
        }
      }
    },
    [loadTenantData, resetInMemoryTenantData]
  );

  // Bootstrap Supabase Auth session on mount & listen to session changes
  useEffect(() => {
    refreshWorkspace();
    const supabase = getSupabase();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setWorkspace(null);
        setSelectedCompanyId(null);
        resetInMemoryTenantData();
        setAuthView('login');
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshWorkspace, resetInMemoryTenantData]);

  // Derived Role, Label & Effective Permissions (strictly module-aware + RBAC-enforced)
  const activePermissions: UserPermissions = React.useMemo(() => {
    if (!workspace) return { ...EMPTY_PERMISSIONS };
    return workspace.effectivePermissions;
  }, [workspace]);

  const userRole: UserRole = React.useMemo(() => {
    if (!workspace) return 'viewer';
    const hasAnyWrite =
      workspace.member.isOwner ||
      activePermissions.canCreateEntry ||
      activePermissions.canEditEntry ||
      activePermissions.canCreateBatch ||
      activePermissions.canCreateExit ||
      activePermissions.canUpdateExitStages ||
      activePermissions.canCreateLab ||
      activePermissions.canManageLetters ||
      activePermissions.canManageTasks ||
      activePermissions.canManageCompanySettings ||
      activePermissions.canManageUsers;
    return hasAnyWrite ? 'admin' : 'viewer';
  }, [workspace, activePermissions]);

  const currentUser = workspace?.member.fullName || '';
  const activeOperatorLabel = workspace
    ? `${workspace.member.fullName} (${workspace.role.name})`
    : 'کاربر';

  // Exclusive deletion authorization: ONLY "Milad Nazari" account may delete anywhere in the system
  const isMiladNazari = React.useMemo(
    () => isMiladNazariAccount(workspace?.member),
    [workspace?.member]
  );
  const canAuthorizedDelete = isMiladNazari;

  const requestProtectedDelete = useCallback(
    (title: string, text: string, onConfirmed: () => void | Promise<void>) => {
      if (!isMiladNazari) {
        addToast(DELETE_FORBIDDEN_MESSAGE, 'err');
        return;
      }
      setConfirmModal({
        isOpen: true,
        title,
        text,
        okLabel: 'تأیید و حذف',
        requireDeletePassword: true,
        action: () => {
          setConfirmModal((prev) => ({
            ...prev,
            isOpen: false,
            requireDeletePassword: false,
          }));
          void onConfirmed();
        },
      });
    },
    [isMiladNazari, addToast]
  );

  const canOpenCompanySettings = Boolean(
    workspace &&
      (workspace.member.isOwner ||
        activePermissions.canManageCompanySettings ||
        activePermissions.canManageUsers ||
        activePermissions.canManageRoles)
  );

  // Ensure active tab always matches enabled company operations & user permissions
  useEffect(() => {
    if (!isAuthenticated) return;
    const canEntry = enableImport && activePermissions.canViewEntry;
    const canExit = enableExport && activePermissions.canViewExit;
    const canReports = activePermissions.canViewReports;
    const canLetters = activePermissions.canViewLetters !== false;

    if (mainTab === 'entry' && !canEntry) {
      if (canExit) setMainTab('exit');
      else if (canReports) setMainTab('reports');
      else if (canLetters) setMainTab('letters');
    } else if (mainTab === 'exit' && !canExit) {
      if (canEntry) setMainTab('entry');
      else if (canReports) setMainTab('reports');
      else if (canLetters) setMainTab('letters');
    } else if (mainTab === 'reports' && !canReports) {
      if (canEntry) setMainTab('entry');
      else if (canExit) setMainTab('exit');
      else if (canLetters) setMainTab('letters');
    } else if (mainTab === 'letters' && !canLetters) {
      if (canEntry) setMainTab('entry');
      else if (canExit) setMainTab('exit');
      else if (canReports) setMainTab('reports');
    }

    if (exitSubTab === 'lab' && !activePermissions.canViewLab) {
      setExitSubTab('docs');
    }
  }, [isAuthenticated, enableImport, enableExport, activePermissions, mainTab, exitSubTab]);

  // If viewport widens to desktop/tablet while mobile-only 'tools' tab is active, fall back cleanly
  useEffect(() => {
    if (typeof window === 'undefined' || mainTab !== 'tools') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const fallbackIfDesktop = () => {
      if (mq.matches) {
        if (enableImport && activePermissions.canViewEntry) setMainTab('entry');
        else if (enableExport && activePermissions.canViewExit) setMainTab('exit');
        else if (activePermissions.canViewReports) setMainTab('reports');
        else setMainTab('letters');
      }
    };
    fallbackIfDesktop();
    mq.addEventListener('change', fallbackIfDesktop);
    return () => mq.removeEventListener('change', fallbackIfDesktop);
  }, [mainTab, enableImport, enableExport, activePermissions]);

  const handleLoginSuccess = async () => {
    setAuthExternalError('');
    setAuthView('checking');
    await refreshWorkspace();
    addToast('خوش آمدید', 'ok');
  };

  const handleStartOnboarding = (mode: 'create' | 'claim_legacy') => {
    setAuthExternalError('');
    setWizardRoles([]);
    setWizardMembers([]);
    setOnboardingMode(mode);
    setAuthView('onboarding');
  };

  const handleLaunchRestartWizard = async () => {
    if (!workspace?.member.isOwner) {
      addToast('فقط مالک شرکت می‌تواند ویزارد راه‌اندازی مجدد را اجرا کند.', 'err');
      return;
    }
    try {
      const [rolesRes, usersRes] = await Promise.all([
        listCompanyRolesApi().catch(() => ({ roles: [] })),
        listCompanyUsersApi().catch(() => ({ members: [] })),
      ]);
      setWizardRoles(rolesRes.roles || []);
      setWizardMembers(usersRes.members || []);
    } catch {
      // proceed with existing workspace state
    }
    setOnboardingMode('restart');
    setAuthView('onboarding');
  };

  const handleSwitchCompany = async (nextCompanyId: string) => {
    if (!nextCompanyId || nextCompanyId === companyId) return;
    setSelectedCompanyId(nextCompanyId);
    resetInMemoryTenantData();
    setAuthView('checking');
    await refreshWorkspace(nextCompanyId);
    addToast('فضای کاری شرکت تغییر یافت.', 'ok');
  };

  const handleLogout = () => {
    logSecurityEvent({
      type: 'logout',
      user: currentUser || 'کاربر',
      role: workspace?.role.name || userRole,
      description: 'خروج کاربر از فضای کاری شرکت',
      severity: 'info',
    });
    clearSessionToken();
    setIsLoggingOut(true);
  };

  const handleLogoutComplete = async () => {
    const prevCompanyId = companyId;
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    if (prevCompanyId) {
      clearCompanyLocalCache(prevCompanyId);
    }
    setSelectedCompanyId(null);
    clearSessionToken();
    setWorkspace(null);
    resetInMemoryTenantData();
    setIsCompanySettingsOpen(false);
    setIsLoggingOut(false);
    setAuthView('login');
  };

  // Inactivity Auto-Lock Hook (قفل خودکار بر اثر عدم فعالیت)
  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: any = null;
    let lastActivityTime = 0;

    const resetIdleTimer = () => {
      const now = Date.now();
      if (now - lastActivityTime < 1500) return;
      lastActivityTime = now;

      if (timeoutId) clearTimeout(timeoutId);
      const minutes = getIdleTimeoutMinutes();
      if (minutes <= 0) return;

      timeoutId = setTimeout(async () => {
        logSecurityEvent({
          type: 'auto_lock',
          user: currentUser || 'کاربر',
          role: workspace?.role.name || userRole,
          description: `قفل خودکار سامانه به دلیل ${fa(minutes)} دقیقه بی‌کاری`,
          severity: 'warning',
        });
        const supabase = getSupabase();
        if (supabase) {
          await supabase.auth.signOut().catch(() => {});
        }
        if (companyId) clearCompanyLocalCache(companyId);
        setSelectedCompanyId(null);
        clearSessionToken();
        setWorkspace(null);
        resetInMemoryTenantData();
        setAuthView('login');
        addToast('نشست کاری شما به دلیل عدم فعالیت جهت حفظ امنیت سیستم بسته شد.', 'info');
      }, minutes * 60 * 1000);
    };

    const activityEvents = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
  }, [isAuthenticated, currentUser, workspace?.role.name, userRole, companyId, resetInMemoryTenantData, addToast]);

  const handleClearAllData = () => {
    requestProtectedDelete(
      'پاکسازی حافظه محلی شرکت',
      'آیا از پاکسازی حافظه محلی این دستگاه برای شرکت فعلی اطمینان دارید؟ داده‌های ذخیره شده در سرور ابری با همگام‌سازی بعدی مجدداً دریافت می‌شوند.',
      () => {
        clearAllTestData(companyId);
        resetInMemoryTenantData();
        logSecurityEvent({
          type: 'data_cleared',
          user: currentUser || 'مدیر',
          role: workspace?.role.name || userRole,
          description: 'حافظه محلی شرکت پاکسازی شد',
          severity: 'warning',
        });
        addToast('حافظه محلی با موفقیت پاکسازی شد.', 'ok');
      }
    );
  };

  // Helper Stage Detector for Entry Docs
  const getStageOfDoc = (d: EntryDoc): number => {
    if (!d) return 1;
    if ((d.unloaded ?? 0) < (d.trailers ?? 0)) return 1;
    if (!d.invoicePaid || !d.receipt?.number) return 2;
    if (!d.tasks || !(d.tasks.bl && d.tasks.arr && d.tasks.tali)) return 3;
    const b = (batches || []).find((bt) => bt.docIds && bt.docIds.includes(d.id));
    if (!b) return 4;
    return b.finalized ? 6 : 5;
  };

  // Toast Notification: Alert when document status changes from 'در حال تخلیه' (stage 1) to 'کامل' (stage 4)
  const prevDocStagesRef = useRef<Map<string, number>>(new Map());
  const stagesInitializedRef = useRef(false);

  useEffect(() => {
    if (!stagesInitializedRef.current) {
      if (docs.length > 0) {
        docs.forEach((d) => {
          prevDocStagesRef.current.set(d.id, getStageOfDoc(d));
        });
        stagesInitializedRef.current = true;
      }
      return;
    }

    docs.forEach((d) => {
      const prevStage = prevDocStagesRef.current.get(d.id);
      const currStage = getStageOfDoc(d);

      // Trigger confirmation toast when transitioning from 'در حال تخلیه' (stage 1) to 'کامل' (stage 4)
      if (prevStage === 1 && currStage === 4) {
        addToast(
          `✓ تایید: وضعیت سند کوتاژ ${fa(d.cottage)} با موفقیت از «در حال تخلیه» به «کامل» تغییر یافت.`,
          'ok'
        );
      }

      prevDocStagesRef.current.set(d.id, currStage);
    });
  }, [docs, batches]);

  // Option additions (tenant-scoped)
  const handleAddImporter = (name: string) => {
    if (!importers.includes(name)) {
      const next = [...importers, name];
      setImporters(next);
      saveAllData({ importers: next }, companyId);
      if (isSupabaseConfigured() && companyId) {
        saveLookupOptionsCloud({ importers: next }, companyId).catch((err) =>
          console.warn('Supabase sync notice (importers):', err?.message || err)
        );
      }
    }
  };

  const handleAddCarrier = (name: string) => {
    if (!carriers.includes(name)) {
      const next = [...carriers, name];
      setCarriers(next);
      saveAllData({ carriers: next }, companyId);
      if (isSupabaseConfigured() && companyId) {
        saveLookupOptionsCloud({ carriers: next }, companyId).catch((err) =>
          console.warn('Supabase sync notice (carriers):', err?.message || err)
        );
      }
    }
  };

  const handleAddGoods = (name: string) => {
    if (!goodsList.includes(name)) {
      const next = [...goodsList, name];
      setGoodsList(next);
      saveAllData({ goodsList: next }, companyId);
      if (isSupabaseConfigured() && companyId) {
        saveLookupOptionsCloud({ goodsList: next }, companyId).catch((err) =>
          console.warn('Supabase sync notice (goods):', err?.message || err)
        );
      }
    }
  };

  const handleAddBrand = (name: string) => {
    if (!brands.includes(name)) {
      const next = [...brands, name];
      setBrands(next);
      saveAllData({ brands: next }, companyId);
      if (isSupabaseConfigured() && companyId) {
        saveLookupOptionsCloud({ brands: next }, companyId).catch((err) =>
          console.warn('Supabase sync notice (brands):', err?.message || err)
        );
      }
    }
  };

  // Option Deletions (tenant-scoped + exclusively guarded via Milad Nazari & 1234)
  const handleDeleteImporter = (name: string) => {
    requestProtectedDelete(
      `حذف واردکننده «${name}»`,
      `آیا از حذف «${name}» از فهرست شرکت‌های واردکننده اطمینان دارید؟`,
      () => {
        const next = importers.filter((item) => item !== name);
        setImporters(next);
        saveAllData({ importers: next }, companyId);
        if (isSupabaseConfigured() && companyId) {
          saveLookupOptionsCloud({ importers: next }, companyId).catch((err) =>
            console.warn('Supabase sync notice (importers):', err?.message || err)
          );
        }
        addToast(`«${name}» از فهرست واردکنندگان حذف شد`, 'info');
      }
    );
  };

  const handleDeleteCarrier = (name: string) => {
    requestProtectedDelete(
      `حذف شرکت حمل «${name}»`,
      `آیا از حذف «${name}» از فهرست شرکت‌های حمل‌ونقل اطمینان دارید؟`,
      () => {
        const next = carriers.filter((item) => item !== name);
        setCarriers(next);
        saveAllData({ carriers: next }, companyId);
        if (isSupabaseConfigured() && companyId) {
          saveLookupOptionsCloud({ carriers: next }, companyId).catch((err) =>
            console.warn('Supabase sync notice (carriers):', err?.message || err)
          );
        }
        addToast(`«${name}» از فهرست شرکت‌های حمل حذف شد`, 'info');
      }
    );
  };

  const handleDeleteGoods = (name: string) => {
    requestProtectedDelete(
      `حذف نوع کالا «${name}»`,
      `آیا از حذف «${name}» از فهرست نوع کالاها اطمینان دارید؟`,
      () => {
        const next = goodsList.filter((item) => item !== name);
        setGoodsList(next);
        saveAllData({ goodsList: next }, companyId);
        if (isSupabaseConfigured() && companyId) {
          saveLookupOptionsCloud({ goodsList: next }, companyId).catch((err) =>
            console.warn('Supabase sync notice (goods):', err?.message || err)
          );
        }
        addToast(`«${name}» از فهرست کالاها حذف شد`, 'info');
      }
    );
  };

  const handleDeleteBrand = (name: string) => {
    requestProtectedDelete(
      `حذف برند «${name}»`,
      `آیا از حذف «${name}» از فهرست برندها اطمینان دارید؟`,
      () => {
        const next = brands.filter((item) => item !== name);
        setBrands(next);
        saveAllData({ brands: next }, companyId);
        if (isSupabaseConfigured() && companyId) {
          saveLookupOptionsCloud({ brands: next }, companyId).catch((err) =>
            console.warn('Supabase sync notice (brands):', err?.message || err)
          );
        }
        addToast(`«${name}» از فهرست برندها حذف شد`, 'info');
      }
    );
  };

  // Entry Doc Actions (tenant-scoped + Import module gated)
  const handleCreateOrUpdateEntryDoc = (
    data: Omit<EntryDoc, 'id' | 'createdAt' | 'unloaded' | 'invoicePaid' | 'receipt' | 'tasks'>
  ) => {
    if (!enableImport || userRole === 'viewer' || (editingDoc ? !activePermissions.canEditEntry : !activePermissions.canCreateEntry)) {
      addToast('شما مجوز ثبت یا ویرایش اسناد ورود را ندارید.', 'err');
      logSecurityEvent({
        type: 'unauthorized_attempt',
        user: currentUser || 'کاربر',
        role: userRole,
        description: 'تلاش غیرمجاز برای ایجاد یا ویرایش سند ورود',
        severity: 'warning',
      });
      return;
    }

    if (editingDoc) {
      const mergedBase: EntryDoc = {
        ...editingDoc,
        ...data,
        mdfThickness: data.mdfThickness || editingDoc.mdfThickness || inferMdfThickness(data.goods),
        unloaded: Math.min(editingDoc.unloaded, data.trailers),
      };
      const updatedDoc: EntryDoc = {
        ...mergedBase,
        clearance: normalizeEntryClearance(mergedBase),
      };
      const updated = docs.map((d) => (d.id === editingDoc.id ? updatedDoc : d));
      setDocs(updated);
      saveAllData({ docs: updated }, companyId);
      setEditingDoc(null);

      if (isSupabaseConfigured() && companyId) {
        saveEntryDocCloud(updatedDoc, companyId).catch((err) =>
          addToast(`خطا در ذخیره ابری: ${err.message || ''}`, 'err')
        );
      }

      addToast(`سند کوتاژ ${fa(data.cottage)} بروزرسانی شد`, 'ok');
    } else {
      const baseNewDoc: EntryDoc = {
        ...data,
        mdfThickness: data.mdfThickness || inferMdfThickness(data.goods),
        id: uid(),
        unloaded: 0,
        invoicePaid: false,
        receipt: { number: '', count: '' },
        tasks: { bl: false, arr: false, tali: false },
        createdAt: Date.now(),
      };
      const newDoc: EntryDoc = {
        ...baseNewDoc,
        clearance: normalizeEntryClearance(baseNewDoc),
      };
      const updated = [newDoc, ...docs];
      setDocs(updated);
      saveAllData({ docs: updated }, companyId);

      if (isSupabaseConfigured() && companyId) {
        saveEntryDocCloud(newDoc, companyId).catch((err) =>
          addToast(`خطا در ذخیره ابری: ${err.message || ''}`, 'err')
        );
      }

      logSecurityEvent({
        type: 'doc_created',
        user: activeOperatorLabel,
        role: userRole,
        description: `سند کوتاژ جدید ${fa(data.cottage)} ثبت شد`,
        severity: 'info',
      });

      addToast(`سند کوتاژ ${fa(data.cottage)} با موفقیت ثبت شد`, 'ok');
    }
    setMobileEntryMode('list');
  };

  const handleStartEditDoc = (doc: EntryDoc) => {
    if (!enableImport || userRole === 'viewer' || !activePermissions.canEditEntry) {
      addToast('شما دسترسی ویرایش اسناد ورود را ندارید.', 'err');
      return;
    }

    setEditingDoc(doc);
    setMobileEntryMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteDoc = (id: string) => {
    if (!enableImport) return;
    const target = docs.find((d) => d.id === id);
    if (!target) return;

    requestProtectedDelete(
      `حذف سند کوتاژ ${fa(target.cottage)}`,
      'آیا از حذف این سند ورود اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
      () => {
        const updatedBatches = batches
          .map((b) => ({
            ...b,
            docIds: b.docIds.filter((docId) => docId !== id),
          }))
          .filter((b) => b.docIds.length > 0);

        const updatedDocs = docs.filter((d) => d.id !== id);
        setDocs(updatedDocs);
        setBatches(updatedBatches);
        saveAllData({ docs: updatedDocs, batches: updatedBatches }, companyId);

        if (isSupabaseConfigured() && companyId) {
          deleteEntryDocCloud(id, companyId).catch((err) =>
            console.warn('Supabase sync notice (delete entry):', err?.message || err)
          );
        }

        logSecurityEvent({
          type: 'doc_deleted',
          user: currentUser || 'مدیر',
          role: userRole,
          description: `سند کوتاژ ${fa(target.cottage)} حذف شد`,
          severity: 'warning',
        });

        addToast('سند کوتاژ حذف شد', 'info');
      }
    );
  };

  const handleUpdateUnloaded = (id: string, delta: number) => {
    let targetDoc: EntryDoc | null = null;
    const updated = docs.map((d) => {
      if (d.id === id) {
        const next = Math.max(0, Math.min(d.trailers, d.unloaded + delta));
        targetDoc = { ...d, unloaded: next };
        return targetDoc;
      }
      return d;
    });
    setDocs(updated);
    saveAllData({ docs: updated }, companyId);

    if (targetDoc && isSupabaseConfigured() && companyId) {
      saveEntryDocCloud(targetDoc, companyId).catch((err) =>
        console.warn('Supabase sync notice (unloaded):', err?.message || err)
      );
    }
  };

  const handleToggleInvoice = (id: string, paid: boolean) => {
    let targetDoc: EntryDoc | null = null;
    const updated = docs.map((d) => {
      if (d.id === id) {
        targetDoc = { ...d, invoicePaid: paid };
        return targetDoc;
      }
      return d;
    });
    setDocs(updated);
    saveAllData({ docs: updated }, companyId);

    if (targetDoc && isSupabaseConfigured() && companyId) {
      saveEntryDocCloud(targetDoc, companyId).catch((err) =>
        console.warn('Supabase sync notice (invoice):', err?.message || err)
      );
    }

    addToast(
      paid
        ? 'پرداخت صورت‌حساب ثبت شد — شماره قبض انبار فعال گردید'
        : 'پرداخت صورت‌حساب برداشته شد',
      'info'
    );
  };

  const handleUpdateReceipt = (id: string, number: string, count: string) => {
    if (number && docs.some((d) => d.id !== id && d.receipt.number === number)) {
      addToast('این شماره قبض انبار قبلاً برای سند دیگری ثبت شده است', 'err');
      return;
    }

    let targetDoc: EntryDoc | null = null;
    const updated = docs.map((d) => {
      if (d.id === id) {
        targetDoc = { ...d, receipt: { number, count } };
        return targetDoc;
      }
      return d;
    });
    setDocs(updated);
    saveAllData({ docs: updated }, companyId);

    if (targetDoc && isSupabaseConfigured() && companyId) {
      saveEntryDocCloud(targetDoc, companyId).catch((err) =>
        console.warn('Supabase sync notice (receipt):', err?.message || err)
      );
    }
  };

  const handleToggleTask = (id: string, taskKey: 'bl' | 'arr' | 'tali') => {
    let targetDoc: EntryDoc | null = null;
    const updated = docs.map((d) => {
      if (d.id === id) {
        targetDoc = {
          ...d,
          tasks: { ...d.tasks, [taskKey]: !d.tasks[taskKey] },
        };
        return targetDoc;
      }
      return d;
    });
    setDocs(updated);
    saveAllData({ docs: updated }, companyId);

    if (targetDoc && isSupabaseConfigured() && companyId) {
      saveEntryDocCloud(targetDoc, companyId).catch((err) =>
        console.warn('Supabase sync notice (task):', err?.message || err)
      );
    }
  };

  const handleMarkDocComplete = (id: string) => {
    if (!enableImport || !activePermissions.canEditEntry) {
      addToast('تغییر وضعیت سند توسط مدیریت سیستم محدود شده است.', 'err');
      return;
    }

    let targetDoc: EntryDoc | null = null;
    const updated = docs.map((d) => {
      if (d.id === id) {
        targetDoc = {
          ...d,
          unloaded: d.trailers,
          invoicePaid: true,
          receipt: {
            number: d.receipt?.number || `QB-${d.cottage}`,
            count: d.receipt?.count || String(d.pallets || 1),
          },
          tasks: { bl: true, arr: true, tali: true },
        };
        return targetDoc;
      }
      return d;
    });
    setDocs(updated);
    saveAllData({ docs: updated }, companyId);

    if (targetDoc && isSupabaseConfigured() && companyId) {
      saveEntryDocCloud(targetDoc, companyId).catch((err) =>
        console.warn('Supabase sync notice (markComplete):', err?.message || err)
      );
    }
  };

  // Seed comprehensive intelligent test data covering all custom edge cases & workflow stages
  const handleSeedEntryDemo = () => {
    const t = todayJ();

    // 1. Define distinct test file numbers and multi-cottage entry docs
    const doc1Id = uid();
    const doc2Id = uid();
    const doc3Id = uid();
    const doc4Id = uid();
    const doc5Id = uid();

    const sampleDocs: EntryDoc[] = [
      // File 405101: Multi-Cottage File (Cottages 1, 2, 3)
      {
        id: doc1Id,
        cottage: '1402234',
        bl: 'SEETEC05022',
        file: '405101',
        importer: 'شرکت بازرگانی آریا تجارت',
        carrier: 'پارسیان حمل',
        goods: 'ام دی اف 1830*3800*16',
        brand: 'کرونوسپان',
        unloadDate: { jy: t.jy, jm: t.jm, jd: Math.max(1, t.jd - 4) },
        trailers: 5,
        unloaded: 5,
        pallets: 42,
        invoicePaid: true,
        receipt: { number: '20581', count: '420' },
        tasks: { bl: true, arr: true, tali: true },
        createdAt: Date.now() - 360000000,
      },
      {
        id: doc2Id,
        cottage: '1402235',
        bl: 'SEETEC05023',
        file: '405101', // Same file number for multi-cottage testing!
        importer: 'شرکت بازرگانی آریا تجارت',
        carrier: 'پارسیان حمل',
        goods: 'ام دی اف 1830*3800*16',
        brand: 'کرونوسپان',
        unloadDate: { jy: t.jy, jm: t.jm, jd: Math.max(1, t.jd - 3) },
        trailers: 4,
        unloaded: 4,
        pallets: 36,
        invoicePaid: true,
        receipt: { number: '20582', count: '360' },
        tasks: { bl: true, arr: true, tali: true },
        createdAt: Date.now() - 280000000,
      },
      {
        id: doc3Id,
        cottage: '1402236',
        bl: 'SEETEC05024',
        file: '405101', // Third cottage under same file number!
        importer: 'شرکت بازرگانی آریا تجارت',
        carrier: 'پارسیان حمل',
        goods: 'ام دی اف 1830*3800*16',
        brand: 'کرونوسپان',
        unloadDate: { jy: t.jy, jm: t.jm, jd: Math.max(1, t.jd - 1) },
        trailers: 6,
        unloaded: 3, // In discharging stage (3 out of 6)
        pallets: 25,
        invoicePaid: false,
        receipt: { number: '', count: '' },
        tasks: { bl: true, arr: false, tali: false },
        createdAt: Date.now() - 100000000,
      },

      // File 405202: Second File (Single Cottage, Yellow Route)
      {
        id: doc4Id,
        cottage: '1403112',
        bl: 'SEETEC06119',
        file: '405202',
        importer: 'صنایع چوب و فولاد نوین',
        carrier: 'باربری نوین',
        goods: 'چسب کاشی',
        brand: 'پارس چسب',
        unloadDate: { jy: t.jy, jm: t.jm, jd: Math.max(1, t.jd - 2) },
        trailers: 6,
        unloaded: 6,
        pallets: 28,
        invoicePaid: true,
        receipt: { number: '20590', count: '280' },
        tasks: { bl: true, arr: true, tali: false },
        createdAt: Date.now() - 180000000,
      },

      // File 405303: Third File (Newly Arrived)
      {
        id: doc5Id,
        cottage: '1404008',
        bl: 'SEETEC07200',
        file: '405303',
        importer: 'گروه صنعتی پارسیان',
        carrier: 'دریا طلایی خلیج فارس',
        goods: 'روکش پی‌وی‌سی',
        brand: 'ایزوفام',
        unloadDate: { jy: t.jy, jm: t.jm, jd: t.jd },
        trailers: 3,
        unloaded: 1,
        pallets: 15,
        invoicePaid: false,
        receipt: { number: '', count: '' },
        tasks: { bl: false, arr: false, tali: false },
        createdAt: Date.now() - 50000000,
      },
    ];

    // 2. Consolidation Batch under File 405101
    const batchId = 'SEETEC05022COMB1001';
    const sampleBatches: Batch[] = [
      {
        id: batchId,
        goods: 'ام دی اف 1830*3800*16',
        file: '405101',
        createdAt: { jy: t.jy, jm: t.jm, jd: Math.max(1, t.jd - 2) },
        docIds: [doc1Id, doc2Id],
        finalized: true,
      },
    ];

    // 3. Exit Documents covering all exit workflow states
    const sampleExits: ExitDoc[] = [
      // Exit Doc 1: Fully closed & exited (Red Route, Lab Tested & Approved, Paid, Gate Exited)
      {
        id: uid(),
        cottage: '1402234',
        bl: 'SEETEC05022',
        file: '405101',
        unloadDate: t,
        importer: 'شرکت بازرگانی آریا تجارت',
        carrier: 'پارسیان حمل',
        goods: 'ام دی اف 1830*3800*16',
        brand: 'کرونوسپان',
        trailers: 9,
        pallets: 72,
        batchId: batchId,
        route: 'red',
        partialExit: {
          isPartial: true,
          exitPercent: 90,
          exitPallets: 72,
          remainingPercent: 10,
          remainingPallets: 8,
          totalPallets: 80,
        },
        evaluator: { done: true, comment: 'ارزیابی فیزیکی کالا با موفقیت تایید شد' },
        jihad: { done: true, comment: 'مجوز جهاد کشاورزی صادر گردید' },
        lab: {
          needed: true,
          sampled: true,
          sampleDate: t,
          sent: true,
          tested: true,
          comment: 'نتیجه آزمایشگاه: استاندارد و فاقد آلودگی (تایید نهایی)',
          reusedFrom: null,
          recordId: 'lab-rec-1',
          validity: 6,
        },
        expert: { done: true },
        gate: { done: true },
        invoice: { paid: true },
        createdAt: Date.now() - 36000000,
      },

      // Exit Doc 2: Yellow Route, Lab not needed, Pending payment at gate
      {
        id: uid(),
        cottage: '1403112',
        bl: 'SEETEC06119',
        file: '405202',
        unloadDate: t,
        importer: 'صنایع چوب و فولاد نوین',
        carrier: 'باربری نوین',
        goods: 'چسب کاشی',
        brand: 'پارس چسب',
        trailers: 6,
        pallets: 28,
        batchId: null,
        route: 'yellow',
        evaluator: { done: true, comment: 'بررسی اسنادی انجام شد' },
        jihad: { done: true, comment: 'استعلام سیستم تایید شد' },
        lab: {
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
        expert: { done: true },
        gate: { done: false },
        invoice: { paid: false },
        createdAt: Date.now() - 18000000,
      },

      // Exit Doc 3: Red Route, Lab testing in progress
      {
        id: uid(),
        cottage: '1404008',
        bl: 'SEETEC07200',
        file: '405303',
        unloadDate: t,
        importer: 'گروه صنعتی پارسیان',
        carrier: 'دریا طلایی خلیج فارس',
        goods: 'روکش پی‌وی‌سی',
        brand: 'ایزوفام',
        trailers: 3,
        pallets: 15,
        batchId: null,
        route: 'red',
        evaluator: { done: false, comment: '' },
        jihad: { done: false, comment: '' },
        lab: {
          needed: true,
          sampled: true,
          sampleDate: t,
          sent: true,
          tested: false,
          comment: 'نمونه به آزمایشگاه ارسال شده و در دست بررسی است',
          reusedFrom: null,
          recordId: null,
          validity: 6,
        },
        expert: { done: false },
        gate: { done: false },
        invoice: { paid: false },
        createdAt: Date.now() - 3600000,
      },
    ];

    // 4. Lab Record
    const sampleLabRecords: LabRecord[] = [
      {
        id: 'lab-rec-1',
        goods: 'ام دی اف 1830*3800*16',
        brand: 'کرونوسپان',
        sampleDate: t,
        validity: 6,
        comment: 'نتیجه آزمایشگاه: مطابق با استانداردهای گمرک و بهداشت',
        exitId: sampleExits[0].id,
        createdAt: Date.now() - 36000000,
      },
    ];

    // 5. Update state and dropdown option lists
    const newImporters = Array.from(
      new Set([...importers, 'شرکت بازرگانی آریا تجارت', 'صنایع چوب و فولاد نوین', 'گروه صنعتی پارسیان'])
    );
    const newCarriers = Array.from(
      new Set([...carriers, 'پارسیان حمل', 'باربری نوین', 'دریا طلایی خلیج فارس'])
    );
    const newGoods = Array.from(
      new Set([...goodsList, 'ام دی اف 1830*3800*16', 'چسب کاشی', 'روکش پی‌وی‌سی'])
    );
    const newBrands = Array.from(
      new Set([...brands, 'کرونوسپان', 'پارس چسب', 'ایزوفام'])
    );

    // Merge non-duplicate docs
    const existingCottages = new Set(docs.map((d) => d.cottage));
    const docsToAdd = sampleDocs.filter((d) => !existingCottages.has(d.cottage));

    const updatedDocs = [...docsToAdd, ...docs];
    const updatedBatches = [...sampleBatches, ...batches];
    const updatedExits = [...sampleExits, ...exits];
    const updatedLabRecords = [...sampleLabRecords, ...labRecords];

    setDocs(updatedDocs);
    setBatches(updatedBatches);
    setExits(updatedExits);
    setLabRecords(updatedLabRecords);

    setImporters(newImporters);
    setCarriers(newCarriers);
    setGoodsList(newGoods);
    setBrands(newBrands);

    saveAllData(
      {
        docs: updatedDocs,
        batches: updatedBatches,
        exits: updatedExits,
        labRecords: updatedLabRecords,
        importers: newImporters,
        carriers: newCarriers,
        goodsList: newGoods,
        brands: newBrands,
      },
      companyId
    );

    addToast(
      'سناریوی جامع تست شامل پرونده‌های چند کوتاژی، مراحل ورود، تجمیع و خروج با موفقیت ثبت شد',
      'ok'
    );
  };

  // Consolidation Actions (tenant-scoped + Import module gated)
  const handleCreateBatch = (
    batchId: string,
    docIds: string[],
    goods: string,
    file: string
  ) => {
    if (!enableImport || userRole === 'viewer' || !activePermissions.canCreateBatch) {
      addToast('شما دسترسی ایجاد تجمیع را ندارید.', 'err');
      return;
    }

    const newBatch: Batch = {
      id: batchId,
      goods,
      file,
      createdAt: todayJ(),
      docIds,
      finalized: false,
    };
    const updatedBatches = [...batches, newBatch];
    setBatches(updatedBatches);
    saveAllData({ batches: updatedBatches }, companyId);

    if (isSupabaseConfigured() && companyId) {
      saveBatchCloud(newBatch, companyId).catch((err) =>
        console.warn('Supabase sync notice (batch):', err?.message || err)
      );
    }

    logSecurityEvent({
      type: 'doc_created',
      user: currentUser || 'مدیر',
      role: userRole,
      description: `تجمیع جدید با شناسه ${fa(batchId)} ثبت شد`,
      severity: 'info',
    });

    addToast(`تجمیع ${fa(batchId)} با ${fa(docIds.length)} سند ثبت شد`, 'ok');
  };

  const handleFinalizeBatch = (batchId: string) => {
    if (!enableImport || userRole === 'viewer' || !activePermissions.canCreateBatch) {
      addToast('شما دسترسی نهایی‌سازی تجمیع را ندارید.', 'err');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'نهایی کردن تجمیع',
      text: 'پس از نهایی شدن، همه اسناد این تجمیع در وضعیت «آماده خروج» قرار می‌گیرند و قابل خروج می‌شوند.',
      action: () => {
        let updatedBatch: Batch | null = null;
        const updated = batches.map((b) => {
          if (b.id === batchId) {
            updatedBatch = { ...b, finalized: true };
            return updatedBatch;
          }
          return b;
        });
        setBatches(updated);
        saveAllData({ batches: updated }, companyId);

        if (updatedBatch && isSupabaseConfigured() && companyId) {
          saveBatchCloud(updatedBatch, companyId).catch((err) =>
            console.warn('Supabase sync notice (finalize batch):', err?.message || err)
          );
        }

        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        addToast(`تجمیع ${fa(batchId)} نهایی شد`, 'ok');
      },
    });
  };

  const handleDeleteBatch = (batchId: string) => {
    if (!enableImport) return;
    const targetBatch = batches.find((b) => String(b.id) === String(batchId));
    const linkedExitsCount = exits.filter((x) => String(x.batchId || '') === String(batchId)).length;

    requestProtectedDelete(
      `حذف تجمیع ${fa(batchId)}`,
      targetBatch?.finalized
        ? linkedExitsCount > 0
          ? `این تجمیع نهایی‌شده حذف می‌شود، اسناد ورودی آن مجدداً به وضعیت «کامل» بازمی‌گردند و اتصال ${fa(linkedExitsCount)} سند خروج مرتبط بازنشانی خواهد شد.`
          : 'این تجمیع نهایی‌شده حذف می‌شود و اسناد ورودی عضو آن مجدداً به وضعیت «کامل» بازمی‌گردند.'
        : 'این تجمیع حذف می‌شود و اسناد آن دوباره به وضعیت «کامل» باز می‌گردند.',
      () => {
        const updatedBatches = batches.filter((b) => String(b.id) !== String(batchId));
        setBatches(updatedBatches);

        let updatedExits = exits;
        const touchedExits: ExitDoc[] = [];
        if (linkedExitsCount > 0) {
          updatedExits = exits.map((x) => {
            if (String(x.batchId || '') === String(batchId)) {
              const cleaned: ExitDoc = { ...x, batchId: null };
              touchedExits.push(cleaned);
              return cleaned;
            }
            return x;
          });
          setExits(updatedExits);
          saveAllData({ batches: updatedBatches, exits: updatedExits }, companyId);
        } else {
          saveAllData({ batches: updatedBatches }, companyId);
        }

        if (isSupabaseConfigured() && companyId) {
          deleteBatchCloud(batchId, companyId).catch((err) =>
            console.warn('Supabase sync notice (delete batch):', err?.message || err)
          );
          touchedExits.forEach((ex) => {
            saveExitDocCloud(ex, companyId).catch((err) =>
              console.warn('Supabase sync notice (unlink exit batch):', err?.message || err)
            );
          });
        }

        logSecurityEvent({
          type: 'doc_deleted',
          user: currentUser || 'مدیر',
          role: userRole,
          description: `تجمیع با شناسه ${fa(batchId)} حذف شد`,
          severity: 'warning',
        });

        addToast(`تجمیع ${fa(batchId)} با موفقیت حذف شد`, 'info');
      }
    );
  };

  // Exit Actions (tenant-scoped + Export module gated)
  const handleCreateOrUpdateExitDoc = (
    data: Omit<ExitDoc, 'id' | 'createdAt' | 'route' | 'evaluator' | 'jihad' | 'lab' | 'expert' | 'gate' | 'invoice'>
  ) => {
    if (!enableExport || userRole === 'viewer' || !activePermissions.canCreateExit) {
      addToast('شما مجوز ثبت یا ویرایش اسناد خروج را ندارید.', 'err');
      return;
    }

    if (editingExitDoc) {
      const updatedExitDoc: ExitDoc = {
        ...editingExitDoc,
        ...data,
      };
      const updated = exits.map((x) => (x.id === editingExitDoc.id ? updatedExitDoc : x));
      setExits(updated);
      saveAllData({ exits: updated }, companyId);
      setEditingExitDoc(null);

      if (isSupabaseConfigured() && companyId) {
        saveExitDocCloud(updatedExitDoc, companyId).catch((err) =>
          addToast(`خطا در ذخیره ابری خروج: ${err.message || ''}`, 'err')
        );
      }

      addToast('سند خروج بروزرسانی شد', 'ok');
    } else {
      const newExit: ExitDoc = {
        ...data,
        id: uid(),
        route: null,
        evaluator: { done: false, comment: '' },
        jihad: { done: false, comment: '' },
        lab: {
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
        expert: { done: false },
        gate: { done: false },
        invoice: { paid: false },
        createdAt: Date.now(),
      };
      const updated = [newExit, ...exits];
      setExits(updated);
      saveAllData({ exits: updated }, companyId);

      if (isSupabaseConfigured() && companyId) {
        saveExitDocCloud(newExit, companyId).catch((err) =>
          addToast(`خطا در ذخیره ابری خروج: ${err.message || ''}`, 'err')
        );
      }

      logSecurityEvent({
        type: 'doc_created',
        user: currentUser || 'مدیر',
        role: userRole,
        description: `سند خروج جدید کوتاژ ${fa(data.cottage)} ثبت شد`,
        severity: 'info',
      });

      addToast('سند خروج با موفقیت ثبت شد', 'ok');
    }
    setMobileExitMode('list');
  };

  const handleStartEditExit = (exitDoc: ExitDoc) => {
    if (!enableExport || userRole === 'viewer' || !activePermissions.canCreateExit) {
      addToast('شما دسترسی ویرایش اسناد خروج را ندارید.', 'err');
      return;
    }

    setEditingExitDoc(exitDoc);
    setMobileExitMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExit = (id: string) => {
    if (!enableExport) return;
    const targetExit = exits.find((x) => x.id === id);

    requestProtectedDelete(
      targetExit ? `حذف سند خروج کوتاژ ${fa(targetExit.cottage)}` : 'حذف سند خروج',
      'آیا از حذف این سند خروج اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
      () => {
        const updated = exits.filter((x) => x.id !== id);
        setExits(updated);
        saveAllData({ exits: updated }, companyId);

        if (isSupabaseConfigured() && companyId) {
          deleteExitDocCloud(id, companyId).catch((err) =>
            console.warn('Supabase sync notice (delete exit):', err?.message || err)
          );
        }

        logSecurityEvent({
          type: 'doc_deleted',
          user: currentUser || 'مدیر',
          role: userRole,
          description: `سند خروج با شناسه ${targetExit?.cottage || id} حذف شد`,
          severity: 'warning',
        });

        addToast('سند خروج حذف شد', 'info');
      }
    );
  };

  const handleUpdateExitDoc = (updatedDoc: ExitDoc) => {
    if (!enableExport || userRole === 'viewer' || !activePermissions.canUpdateExitStages) {
      addToast('شما دسترسی تغییر مراحل خروج را ندارید.', 'err');
      return;
    }

    const updated = exits.map((x) => (x.id === updatedDoc.id ? updatedDoc : x));
    setExits(updated);
    saveAllData({ exits: updated }, companyId);

    if (isSupabaseConfigured() && companyId) {
      saveExitDocCloud(updatedDoc, companyId).catch((err) =>
        console.warn('Supabase sync notice (update exit):', err?.message || err)
      );
    }
  };

  const handleAddLabRecord = (rec: LabRecord) => {
    if (!enableExport || userRole === 'viewer' || !activePermissions.canCreateLab) {
      addToast('شما دسترسی ثبت سوابق آزمایشگاه را ندارید.', 'err');
      return;
    }

    const updated = [...labRecords, rec];
    setLabRecords(updated);
    saveAllData({ labRecords: updated }, companyId);

    if (isSupabaseConfigured() && companyId) {
      saveLabRecordCloud(rec, companyId).catch((err) =>
        console.warn('Supabase sync notice (lab record):', err?.message || err)
      );
    }

    logSecurityEvent({
      type: 'doc_created',
      user: currentUser || 'مدیر',
      role: userRole,
      description: `سابقه آزمایشگاه برای کالا ${rec.goods} ثبت شد`,
      severity: 'info',
    });

    addToast('سابقه آزمایشگاه جدید ذخیره شد', 'ok');
  };

  const handleSeedExitDemo = () => {
    const t = todayJ();
    const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    let fins = batches.filter((b) => b.finalized);
    if (!fins.length) {
      addToast('ابتدا حداقل یک تجمیع نهایی‌شده ایجاد کنید', 'err');
      return;
    }

    const sampleImps = importers.length ? importers : DEFAULT_IMPORTERS;
    const sampleCars = carriers.length ? carriers : DEFAULT_CARRIERS;
    const sampleBrands = brands.length ? brands : DEFAULT_BRANDS;

    const newExits: ExitDoc[] = [];
    for (let i = 0; i < 5; i++) {
      const cottage = String(rand(1400000, 1409999));
      if (exits.some((x) => x.cottage === cottage)) continue;
      const bl = 'SEETEC' + String(rand(10000, 99999));
      if (exits.some((x) => x.bl === bl)) continue;
      const file = String(rand(405000, 405999));
      const batch = fins[rand(0, fins.length - 1)];

      newExits.push({
        id: uid(),
        cottage,
        bl,
        file,
        unloadDate: { jy: t.jy, jm: t.jm, jd: Math.min(t.jd, 28) },
        importer: sampleImps[rand(0, sampleImps.length - 1)],
        carrier: sampleCars[rand(0, sampleCars.length - 1)],
        goods: batch.goods,
        brand: sampleBrands[rand(0, sampleBrands.length - 1)],
        trailers: rand(2, 8),
        pallets: rand(10, 50),
        batchId: String(batch.id),
        route: Math.random() > 0.5 ? 'red' : 'yellow',
        evaluator: { done: Math.random() > 0.4, comment: 'تکمیل شد' },
        jihad: { done: Math.random() > 0.3, comment: 'مجوز جهاد صادر گردید' },
        lab: {
          needed: Math.random() > 0.3,
          sampled: true,
          sampleDate: t,
          sent: true,
          tested: Math.random() > 0.4,
          comment: 'تایید شد',
          reusedFrom: null,
          recordId: null,
          validity: 6,
        },
        expert: { done: Math.random() > 0.5 },
        gate: { done: Math.random() > 0.6 },
        invoice: { paid: Math.random() > 0.5 },
        createdAt: Date.now() - rand(0, 10) * 86400000,
      });
    }

    const updated = [...newExits, ...exits];
    setExits(updated);
    saveAllData({ exits: updated }, companyId);
    addToast('۵ سند خروج نمونه تصادفی ثبت شد', 'ok');
  };

  // =========================================================================
  // 90/10 CLEARANCE, PHYSICAL EXITS, NOTIFICATION CENTER & DAILY TASKS HANDLERS
  // =========================================================================

  const handleUpdateEntryClearanceDoc = (updatedDoc: EntryDoc, auditDesc?: string) => {
    const normalizedDoc: EntryDoc = {
      ...updatedDoc,
      clearance: normalizeEntryClearance(updatedDoc),
    };
    const updated = docs.map((d) => (d.id === normalizedDoc.id ? normalizedDoc : d));
    setDocs(updated);
    saveAllData({ docs: updated }, companyId);

    if (isSupabaseConfigured() && companyId) {
      saveEntryDocCloud(normalizedDoc, companyId).catch((err) =>
        addToast(`خطا در همگام‌سازی ترخیص ۹۰/۱۰: ${err?.message || ''}`, 'err')
      );
    }

    if (auditDesc) {
      logSecurityEvent({
        type: 'doc_created',
        user: activeOperatorLabel,
        role: userRole,
        description: auditDesc,
        severity: 'info',
      });
    }
  };

  const handleAddPhysicalExit = (tx: PhysicalExitTransaction) => {
    if (!enableExport) return;
    const updated = [tx, ...physicalExits];
    setPhysicalExits(updated);
    saveAllData({ physicalExits: updated }, companyId);

    if (isSupabaseConfigured() && companyId) {
      savePhysicalExitCloud(tx, companyId).catch((err) =>
        console.warn('Supabase sync notice (physical exit add):', err?.message || err)
      );
    }

    logSecurityEvent({
      type: 'doc_created',
      user: activeOperatorLabel,
      role: userRole,
      description: `خروج فیزیکی ${fa(tx.pallets)} پالت برای کوتاژ ${fa(tx.cottage)} (${tx.truckInfo || 'تریلی'}) ثبت شد`,
      severity: 'info',
    });
  };

  const handleUpdatePhysicalExit = (tx: PhysicalExitTransaction) => {
    if (!enableExport) return;
    const updated = physicalExits.map((p) => (p.id === tx.id ? tx : p));
    setPhysicalExits(updated);
    saveAllData({ physicalExits: updated }, companyId);

    if (isSupabaseConfigured() && companyId) {
      savePhysicalExitCloud(tx, companyId).catch((err) =>
        console.warn('Supabase sync notice (physical exit update):', err?.message || err)
      );
    }

    logSecurityEvent({
      type: 'doc_created',
      user: activeOperatorLabel,
      role: userRole,
      description: `تراکنش خروج فیزیکی کوتاژ ${fa(tx.cottage)} (${fa(tx.pallets)} پالت) ویرایش شد`,
      severity: 'warning',
    });
  };

  const handleDeletePhysicalExit = (id: string) => {
    if (!enableExport) return;
    const target = physicalExits.find((p) => p.id === id);
    requestProtectedDelete(
      'حذف تراکنش خروج فیزیکی',
      target
        ? `آیا از حذف تراکنش خروج فیزیکی کوتاژ ${fa(target.cottage)} (${fa(target.pallets)} پالت · ${target.truckInfo}) اطمینان دارید؟`
        : 'آیا از حذف این تراکنش خروج فیزیکی اطمینان دارید؟',
      () => {
        const updated = physicalExits.filter((p) => p.id !== id);
        setPhysicalExits(updated);
        saveAllData({ physicalExits: updated }, companyId);

        if (isSupabaseConfigured() && companyId) {
          deletePhysicalExitCloud(id, companyId).catch((err) =>
            console.warn('Supabase sync notice (physical exit delete):', err?.message || err)
          );
        }

        if (target) {
          logSecurityEvent({
            type: 'doc_deleted',
            user: activeOperatorLabel,
            role: userRole,
            description: `تراکنش خروج فیزیکی کوتاژ ${fa(target.cottage)} (${fa(target.pallets)} پالت) حذف شد`,
            severity: 'warning',
          });
        }

        addToast('تراکنش خروج فیزیکی حذف شد و موجودی پالت‌ها بروزرسانی گردید.', 'info');
      }
    );
  };

  const handleAddDailyTask = (task: DailyTask) => {
    const updated = [task, ...dailyTasks];
    setDailyTasks(updated);
    saveAllData({ dailyTasks: updated }, companyId);
    if (isSupabaseConfigured() && companyId) {
      saveDailyTaskCloud(task, companyId).catch((err) =>
        console.warn('Supabase sync notice (add task):', err?.message || err)
      );
    }
    addToast('کار جدید با موفقیت ثبت شد', 'ok');
  };

  const handleUpdateDailyTask = (task: DailyTask) => {
    const updated = dailyTasks.map((t) => (t.id === task.id ? task : t));
    setDailyTasks(updated);
    saveAllData({ dailyTasks: updated }, companyId);
    if (isSupabaseConfigured() && companyId) {
      saveDailyTaskCloud(task, companyId).catch((err) =>
        console.warn('Supabase sync notice (update task):', err?.message || err)
      );
    }
  };

  const handleDeleteDailyTask = (id: string) => {
    const targetTask = dailyTasks.find((t) => t.id === id);
    requestProtectedDelete(
      'حذف کار روزانه',
      targetTask
        ? `آیا از حذف کار «${targetTask.title}» اطمینان دارید؟`
        : 'آیا از حذف این کار اطمینان دارید؟',
      () => {
        const updated = dailyTasks.filter((t) => t.id !== id);
        setDailyTasks(updated);
        saveAllData({ dailyTasks: updated }, companyId);
        if (isSupabaseConfigured() && companyId) {
          deleteDailyTaskCloud(id, companyId).catch((err) =>
            console.warn('Supabase sync notice (delete task):', err?.message || err)
          );
        }
        addToast('کار حذف شد', 'info');
      }
    );
  };

  // Smart Auto Follow-up Task Generation (deduplicated by autoSourceKey)
  useEffect(() => {
    if (!dataLoadedRef.current || !companyId) return;
    if (docs.length === 0 && labRecords.length === 0) return;

    const generated = generateAutoFollowUpTasks({
      docs,
      labRecords,
      physicalExits,
      existingTasks: dailyTasks,
      defaultAssignee: activeOperatorLabel,
    });

    if (generated.length > 0) {
      const merged = [...generated, ...dailyTasks];
      setDailyTasks(merged);
      saveAllData({ dailyTasks: merged }, companyId);
      if (isSupabaseConfigured() && companyId) {
        generated.forEach((task) => {
          saveDailyTaskCloud(task, companyId).catch(() => {});
        });
      }
    }
  }, [docs, exits, labRecords, physicalExits, companyId]);

  // Real-Time Deduplicated Notification Engine
  const notifications = React.useMemo<AppNotification[]>(() => {
    return generateNotifications({
      docs,
      exits,
      labRecords,
      physicalExits,
      tasks: dailyTasks,
      notificationStates,
    });
  }, [docs, exits, labRecords, physicalExits, dailyTasks, notificationStates]);

  const unreadNotificationsCount = React.useMemo(
    () => notifications.filter((n) => !n.archived && !n.read).length,
    [notifications]
  );

  const pendingTasksCount = React.useMemo(
    () => dailyTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length,
    [dailyTasks]
  );

  const overdueTasksCount = React.useMemo(
    () => dailyTasks.filter((t) => matchesTaskView(t, 'overdue')).length,
    [dailyTasks]
  );

  const upsertNotificationStates = (nextStates: NotificationStateRecord[]) => {
    setNotificationStates(nextStates);
    saveAllData({ notificationStates: nextStates }, companyId);
    if (isSupabaseConfigured() && companyId) {
      saveNotificationStatesCloud(nextStates, companyId).catch((err) =>
        console.warn('Supabase sync notice (notifications):', err?.message || err)
      );
    }
  };

  const handleMarkNotificationRead = (dedupeKey: string) => {
    const existing = notificationStates.find((s) => s.dedupeKey === dedupeKey);
    const updatedRec: NotificationStateRecord = {
      dedupeKey,
      read: true,
      archived: existing?.archived || false,
      readAt: Date.now(),
      archivedAt: existing?.archivedAt,
    };
    const next = existing
      ? notificationStates.map((s) => (s.dedupeKey === dedupeKey ? updatedRec : s))
      : [...notificationStates, updatedRec];
    upsertNotificationStates(next);
  };

  const handleMarkAllNotificationsRead = () => {
    const stateMap = new Map<string, NotificationStateRecord>();
    notificationStates.forEach((s) => stateMap.set(s.dedupeKey, s));
    const now = Date.now();
    notifications.forEach((n) => {
      if (!n.archived) {
        const prev = stateMap.get(n.dedupeKey);
        stateMap.set(n.dedupeKey, {
          dedupeKey: n.dedupeKey,
          read: true,
          archived: prev?.archived || false,
          readAt: prev?.readAt || now,
          archivedAt: prev?.archivedAt,
        });
      }
    });
    upsertNotificationStates(Array.from(stateMap.values()));
    addToast('همه اعلان‌ها به عنوان خوانده‌شده علامت خوردند', 'ok');
  };

  const handleToggleNotificationArchive = (dedupeKey: string, archived: boolean) => {
    const existing = notificationStates.find((s) => s.dedupeKey === dedupeKey);
    const updatedRec: NotificationStateRecord = {
      dedupeKey,
      read: existing?.read || true,
      archived,
      readAt: existing?.readAt || Date.now(),
      archivedAt: archived ? Date.now() : undefined,
    };
    const next = existing
      ? notificationStates.map((s) => (s.dedupeKey === dedupeKey ? updatedRec : s))
      : [...notificationStates, updatedRec];
    upsertNotificationStates(next);
  };

  const handleNavigateToEntryDoc = (entryDocId: string) => {
    setMainTab('entry');
    setEntrySubTab('docs');
    setEntrySearch('');
    setEntryFilter('all');
    setMobileEntryMode('list');
    setHighlightedEntryId(entryDocId);
    setTimeout(() => {
      const el = document.getElementById(`entry-card-${entryDocId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    setTimeout(() => setHighlightedEntryId(null), 4000);
  };

  const handleNavigateToExitDoc = (exitDocId: string) => {
    setMainTab('exit');
    setExitSubTab('docs');
    setExitSearch('');
    setExitFilter('all');
    setMobileExitMode('list');
    setHighlightedExitId(exitDocId);
    setTimeout(() => {
      const el = document.getElementById(`exit-card-${exitDocId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    setTimeout(() => setHighlightedExitId(null), 4000);
  };

  const handleNavigateFromNotification = (notif: AppNotification) => {
    handleMarkNotificationRead(notif.dedupeKey);
    setIsNotificationDrawerOpen(false);

    if (notif.relatedRecordType === 'task') {
      setIsDailyTasksDrawerOpen(true);
      return;
    }
    if (notif.relatedRecordType === 'lab') {
      setMainTab('exit');
      setExitSubTab('lab');
      return;
    }
    if (notif.relatedRecordType === 'exit' && notif.relatedRecordId) {
      handleNavigateToExitDoc(notif.relatedRecordId);
      return;
    }
    if (notif.relatedRecordType === 'entry' && notif.relatedRecordId) {
      const open9010Categories: AppNotification['category'][] = [
        'remaining_10_awaiting_sata',
        'sata_received_unconfirmed',
        'cleared_not_exited',
        'remaining_pallets_followup',
        'overdue_clearance',
      ];
      if (open9010Categories.includes(notif.category)) {
        const linkedExit = exits.find(
          (x) => x.entryDocId === notif.relatedRecordId || (x.cottage && x.cottage === notif.cottage)
        );
        if (linkedExit) {
          handleNavigateToExitDoc(linkedExit.id);
        } else {
          setMainTab('exit');
          setExitSubTab('docs');
          setMobileExitMode('list');
        }
        setTimeout(() => setClearanceDrawerDocId(notif.relatedRecordId || null), 220);
      } else {
        handleNavigateToEntryDoc(notif.relatedRecordId);
      }
    }
  };

  const clearanceDrawerDoc = React.useMemo(
    () => (clearanceDrawerDocId ? docs.find((d) => d.id === clearanceDrawerDocId) || null : null),
    [clearanceDrawerDocId, docs]
  );

  // Filtered lists
  const filteredEntryDocs = docs
    .filter((d) => {
      if (entryFilter === 'all') return true;
      const s = getStageOfDoc(d);
      if (entryFilter === '23') return s === 2 || s === 3;
      return s === parseInt(entryFilter, 10);
    })
    .filter((d) => {
      if (!entryStartDate && !entryEndDate) return true;
      if (!d.unloadDate) return false;
      const docDay = j2d(d.unloadDate.jy, d.unloadDate.jm, d.unloadDate.jd);
      if (entryStartDate) {
        const startDay = j2d(entryStartDate.jy, entryStartDate.jm, entryStartDate.jd);
        if (docDay < startDay) return false;
      }
      if (entryEndDate) {
        const endDay = j2d(entryEndDate.jy, entryEndDate.jm, entryEndDate.jd);
        if (docDay > endDay) return false;
      }
      return true;
    })
    .filter((d) => {
      if (!entrySearch.trim()) return true;
      const q = en(entrySearch.trim().toLowerCase());
      return [
        d.cottage,
        d.bl,
        d.file,
        d.importer,
        d.carrier,
        d.goods,
        d.brand,
        d.receipt.number,
      ].some((val) => en(String(val || '').toLowerCase()).includes(q));
    });

  const filteredExits = exits
    .filter((x) => {
      if (exitFilter === 'all') return true;
      const gateDone = x.gate.done;
      const isClosed = x.invoice.paid && gateDone;
      if (exitFilter === 'progress') return !isClosed;
      if (exitFilter === 'gate') return gateDone && !isClosed;
      if (exitFilter === 'done') return isClosed;
      return true;
    })
    .filter((x) => {
      if (!exitStartDate && !exitEndDate) return true;
      if (!x.unloadDate) return false;
      const docDay = j2d(x.unloadDate.jy, x.unloadDate.jm, x.unloadDate.jd);
      if (exitStartDate) {
        const startDay = j2d(exitStartDate.jy, exitStartDate.jm, exitStartDate.jd);
        if (docDay < startDay) return false;
      }
      if (exitEndDate) {
        const endDay = j2d(exitEndDate.jy, exitEndDate.jm, exitEndDate.jd);
        if (docDay > endDay) return false;
      }
      return true;
    })
    .filter((x) => {
      if (!exitSearch.trim()) return true;
      const q = en(exitSearch.trim().toLowerCase());
      return [
        x.cottage,
        x.bl,
        x.file,
        x.importer,
        x.carrier,
        x.goods,
        x.brand,
        x.batchId,
      ].some((val) => en(String(val || '').toLowerCase()).includes(q));
    });

  // Require PWA install on mobile web browsers unless running in preview bypass mode
  if (device.deviceType === 'mobile' && !device.isStandalone && !previewBypassed) {
    return (
      <>
        <OfflineIndicator />
        <PWAInstallGate device={device} onBypassPreview={handleBypassPreview} />
      </>
    );
  }

  // Checking existing Supabase Auth session & workspace membership
  if (authView === 'checking') {
    return (
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-[#050a14] text-slate-200 font-vazir dir-rtl"
        dir="rtl"
      >
        <OfflineIndicator />
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shadow-lg shadow-cyan-500/15">
          <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-lalezar text-xl text-white">در حال بارگذاری فضای کاری شرکت...</p>
          <p className="text-xs text-slate-400">بررسی نشست احراز هویت و مجوزهای دسترسی</p>
        </div>
      </div>
    );
  }

  // Render Multi-Step Company Onboarding / Restart / Legacy Claim Wizard
  if (authView === 'onboarding') {
    return (
      <>
        <OfflineIndicator />
        <CompanyOnboardingWizard
          mode={onboardingMode}
          initialCompany={onboardingMode === 'restart' ? workspace?.company || null : null}
          initialRoles={onboardingMode === 'restart' ? wizardRoles : []}
          existingMembers={onboardingMode === 'restart' ? wizardMembers : []}
          currentOwner={onboardingMode === 'restart' ? workspace?.member || null : null}
          onCancel={() => {
            if (onboardingMode === 'restart' && workspace?.company.onboardingCompleted) {
              setAuthView('ready');
            } else {
              setAuthView('login');
            }
          }}
          onComplete={async (res) => {
            setSelectedCompanyId(res.company.id);
            setAuthView('checking');
            await refreshWorkspace(res.company.id);
            addToast(
              onboardingMode === 'restart'
                ? 'پیکربندی شرکت با موفقیت بروزرسانی شد.'
                : `فضای کاری شرکت «${res.company.name}» با موفقیت راه‌اندازی شد.`,
              'ok'
            );
          }}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  // Render Login Gate if not authenticated or during logout animation
  if (!isAuthenticated || isLoggingOut) {
    return (
      <>
        <OfflineIndicator />
        <LoginGate
          onSuccess={handleLoginSuccess}
          onStartOnboarding={handleStartOnboarding}
          isLoggingOut={isLoggingOut}
          onLogoutComplete={handleLogoutComplete}
          externalError={authExternalError}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-transparent text-[#f1f5f9] pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-24 relative overflow-x-clip selection:bg-cyan-500/30">
      <OfflineIndicator />

      {/* Top Bar (Desktop full toolbar; Mobile slim title-only header) */}
      <Navbar
        onLogout={handleLogout}
        onClearAllData={handleClearAllData}
        onOpenCloudDb={activePermissions.canAccessCloudDb ? () => setIsCloudDbModalOpen(true) : undefined}
        onManualSync={activePermissions.canAccessCloudDb ? handleManualCloudSync : undefined}
        onOpenSummaryModal={activePermissions.canViewSummaryModal ? () => setIsSummaryModalOpen(true) : undefined}
        onOpenSecurityCenter={() => setIsSecurityModalOpen(true)}
        onOpenCompanySettings={canOpenCompanySettings ? () => setIsCompanySettingsOpen(true) : undefined}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenDailyTasks={() => setIsDailyTasksDrawerOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        pendingTasksCount={pendingTasksCount}
        overdueTasksCount={overdueTasksCount}
        company={company}
        member={workspace?.member || null}
        roleName={workspace?.role.name}
        allMemberships={workspace?.allMemberships || []}
        onSwitchCompany={handleSwitchCompany}
        lastCloudSyncTime={lastCloudSyncTime}
        isCloudSyncing={isCloudSyncing}
      />

      {/* Tabs Navigation - Desktop & Tablet Floating Glass Capsule Dock (mobile uses MobileBottomNav) */}
      <nav className="hidden md:block relative z-10 max-w-[1460px] mx-auto px-3 sm:px-6 pt-3 sm:pt-5">
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/8">
          <div className="w-full sm:w-auto ios-glass-pill p-1.5 sm:p-2 rounded-2xl sm:rounded-full grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-1.5 sm:gap-2">
            {/* Section 1: ورود کالا (Import Module) */}
            {enableImport && activePermissions.canViewEntry && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setMainTab('entry')}
                className={`relative min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full font-bold transition-colors duration-200 cursor-pointer ${
                  mainTab === 'entry'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {mainTab === 'entry' && (
                  <motion.div
                    layoutId="mainTabIndicator"
                    className="absolute inset-0 rounded-xl sm:rounded-full bg-gradient-to-b from-cyan-400/35 via-cyan-500/20 to-transparent border border-cyan-300/60"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                  />
                )}
                <div className={`relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors ${
                  mainTab === 'entry' ? 'bg-cyan-400/25 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.6)]' : 'bg-white/5 text-slate-400'
                }`}>
                  <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                </div>
                <span className="relative z-10 font-lalezar text-xs sm:text-sm md:text-base tracking-wide whitespace-nowrap drop-shadow-xs">
                  ورود کالا
                </span>
                <span className={`relative z-10 hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                  mainTab === 'entry'
                    ? 'bg-cyan-400/20 border-cyan-400/50 text-cyan-200 shadow-xs'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}>
                  {fa(docs.length)}
                </span>
              </motion.button>
            )}

            {/* Section 2: خروج کالا (Export Module) */}
            {enableExport && activePermissions.canViewExit && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setMainTab('exit')}
                className={`relative min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full font-bold transition-colors duration-200 cursor-pointer ${
                  mainTab === 'exit'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {mainTab === 'exit' && (
                  <motion.div
                    layoutId="mainTabIndicator"
                    className="absolute inset-0 rounded-xl sm:rounded-full bg-gradient-to-b from-blue-500/35 via-indigo-500/20 to-transparent border border-blue-400/60"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                  />
                )}
                <div className={`relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors ${
                  mainTab === 'exit' ? 'bg-blue-500/25 text-blue-200' : 'bg-white/5 text-slate-400'
                }`}>
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                </div>
                <span className="relative z-10 font-lalezar text-xs sm:text-sm md:text-base tracking-wide whitespace-nowrap">
                  خروج کالا
                </span>
                <span className={`relative z-10 hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                  mainTab === 'exit'
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-200'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}>
                  {fa(exits.length)}
                </span>
              </motion.button>
            )}

            {/* Section 3: گزارش‌گیری */}
            {activePermissions.canViewReports && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setMainTab('reports')}
                className={`relative min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full font-bold transition-colors duration-200 cursor-pointer ${
                  mainTab === 'reports'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {mainTab === 'reports' && (
                  <motion.div
                    layoutId="mainTabIndicator"
                    className="absolute inset-0 rounded-xl sm:rounded-full bg-gradient-to-b from-emerald-500/35 via-teal-500/20 to-transparent border border-emerald-400/60"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                  />
                )}
                <div className={`relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors ${
                  mainTab === 'reports' ? 'bg-emerald-500/25 text-emerald-200' : 'bg-white/5 text-slate-400'
                }`}>
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                </div>
                <span className="relative z-10 font-lalezar text-xs sm:text-sm md:text-base tracking-wide whitespace-nowrap">
                  گزارش‌گیری
                </span>
                <span className={`relative z-10 hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                  mainTab === 'reports'
                    ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}>
                  تحلیلی
                </span>
              </motion.button>
            )}

            {/* Section 4: بانک نامه‌ها و الگوهای گمرکی */}
            {activePermissions.canViewLetters !== false && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setMainTab('letters')}
                className={`relative min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full font-bold transition-colors duration-200 cursor-pointer ${
                  mainTab === 'letters'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {mainTab === 'letters' && (
                  <motion.div
                    layoutId="mainTabIndicator"
                    className="absolute inset-0 rounded-xl sm:rounded-full bg-gradient-to-b from-amber-500/35 via-orange-500/20 to-transparent border border-amber-400/60"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                  />
                )}
                <div className={`relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors ${
                  mainTab === 'letters' ? 'bg-amber-500/25 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.6)]' : 'bg-white/5 text-slate-400'
                }`}>
                  <FileSignature className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                </div>
                <span className="relative z-10 font-lalezar text-xs sm:text-sm md:text-base tracking-wide whitespace-nowrap drop-shadow-xs">
                  آرشیو تصاویر نامه‌ها
                </span>
                <span className={`relative z-10 hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                  mainTab === 'letters'
                    ? 'bg-amber-500/25 border-amber-400/50 text-amber-200 shadow-xs'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}>
                  تصاویر و جستجو
                </span>
              </motion.button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area (no z-index stacking trap so child modals/lightboxes paint above bars) */}
      <main className="relative max-w-[1460px] mx-auto px-3 sm:px-6 pt-3 sm:pt-5 md:pt-6">
        <AnimatePresence mode="wait">
          {/* SECTION 1: GOODS ENTRY (ورود کالا - Import Module) */}
          {mainTab === 'entry' && enableImport && activePermissions.canViewEntry && (
            <motion.div
              key="main-tab-entry"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="space-y-5 sm:space-y-6"
            >
              {/* Sub-Tabs for Goods Entry */}
              <div className="flex items-center gap-1.5 sm:gap-2 ios-glass-pill p-1.5 rounded-full w-fit max-w-full overflow-x-auto no-scrollbar">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setEntrySubTab('docs')}
                  className={`min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shrink-0 transition-colors ${
                    entrySubTab === 'docs'
                      ? 'bg-gradient-to-b from-cyan-400/30 to-cyan-500/15 text-cyan-200 border border-cyan-400/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                  <span>ثبت ورود کالا</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setEntrySubTab('consolidation')}
                  className={`min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shrink-0 transition-colors ${
                    entrySubTab === 'consolidation'
                      ? 'bg-gradient-to-b from-amber-400/30 to-orange-500/15 text-amber-200 border border-amber-400/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                  <span>تجمیع</span>
                </motion.button>
              </div>

            {/* Sub-tab 1: Entry Docs */}
            {entrySubTab === 'docs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h2 className="font-lalezar text-2xl font-normal text-slate-100 tracking-wide">
                    ثبت و مدیریت کوتاژهای ورودی
                  </h2>
                </div>

                {/* Mobile View Mode Switcher (< lg) */}
                <div className="lg:hidden flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setMobileEntryMode('list')}
                    className={`min-h-[44px] flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                      mobileEntryMode === 'list'
                        ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/20 text-cyan-200 border border-cyan-400/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ListFilter className="w-4 h-4 text-cyan-400" />
                    <span>مشاهده لیست اسناد ({fa(filteredEntryDocs.length)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileEntryMode('form')}
                    className={`min-h-[44px] flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                      mobileEntryMode === 'form'
                        ? 'bg-gradient-to-r from-amber-500/30 to-amber-600/20 text-amber-200 border border-amber-400/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4 text-amber-400" />
                    <span>{editingDoc ? 'ویرایش کوتاژ' : 'ثبت کوتاژ ورودی جدید'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Form */}
                  <div className={`lg:col-span-4 ${mobileEntryMode === 'form' ? 'block' : 'hidden lg:block'}`}>
                    {(!editingDoc && !activePermissions.canCreateEntry) || (editingDoc && !activePermissions.canEditEntry) ? (
                      <div className="glass-panel p-6 rounded-2xl text-center text-amber-300 bg-amber-500/10 border border-amber-500/30 text-xs font-semibold leading-relaxed space-y-2">
                        <p>ثبت و یا ویرایش کوتاژ ورودی برای دسترسی بازدیدکننده محدود است.</p>
                        <p className="text-[11px] text-slate-400">حساب کاربری بازدیدکننده فقط دسترسی مشاهده، جست‌وجو و پرینت اسناد را دارد.</p>
                      </div>
                    ) : (
                      <EntryForm
                        editingDoc={editingDoc}
                        onSubmit={handleCreateOrUpdateEntryDoc}
                        onCancelEdit={() => {
                          setEditingDoc(null);
                          setMobileEntryMode('list');
                        }}
                        importers={importers}
                        carriers={carriers}
                        goodsList={goodsList}
                        brands={brands}
                        onAddImporter={handleAddImporter}
                        onAddCarrier={handleAddCarrier}
                        onAddGoods={handleAddGoods}
                        onAddBrand={handleAddBrand}
                        onDeleteImporter={canAuthorizedDelete ? handleDeleteImporter : undefined}
                        onDeleteCarrier={canAuthorizedDelete ? handleDeleteCarrier : undefined}
                        onDeleteGoods={canAuthorizedDelete ? handleDeleteGoods : undefined}
                        onDeleteBrand={canAuthorizedDelete ? handleDeleteBrand : undefined}
                        existingDocs={docs}
                      />
                    )}
                  </div>

                  {/* Right Column: Search & Cards List */}
                  <div className={`lg:col-span-8 space-y-4 ${mobileEntryMode === 'list' ? 'block' : 'hidden lg:block'}`}>
                    {/* Search & Chips Toolbar */}
                    <div className="glass-panel p-3.5 sm:p-4 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Text Search Input */}
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={entrySearch}
                            onChange={(e) => setEntrySearch(e.target.value)}
                            placeholder="جست‌وجو در کوتاژ، بارنامه، پرونده، شرکت، کالا..."
                            className="w-full glass-input rounded-xl py-2 pr-10 pl-8 text-xs outline-none"
                          />
                          {entrySearch && (
                            <button
                              onClick={() => setEntrySearch('')}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                              title="پاکسازی جست‌وجو"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Toggle Date Range Filter Button */}
                        <button
                          onClick={() => setShowEntryDateFilter(!showEntryDateFilter)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                            entryStartDate || entryEndDate
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10 font-bold'
                              : showEntryDateFilter
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span>بازه زمانی</span>
                          {(entryStartDate || entryEndDate) && (
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                          )}
                        </button>
                      </div>

                      {/* Status Filter Chips */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-white/5">
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap text-xs max-w-full pb-0.5">
                          {[
                            { id: 'all', label: 'همه' },
                            { id: '1', label: 'در حال تخلیه' },
                            { id: '23', label: 'در حال تکمیل' },
                            { id: '4', label: 'کامل' },
                            { id: '5', label: 'در تجمیع' },
                            { id: '6', label: 'آماده خروج' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setEntryFilter(f.id as EntryFilterType)}
                              className={`min-h-[40px] px-3 py-1.5 rounded-xl border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                entryFilter === f.id
                                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border-cyan-500/40'
                                  : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          نمایش {fa(filteredEntryDocs.length)} از {fa(docs.length)} سند
                        </div>
                      </div>

                      {/* Expandable Date Range Box */}
                      {(showEntryDateFilter || entryStartDate || entryEndDate) && (
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                            <div className="flex items-center gap-1.5 text-amber-300">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>فیلتر بر اساس تاریخ تخلیه / ورود</span>
                            </div>
                            {(entryStartDate || entryEndDate) && (
                              <button
                                onClick={() => {
                                  setEntryStartDate(null);
                                  setEntryEndDate(null);
                                }}
                                className="flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/30 transition-colors"
                              >
                                <X className="w-3 h-3" />
                                <span>حذف فیلتر تاریخ</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">از تاریخ:</label>
                              <JalaliDatePicker
                                value={entryStartDate}
                                onChange={setEntryStartDate}
                                placeholder="انتخاب تاریخ شروع"
                                allowClear
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">تا تاریخ:</label>
                              <JalaliDatePicker
                                value={entryEndDate}
                                onChange={setEntryEndDate}
                                placeholder="انتخاب تاریخ پایان"
                                allowClear
                              />
                            </div>
                          </div>

                          {/* Quick Presets */}
                          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/5 text-xs">
                            <span className="text-[11px] text-slate-400">میانبرهای زمان:</span>
                            <button
                              onClick={() => setEntryPreset('today')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-colors"
                            >
                              امروز
                            </button>
                            <button
                              onClick={() => setEntryPreset('7days')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-colors"
                            >
                              ۷ روز اخیر
                            </button>
                            <button
                              onClick={() => setEntryPreset('30days')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-colors"
                            >
                              ۳۰ روز اخیر
                            </button>
                            <button
                              onClick={() => setEntryPreset('thisYear')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-colors"
                            >
                              امسال ({fa(todayJ().jy)})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cards List */}
                    {filteredEntryDocs.length === 0 ? (
                      <div className="glass-panel rounded-3xl p-10 sm:p-14 text-center space-y-4 border border-cyan-500/20 relative overflow-hidden">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 border border-cyan-400/40 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(6,182,212,0.25)]">
                          <PackageCheck className="w-8 h-8 text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="font-lalezar text-xl text-slate-100 font-normal">کوتاژ ورودی یافت نشد</h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                            عبارت جست‌وجو یا فیلترهای بازه تاریخی را تغییر دهید یا از طریق فرم، کوتاژ جدیدی ثبت کنید.
                          </p>
                        </div>
                        {(entrySearch || entryFilter !== 'all' || entryStartDate || entryEndDate) && (
                          <button
                            onClick={() => {
                              setEntrySearch('');
                              setEntryFilter('all');
                              setEntryStartDate(null);
                              setEntryEndDate(null);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-bold transition-all shadow-sm"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>پاکسازی فیلترها و جست‌وجو</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredEntryDocs.map((doc) => {
                          const batch = batches.find((b) => b.docIds.includes(doc.id));

                          return (
                            <EntryCard
                              key={doc.id}
                              doc={doc}
                              batch={batch}
                              isHighlighted={highlightedEntryId === doc.id}
                              canEdit={activePermissions.canEditEntry}
                              canDelete={canAuthorizedDelete}
                              onEdit={(d) => {
                                if (!activePermissions.canEditEntry) {
                                  addToast('ویرایش کوتاژ ورودی برای دسترسی شما محدود است.', 'err');
                                  return;
                                }
                                handleStartEditDoc(d);
                              }}
                              onDelete={(id) => {
                                handleDeleteDoc(id);
                              }}
                              onUpdateUnloaded={(id, delta) => {
                                if (!activePermissions.canEditEntry) {
                                  addToast('تغییر تعداد تخلیه توسط مدیریت سیستم محدود شده است.', 'err');
                                  return;
                                }
                                handleUpdateUnloaded(id, delta);
                              }}
                              onToggleInvoice={(id, paid) => {
                                if (!activePermissions.canEditEntry) {
                                  addToast('ثبت تسویه حساب توسط مدیریت سیستم محدود شده است.', 'err');
                                  return;
                                }
                                handleToggleInvoice(id, paid);
                              }}
                              onUpdateReceipt={(id, num, count) => {
                                if (!activePermissions.canEditEntry) {
                                  addToast('ویرایش اطلاعات قبض انبار توسط مدیریت سیستم محدود شده است.', 'err');
                                  return;
                                }
                                handleUpdateReceipt(id, num, count);
                              }}
                              onToggleTask={(id, taskKey) => {
                                if (!activePermissions.canEditEntry) {
                                  addToast('تغییر وضعیت چک‌لیست توسط مدیریت سیستم محدود شده است.', 'err');
                                  return;
                                }
                                handleToggleTask(id, taskKey);
                              }}
                              onMarkComplete={handleMarkDocComplete}
                              onCreateFollowUpTask={(targetDoc) => {
                                setTaskPrefillDoc(targetDoc);
                                setIsDailyTasksDrawerOpen(true);
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Document Consolidation (تجمیع اسناد) */}
            {entrySubTab === 'consolidation' && (
              <ConsolidationSection
                docs={docs}
                batches={batches}
                exits={exits}
                companyName={company?.name || ''}
                onCreateBatch={handleCreateBatch}
                onFinalizeBatch={handleFinalizeBatch}
                onDeleteBatch={handleDeleteBatch}
                getStageOf={getStageOfDoc}
                canCreateBatch={activePermissions.canCreateBatch}
                canDelete={canAuthorizedDelete}
              />
            )}
            </motion.div>
          )}

          {/* SECTION 2: GOODS EXIT (خروج کالا - Export Module) */}
          {mainTab === 'exit' && enableExport && activePermissions.canViewExit && (
            <motion.div
              key="main-tab-exit"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="space-y-5 sm:space-y-6"
            >
              {/* Sub-Tabs for Goods Exit */}
              <div className="flex items-center gap-1.5 sm:gap-2 ios-glass-pill p-1.5 rounded-full w-fit max-w-full overflow-x-auto no-scrollbar">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setExitSubTab('docs')}
                  className={`min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shrink-0 transition-colors ${
                    exitSubTab === 'docs'
                      ? 'bg-gradient-to-b from-blue-500/35 to-indigo-500/20 text-blue-200 border border-blue-400/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                  <span>ترخیص کالا</span>
                </motion.button>

                {activePermissions.canViewLab && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setExitSubTab('lab')}
                    className={`min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shrink-0 transition-colors ${
                      exitSubTab === 'lab'
                        ? 'bg-gradient-to-b from-purple-500/35 to-pink-500/20 text-purple-200 border border-purple-400/60'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <FlaskConical className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                    <span>سوابق آزمایشگاه</span>
                  </motion.button>
                )}
              </div>

            {/* Sub-tab 1: Exit Docs */}
            {exitSubTab === 'docs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h2 className="font-lalezar text-2xl font-normal text-slate-100 tracking-wide">
                    ثبت و مدیریت اسناد خروجی
                  </h2>
                </div>

                {/* Mobile View Mode Switcher (< lg) */}
                <div className="lg:hidden flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setMobileExitMode('list')}
                    className={`min-h-[44px] flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                      mobileExitMode === 'list'
                        ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/20 text-emerald-200 border border-emerald-400/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ListFilter className="w-4 h-4 text-emerald-400" />
                    <span>مشاهده اسناد خروج ({fa(filteredExits.length)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileExitMode('form')}
                    className={`min-h-[44px] flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                      mobileExitMode === 'form'
                        ? 'bg-gradient-to-r from-amber-500/30 to-amber-600/20 text-amber-200 border border-amber-400/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4 text-amber-400" />
                    <span>{editingExitDoc ? 'ویرایش کوتاژ خروجی' : 'ثبت کوتاژ خروجی جدید'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Form */}
                  <div className={`lg:col-span-4 ${mobileExitMode === 'form' ? 'block' : 'hidden lg:block'}`}>
                    {(!editingExitDoc && !activePermissions.canCreateExit) || (editingExitDoc && !activePermissions.canCreateExit) ? (
                      <div className="glass-panel p-6 rounded-2xl text-center text-amber-300 bg-amber-500/10 border border-amber-500/30 text-xs font-semibold leading-relaxed space-y-2">
                        <p>ثبت و یا ویرایش کوتاژ خروجی برای دسترسی بازدیدکننده محدود است.</p>
                        <p className="text-[11px] text-slate-400">حساب کاربری بازدیدکننده فقط دسترسی مشاهده، جست‌وجو و پرینت اسناد را دارد.</p>
                      </div>
                    ) : (
                      <ExitForm
                        editingDoc={editingExitDoc}
                        batches={batches}
                        allDocs={docs}
                        onSubmit={handleCreateOrUpdateExitDoc}
                        onCancelEdit={() => {
                          setEditingExitDoc(null);
                          setMobileExitMode('list');
                        }}
                        importers={importers}
                        carriers={carriers}
                        goodsList={goodsList}
                        brands={brands}
                        onAddImporter={handleAddImporter}
                        onAddCarrier={handleAddCarrier}
                        onAddGoods={handleAddGoods}
                        onAddBrand={handleAddBrand}
                        onDeleteImporter={canAuthorizedDelete ? handleDeleteImporter : undefined}
                        onDeleteCarrier={canAuthorizedDelete ? handleDeleteCarrier : undefined}
                        onDeleteGoods={canAuthorizedDelete ? handleDeleteGoods : undefined}
                        onDeleteBrand={canAuthorizedDelete ? handleDeleteBrand : undefined}
                        existingExits={exits}
                      />
                    )}
                  </div>

                  {/* Right Column: Search & Cards */}
                  <div className={`lg:col-span-8 space-y-4 ${mobileExitMode === 'list' ? 'block' : 'hidden lg:block'}`}>
                    <div className="glass-panel p-3.5 sm:p-4 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Text Search Input */}
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={exitSearch}
                            onChange={(e) => setExitSearch(e.target.value)}
                            placeholder="جست‌وجو در کوتاژ خروج، بارنامه، کالا، برند..."
                            className="w-full glass-input rounded-xl py-2 pr-10 pl-8 text-xs outline-none"
                          />
                          {exitSearch && (
                            <button
                              onClick={() => setExitSearch('')}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                              title="پاکسازی جست‌وجو"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Toggle Date Range Filter Button */}
                        <button
                          onClick={() => setShowExitDateFilter(!showExitDateFilter)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                            exitStartDate || exitEndDate
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10 font-bold'
                              : showExitDateFilter
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span>بازه زمانی</span>
                          {(exitStartDate || exitEndDate) && (
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                          )}
                        </button>
                      </div>

                      {/* Status Filter Chips */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-white/5">
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap text-xs max-w-full pb-0.5">
                          {[
                            { id: 'all', label: 'همه' },
                            { id: 'progress', label: 'در حال انجام' },
                            { id: 'gate', label: 'خارج شده از درب' },
                            { id: 'done', label: 'مختومه' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setExitFilter(f.id as ExitFilterType)}
                              className={`min-h-[40px] px-3 py-1.5 rounded-xl border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                exitFilter === f.id
                                  ? 'bg-blue-500/20 text-blue-300 font-bold border-blue-500/40'
                                  : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          نمایش {fa(filteredExits.length)} از {fa(exits.length)} سند
                        </div>
                      </div>

                      {/* Expandable Date Range Box */}
                      {(showExitDateFilter || exitStartDate || exitEndDate) && (
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                            <div className="flex items-center gap-1.5 text-amber-300">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>فیلتر بر اساس تاریخ تخلیه / خروج</span>
                            </div>
                            {(exitStartDate || exitEndDate) && (
                              <button
                                onClick={() => {
                                  setExitStartDate(null);
                                  setExitEndDate(null);
                                }}
                                className="flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/30 transition-colors"
                              >
                                <X className="w-3 h-3" />
                                <span>حذف فیلتر تاریخ</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">از تاریخ:</label>
                              <JalaliDatePicker
                                value={exitStartDate}
                                onChange={setExitStartDate}
                                placeholder="انتخاب تاریخ شروع"
                                allowClear
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">تا تاریخ:</label>
                              <JalaliDatePicker
                                value={exitEndDate}
                                onChange={setExitEndDate}
                                placeholder="انتخاب تاریخ پایان"
                                allowClear
                              />
                            </div>
                          </div>

                          {/* Quick Presets */}
                          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/5 text-xs">
                            <span className="text-[11px] text-slate-400">میانبرهای زمان:</span>
                            <button
                              onClick={() => setExitPreset('today')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-colors"
                            >
                              امروز
                            </button>
                            <button
                              onClick={() => setExitPreset('7days')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-colors"
                            >
                              ۷ روز اخیر
                            </button>
                            <button
                              onClick={() => setExitPreset('30days')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-colors"
                            >
                              ۳۰ روز اخیر
                            </button>
                            <button
                              onClick={() => setExitPreset('thisYear')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-colors"
                            >
                              امسال ({fa(todayJ().jy)})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {filteredExits.length === 0 ? (
                      <div className="glass-panel rounded-3xl p-10 sm:p-14 text-center space-y-4 border border-blue-500/20 relative overflow-hidden">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500/20 to-purple-500/10 border border-blue-400/40 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(59,130,246,0.25)]">
                          <LogOut className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-lalezar text-xl text-slate-100 font-normal">سند خروجی یافت نشد</h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                            سندی مطابق با شماره پرونده، بارنامه یا فیلترهای انتخابی یافت نشد.
                          </p>
                        </div>
                        {(exitSearch || exitFilter !== 'all' || exitStartDate || exitEndDate) && (
                          <button
                            onClick={() => {
                              setExitSearch('');
                              setExitFilter('all');
                              setExitStartDate(null);
                              setExitEndDate(null);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 text-blue-200 text-xs font-bold transition-all shadow-sm"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>پاکسازی فیلترها و جست‌وجو</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredExits.map((exitDoc) => {
                          const batch = batches.find((b) => String(b.id) === String(exitDoc.batchId));

                          return (
                            <ExitCard
                              key={exitDoc.id}
                              doc={exitDoc}
                              batch={batch}
                              allDocs={docs}
                              labRecords={labRecords}
                              physicalExits={physicalExits}
                              isHighlighted={highlightedExitId === exitDoc.id}
                              canEdit={activePermissions.canCreateExit}
                              canDelete={canAuthorizedDelete}
                              canUpdateStages={activePermissions.canUpdateExitStages}
                              onEdit={(d) => {
                                if (!activePermissions.canCreateExit) {
                                  addToast('ویرایش کوتاژ خروجی برای دسترسی شما محدود است.', 'err');
                                  return;
                                }
                                handleStartEditExit(d);
                              }}
                              onDelete={(id) => {
                                handleDeleteExit(id);
                              }}
                              onUpdateExit={(updatedDoc) => {
                                if (!activePermissions.canUpdateExitStages) {
                                  addToast('تغییر مراحل خروج برای دسترسی شما محدود است.', 'err');
                                  return;
                                }
                                handleUpdateExitDoc(updatedDoc);
                              }}
                              onAddLabRecord={(rec) => {
                                if (!activePermissions.canCreateLab) {
                                  addToast('ثبت سابقه آزمایشگاه توسط مدیریت سیستم محدود شده است.', 'err');
                                  return;
                                }
                                handleAddLabRecord(rec);
                              }}
                              onOpenClearance9010={(entryDoc) => setClearanceDrawerDocId(entryDoc.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Lab Records (سوابق آزمایشگاه) */}
            {exitSubTab === 'lab' && <LabRecordsSection records={labRecords} />}
            </motion.div>
          )}

          {/* SECTION 3: REPORTS & ANALYTICS (گزارش‌گیری تحلیلی بر اساس شماره پرونده) */}
          {mainTab === 'reports' && activePermissions.canViewReports && (
            <motion.div
              key="main-tab-reports"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="space-y-5 sm:space-y-6"
            >
              <ReportsSection
                docs={enableImport ? docs : []}
                exits={enableExport ? exits : []}
                batches={enableImport ? batches : []}
                getStageOf={getStageOfDoc}
                onClose={() => setMainTab(enableImport ? 'entry' : 'exit')}
              />
            </motion.div>
          )}

          {/* SECTION 4: CUSTOMS LETTERS & TEMPLATES (بانک نامه‌ها و الگوهای گمرکی) */}
          {mainTab === 'letters' && activePermissions.canViewLetters !== false && (
            <motion.div
              key="main-tab-letters"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="space-y-5 sm:space-y-6"
            >
              <CustomsLettersSection
                companyId={companyId}
                onClose={() => setMainTab(enableImport ? 'entry' : enableExport ? 'exit' : 'reports')}
                primaryCompany={company?.name || importers[0] || ''}
                primaryCargo={goodsList[0] || ''}
                canManageLetters={Boolean(activePermissions.canManageLetters && userRole !== 'viewer')}
                canDelete={canAuthorizedDelete}
                onRequestProtectedDelete={requestProtectedDelete}
                isViewOnly={userRole === 'viewer' || !activePermissions.canManageLetters}
              />
            </motion.div>
          )}
          {mainTab === 'tools' && (
            <motion.div
              key="main-tab-tools"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <MobileToolsView
                onLogout={handleLogout}
                onOpenCloudDb={activePermissions.canAccessCloudDb ? () => setIsCloudDbModalOpen(true) : undefined}
                onOpenSummaryModal={activePermissions.canViewSummaryModal ? () => setIsSummaryModalOpen(true) : undefined}
                onOpenSecurityCenter={() => setIsSecurityModalOpen(true)}
                onOpenCompanySettings={canOpenCompanySettings ? () => setIsCompanySettingsOpen(true) : undefined}
                onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
                onOpenDailyTasks={() => setIsDailyTasksDrawerOpen(true)}
                unreadNotificationsCount={unreadNotificationsCount}
                pendingTasksCount={pendingTasksCount}
                overdueTasksCount={overdueTasksCount}
                company={company}
                member={workspace?.member || null}
                roleName={workspace?.role.name}
                allMemberships={workspace?.allMemberships || []}
                onSwitchCompany={handleSwitchCompany}
                lastCloudSyncTime={lastCloudSyncTime}
                isCloudSyncing={isCloudSyncing}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Fixed Thumb-Reachable Bottom Tab Bar (Mobile Only) */}
      <MobileBottomNav
        activeTab={mainTab}
        onSelectTab={(tab) => {
          setMainTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        toolsAlertCount={unreadNotificationsCount + overdueTasksCount}
        hasSecurityWarning={false}
        canViewEntry={enableImport && activePermissions.canViewEntry}
        canViewExit={enableExport && activePermissions.canViewExit}
        canViewReports={activePermissions.canViewReports}
        canViewLetters={activePermissions.canViewLetters !== false}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Password Modal */}
      <PasswordModal
        isOpen={passModal.isOpen}
        message={passModal.message}
        onSuccess={passModal.action}
        onCancel={() => setPassModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        text={confirmModal.text}
        okLabel={confirmModal.okLabel}
        requireDeletePassword={confirmModal.requireDeletePassword}
        onConfirm={confirmModal.action}
        onCancel={() =>
          setConfirmModal((prev) => ({
            ...prev,
            isOpen: false,
            requireDeletePassword: false,
          }))
        }
      />

      {/* Company Settings Modal (Profile, Operations, Users, Roles, Onboarding Restart) */}
      {workspace && canOpenCompanySettings && (
        <CompanySettingsModal
          isOpen={isCompanySettingsOpen}
          onClose={() => setIsCompanySettingsOpen(false)}
          workspace={workspace}
          onWorkspaceUpdated={() => refreshWorkspace(workspace.company.id)}
          onLaunchRestartWizard={handleLaunchRestartWizard}
          canDelete={canAuthorizedDelete}
          onRequestProtectedDelete={requestProtectedDelete}
          addToast={addToast}
        />
      )}

      {/* Cloud Database Sync Modal */}
      <CloudDbSyncModal
        isOpen={isCloudDbModalOpen}
        onClose={() => setIsCloudDbModalOpen(false)}
        companyId={companyId}
        enableImport={enableImport}
        enableExport={enableExport}
        lastCloudSyncTime={lastCloudSyncTime}
        localData={{
          docs: docs || [],
          batches: batches || [],
          exits: exits || [],
          labRecords: labRecords || [],
          physicalExits: physicalExits || [],
          dailyTasks: dailyTasks || [],
          notificationStates: notificationStates || [],
          importers: importers || [],
          carriers: carriers || [],
          goodsList: goodsList || [],
          brands: brands || [],
        }}
        onSyncComplete={(cloudData) => {
          if (cloudData) {
            setDocs(cloudData.docs || []);
            setBatches(cloudData.batches || []);
            setExits(cloudData.exits || []);
            setLabRecords(cloudData.labRecords || []);
            setPhysicalExits(cloudData.physicalExits || []);
            setDailyTasks(cloudData.dailyTasks || []);
            setNotificationStates(cloudData.notificationStates || []);
            setImporters(cloudData.importers || []);
            setCarriers(cloudData.carriers || []);
            setGoodsList(cloudData.goodsList || []);
            setBrands(cloudData.brands || []);
            saveAllData(cloudData, companyId);
            addToast('داده‌ها با پایگاه داده ابری همگام‌سازی شدند', 'ok');
          }
        }}
        addToast={addToast}
      />

      {/* Commodity & Documents Breakdown Modal */}
      <CommoditySummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        docs={enableImport ? docs : []}
        exits={enableExport ? exits : []}
        batches={enableImport ? batches : []}
      />

      {/* Security Center Modal */}
      <SecurityCenterModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        canManagePermissions={canOpenCompanySettings}
        canDelete={canAuthorizedDelete}
        onRequestProtectedDelete={requestProtectedDelete}
        onOpenPermissionsModal={() => {
          setIsSecurityModalOpen(false);
          setIsCompanySettingsOpen(true);
        }}
        addToast={addToast}
        onPasswordsUpdated={() => {
          addToast('تنظیمات امنیتی سامانه بروزرسانی گردید', 'ok');
        }}
      />

      {/* 90% / 10% Clearance & Multi-Truck Physical Exit Drawer (Export Module) */}
      {enableExport && (
        <Clearance9010Drawer
          isOpen={Boolean(clearanceDrawerDoc)}
          doc={clearanceDrawerDoc}
          exits={exits}
          batches={batches}
          physicalExits={physicalExits}
          currentUser={activeOperatorLabel}
          permissions={{ ...activePermissions, canDeleteItems: canAuthorizedDelete }}
          isViewOnly={userRole === 'viewer'}
          onClose={() => setClearanceDrawerDocId(null)}
          onUpdateDoc={handleUpdateEntryClearanceDoc}
          onRequestMasterPassword={(_message, onSuccess) => {
            onSuccess();
          }}
          onAddPhysicalExit={handleAddPhysicalExit}
          onUpdatePhysicalExit={handleUpdatePhysicalExit}
          onDeletePhysicalExit={handleDeletePhysicalExit}
          onCreateFollowUpTask={(targetDoc) => {
            setClearanceDrawerDocId(null);
            setTaskPrefillDoc(targetDoc);
            setIsDailyTasksDrawerOpen(true);
          }}
          addToast={addToast}
        />
      )}

      {/* Integrated Smart Notification Center Drawer */}
      <NotificationCenterDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        canManage={userRole !== 'viewer' && activePermissions.canManageNotifications !== false}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onToggleArchive={handleToggleNotificationArchive}
        onNavigateToRecord={handleNavigateFromNotification}
      />

      {/* Integrated Daily Task Management Drawer */}
      <DailyTasksDrawer
        isOpen={isDailyTasksDrawerOpen}
        onClose={() => {
          setIsDailyTasksDrawerOpen(false);
          setTaskPrefillDoc(null);
        }}
        tasks={dailyTasks}
        docs={enableImport ? docs : []}
        exits={enableExport ? exits : []}
        currentUser={activeOperatorLabel}
        canManage={userRole !== 'viewer' && activePermissions.canManageTasks !== false}
        canDelete={canAuthorizedDelete}
        prefillEntryDoc={taskPrefillDoc}
        onAddTask={handleAddDailyTask}
        onUpdateTask={handleUpdateDailyTask}
        onDeleteTask={handleDeleteDailyTask}
        onNavigateToEntry={handleNavigateToEntryDoc}
        onNavigateToExit={handleNavigateToExitDoc}
      />
    </div>
  );
}
