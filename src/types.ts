export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export type ClearanceStatus =
  | 'awaiting_initial_clearance'
  | 'initial_90_completed'
  | 'remaining_10_awaiting_sata'
  | 'sata_received'
  | 'sata_confirmed'
  | 'remaining_clearance_in_progress'
  | 'fully_cleared'
  | 'fully_exited'
  | 'case_closed';

export interface FirstStageClearanceInfo {
  status: 'pending' | 'in_progress' | 'completed';
  clearanceDate: JalaliDate | null;
  authorizedPallets: number;
  documents: string[];
  notes: string;
  updatedBy?: string;
  updatedAt?: number;
}

export interface SataApprovalInfo {
  code: string;
  receivedDate: JalaliDate | null;
  receivedBy?: string;
  confirmed: boolean;
  confirmedDate: JalaliDate | null;
  confirmedBy?: string;
  referenceLetterNo: string;
  documents: string[];
  notes: string;
}

export interface RemainingStageClearanceInfo {
  status: 'locked' | 'ready' | 'in_progress' | 'completed';
  clearanceDate: JalaliDate | null;
  documents: string[];
  notes: string;
  updatedBy?: string;
  updatedAt?: number;
}

export interface CaseClosureInfo {
  closed: boolean;
  closedDate: JalaliDate | null;
  closedBy?: string;
  notes?: string;
}

export interface EntryClearanceInfo {
  status: ClearanceStatus;
  firstStage: FirstStageClearanceInfo;
  sata: SataApprovalInfo;
  remainingStage: RemainingStageClearanceInfo;
  closure: CaseClosureInfo;
  statusUpdatedAt?: number;
}

export interface PhysicalExitTransaction {
  id: string;
  entryDocId: string;
  exitDocId?: string;
  cottage: string;
  stage: 'first_90' | 'remaining_10';
  exitDate: JalaliDate;
  truckInfo: string;
  pallets: number;
  driverInfo: string;
  documents: string[];
  notes: string;
  responsibleUser: string;
  createdAt: number;
  updatedAt?: number;
  fingerprint?: string;
}

export interface EntryDoc {
  id: string;
  cottage: string;
  bl: string;
  file: string;
  importer: string;
  carrier: string;
  goods: string;
  brand: string;
  mdfThickness?: string;
  unloadDate: JalaliDate;
  trailers: number;
  unloaded: number;
  pallets: number;
  invoicePaid: boolean;
  receipt: {
    number: string;
    count: string;
  };
  tasks: {
    bl: boolean;
    arr: boolean;
    tali: boolean;
  };
  clearance?: EntryClearanceInfo;
  createdAt: number;
}

export interface Batch {
  id: string; // SEETECxxxxxCOMBxxxx
  goods: string;
  file: string;
  createdAt: JalaliDate;
  docIds: string[];
  finalized: boolean;
  exited?: boolean;
}

export interface LabRecord {
  id: string;
  goods: string;
  brand: string;
  sampleDate: JalaliDate;
  validity: number; // in months (e.g. 6)
  comment: string;
  exitId?: string;
  createdAt: number;
}

export interface PartialExitInfo {
  isPartial: boolean;
  exitPercent: number;
  exitPallets: number;
  remainingPercent: number;
  remainingPallets: number;
  totalPallets: number;
}

export interface ExitDoc {
  id: string;
  cottage: string;
  bl: string;
  file: string;
  unloadDate: JalaliDate;
  importer: string;
  carrier: string;
  goods: string;
  brand: string;
  mdfThickness?: string;
  trailers: number;
  pallets: number;
  batchId: string;
  entryDocId?: string;
  route: 'red' | 'yellow' | null;
  partialExit?: PartialExitInfo;
  evaluator: {
    done: boolean;
    comment: string;
  };
  jihad: {
    done: boolean;
    comment: string;
  };
  lab: {
    needed: boolean;
    sampled: boolean;
    sampleDate: JalaliDate | null;
    sent: boolean;
    tested: boolean;
    comment: string;
    reusedFrom: string | null;
    recordId: string | null;
    validity: number;
  };
  expert: {
    done: boolean;
  };
  gate: {
    done: boolean;
  };
  invoice: {
    paid: boolean;
  };
  createdAt: number;
}

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationCategory =
  | 'remaining_10_awaiting_sata'
  | 'sata_received_unconfirmed'
  | 'lab_expiring_soon'
  | 'lab_expired'
  | 'missing_documents'
  | 'overdue_clearance'
  | 'task_due_today'
  | 'task_overdue'
  | 'cleared_not_exited'
  | 'remaining_pallets_followup';

export interface NotificationStateRecord {
  dedupeKey: string;
  read: boolean;
  archived: boolean;
  readAt?: number;
  archivedAt?: number;
}

export interface AppNotification {
  id: string;
  dedupeKey: string;
  category: NotificationCategory;
  title: string;
  description: string;
  createdAt: number;
  jalaliDate: JalaliDate;
  priority: NotificationPriority;
  read: boolean;
  archived: boolean;
  relatedRecordType?: 'entry' | 'exit' | 'lab' | 'task';
  relatedRecordId?: string;
  cottage?: string;
  actionLabel?: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskViewFilter = 'today' | 'overdue' | 'upcoming' | 'completed' | 'all';

export interface DailyTask {
  id: string;
  title: string;
  description: string;
  cottage?: string;
  relatedRecordType?: 'entry' | 'exit' | 'lab';
  relatedRecordId?: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: JalaliDate;
  createdAtDate: JalaliDate;
  createdAt: number;
  status: TaskStatus;
  notes: string;
  completionDate?: JalaliDate | null;
  completedAt?: number;
  createdBy: string;
  isAuto?: boolean;
  autoSourceKey?: string;
}

export type TabType = 'entry' | 'consolidation' | 'exit' | 'lab' | 'reports';

export type MainTabType = 'entry' | 'exit' | 'reports' | 'letters' | 'tools';
export type EntrySubTab = 'docs' | 'consolidation';
export type ExitSubTab = 'docs' | 'lab';

export interface CustomsLetterAttachment {
  name: string;
  type: 'image' | 'pdf' | 'other';
  dataUrl: string;
  sizeKb?: number;
}

export interface CustomsLetter {
  id: string;
  title: string;
  imageUrl: string;
  imageName?: string;
  sizeKb?: number;
  date?: JalaliDate;
  note?: string;
  createdAt: number;
}

export type EntryFilterType = 'all' | '1' | '23' | '4' | '5' | '6';

export type ExitFilterType = 'all' | 'progress' | 'gate' | 'done';

export interface UserPermissions {
  canViewEntry: boolean;
  canCreateEntry: boolean;
  canEditEntry: boolean;
  canCreateBatch: boolean;
  canViewExit: boolean;
  canCreateExit: boolean;
  canUpdateExitStages: boolean;
  canViewLab: boolean;
  canCreateLab: boolean;
  canViewReports: boolean;
  canViewSummaryModal: boolean;
  canAccessCloudDb: boolean;
  canDeleteItems: boolean;
  canViewLetters?: boolean;
  canManageLetters?: boolean;
  // Extended 90/10, Sata, Closure, Tasks & Notification Permissions
  canConfirmSata?: boolean;
  canCloseCase?: boolean;
  canEditCriticalClearance?: boolean;
  canModifyCompletedExits?: boolean;
  canManageTasks?: boolean;
  canManageNotifications?: boolean;
  // Multi-Tenant SaaS & Enterprise Governance Permissions
  canManageUsers?: boolean;
  canManageRoles?: boolean;
  canManageCompanySettings?: boolean;
  canManageSystemConfig?: boolean;
}

export type UserPermissionsMap = Record<string, UserPermissions>;

export type BusinessOperationMode = 'import_only' | 'export_only' | 'both';

export type BuiltInRoleKey =
  | 'owner'
  | 'admin'
  | 'import_operator'
  | 'export_operator'
  | 'inventory_manager'
  | 'report_viewer';

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  registrationNumber: string;
  nationalId: string;
  phone: string;
  email: string;
  address: string;
  settings: Record<string, unknown>;
  enableImport: boolean;
  enableExport: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyRole {
  id: string;
  companyId: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  isOwnerRole: boolean;
  permissions: UserPermissions;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  fullName: string;
  email: string;
  username: string;
  roleId: string;
  roleKey?: string;
  roleName?: string;
  permissionOverrides: Partial<UserPermissions>;
  status: 'active' | 'disabled';
  isOwner: boolean;
  createdAt?: string;
}

export interface CompanyAuditLog {
  id: string;
  companyId: string;
  actorUserId?: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface WorkspaceMembershipSummary {
  companyId: string;
  companyName: string;
  companySlug: string;
  logoUrl: string;
  roleName: string;
  isOwner: boolean;
  status: 'active' | 'disabled';
  onboardingCompleted: boolean;
}

export interface WorkspaceContextData {
  company: CompanyProfile;
  member: CompanyMember;
  role: CompanyRole;
  effectivePermissions: UserPermissions;
  roles: CompanyRole[];
  members?: CompanyMember[];
  allMemberships?: WorkspaceMembershipSummary[];
}

export interface OnboardingRoleDraft {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  isOwnerRole: boolean;
  permissions: UserPermissions;
}

export interface OnboardingUserDraft {
  tempId: string;
  fullName: string;
  email: string;
  username?: string;
  password: string;
  roleKey: string;
  status: 'active' | 'disabled';
  permissionOverrides?: Partial<UserPermissions>;
}

export interface OnboardingPayload {
  company: {
    name: string;
    logoUrl?: string;
    registrationNumber?: string;
    nationalId?: string;
    phone?: string;
    email?: string;
    address?: string;
    settings?: Record<string, unknown>;
  };
  operations: {
    mode: BusinessOperationMode;
    enableImport: boolean;
    enableExport: boolean;
  };
  owner?: {
    fullName: string;
    email: string;
    username?: string;
    password: string;
  };
  roles: OnboardingRoleDraft[];
  additionalUsers: OnboardingUserDraft[];
}

