import React, { useState, useEffect } from 'react';
import {
  X,
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  Sparkles,
  ExternalLink,
  User,
} from 'lucide-react';
import {
  DailyTask,
  EntryDoc,
  ExitDoc,
  JalaliDate,
  TaskPriority,
  TaskStatus,
  TaskViewFilter,
} from '../types';
import { matchesTaskView } from '../utils/workflowEngine';
import { JalaliDatePicker } from './JalaliDatePicker';
import { fa, fmtJ, todayJ, uid } from '../utils/jalali';

interface DailyTasksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: DailyTask[];
  docs: EntryDoc[];
  exits: ExitDoc[];
  currentUser: string;
  canManage: boolean;
  canDelete: boolean;
  prefillEntryDoc?: EntryDoc | null;
  onAddTask: (task: DailyTask) => void;
  onUpdateTask: (task: DailyTask) => void;
  onDeleteTask: (id: string) => void;
  onNavigateToEntry: (entryDocId: string) => void;
  onNavigateToExit: (exitDocId: string) => void;
}

const PRIORITY_META: Record<TaskPriority, { label: string; cls: string }> = {
  low: { label: 'کم', cls: 'bg-slate-500/20 border-slate-500/40 text-slate-300' },
  medium: { label: 'متوسط', cls: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
  high: { label: 'بالا', cls: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  critical: { label: 'بحرانی', cls: 'bg-rose-500/20 border-rose-500/40 text-rose-300' },
};

const STATUS_META: Record<TaskStatus, { label: string; cls: string }> = {
  pending: { label: 'در انتظار', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  in_progress: { label: 'در حال انجام', cls: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30' },
  completed: { label: 'تکمیل‌شده', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' },
  cancelled: { label: 'لغوشده', cls: 'text-slate-400 bg-slate-500/15 border-slate-500/30' },
};

export const DailyTasksDrawer: React.FC<DailyTasksDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  docs,
  exits,
  currentUser,
  canManage,
  canDelete,
  prefillEntryDoc,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onNavigateToEntry,
  onNavigateToExit,
}) => {
  const [view, setView] = useState<TaskViewFilter>('today');
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cottage, setCottage] = useState('');
  const [relatedType, setRelatedType] = useState<'entry' | 'exit' | ''>('');
  const [relatedId, setRelatedId] = useState('');
  const [assignedTo, setAssignedTo] = useState('نظری');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<JalaliDate>(todayJ());
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (prefillEntryDoc && isOpen) {
      setEditingTask(null);
      setShowForm(true);
      setTitle(`پیگیری کوتاژ ${fa(prefillEntryDoc.cottage)}`);
      setDescription(`پیگیری وضعیت کالا: ${prefillEntryDoc.goods}`);
      setCottage(prefillEntryDoc.cottage);
      setRelatedType('entry');
      setRelatedId(prefillEntryDoc.id);
      setAssignedTo(currentUser || 'نظری');
      setPriority('high');
      setDueDate(todayJ());
      setStatus('pending');
      setNotes('');
    }
  }, [prefillEntryDoc, isOpen, currentUser]);

  if (!isOpen) return null;

  const refToday = todayJ();

  const counts: Record<TaskViewFilter, number> = {
    today: tasks.filter((t) => matchesTaskView(t, 'today', refToday)).length,
    overdue: tasks.filter((t) => matchesTaskView(t, 'overdue', refToday)).length,
    upcoming: tasks.filter((t) => matchesTaskView(t, 'upcoming', refToday)).length,
    completed: tasks.filter((t) => matchesTaskView(t, 'completed', refToday)).length,
    all: tasks.length,
  };

  const filteredTasks = tasks
    .filter((t) => matchesTaskView(t, view, refToday))
    .filter((t) => (assigneeFilter === 'all' ? true : t.assignedTo === assigneeFilter))
    .filter((t) => (priorityFilter === 'all' ? true : t.priority === priorityFilter))
    .filter((t) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return [t.title, t.description, t.cottage, t.assignedTo, t.notes]
        .some((v) => String(v || '').toLowerCase().includes(q));
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const openCreateForm = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setCottage('');
    setRelatedType('');
    setRelatedId('');
    setAssignedTo(currentUser || 'نظری');
    setPriority('medium');
    setDueDate(todayJ());
    setStatus('pending');
    setNotes('');
    setShowForm(true);
  };

  const openEditForm = (task: DailyTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setCottage(task.cottage || '');
    setRelatedType((task.relatedRecordType as 'entry' | 'exit') || '');
    setRelatedId(task.relatedRecordId || '');
    setAssignedTo(task.assignedTo);
    setPriority(task.priority);
    setDueDate(task.dueDate);
    setStatus(task.status);
    setNotes(task.notes || '');
    setShowForm(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = Date.now();
    const isCompleted = status === 'completed';

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        title: title.trim(),
        description: description.trim(),
        cottage: cottage.trim() || undefined,
        relatedRecordType: relatedType || undefined,
        relatedRecordId: relatedId || undefined,
        assignedTo,
        priority,
        dueDate,
        status,
        notes: notes.trim(),
        completionDate: isCompleted ? editingTask.completionDate || todayJ() : null,
        completedAt: isCompleted ? editingTask.completedAt || now : undefined,
      });
    } else {
      onAddTask({
        id: `task-${uid()}`,
        title: title.trim(),
        description: description.trim(),
        cottage: cottage.trim() || undefined,
        relatedRecordType: relatedType || undefined,
        relatedRecordId: relatedId || undefined,
        assignedTo,
        priority,
        dueDate,
        createdAtDate: todayJ(),
        createdAt: now,
        status,
        notes: notes.trim(),
        completionDate: isCompleted ? todayJ() : null,
        completedAt: isCompleted ? now : undefined,
        createdBy: currentUser || 'مدیر',
        isAuto: false,
      });
    }

    setShowForm(false);
    setEditingTask(null);
  };

  const handleSelectLinkedDoc = (val: string) => {
    if (!val) {
      setRelatedType('');
      setRelatedId('');
      return;
    }
    const [type, id] = val.split(':');
    setRelatedType(type as 'entry' | 'exit');
    setRelatedId(id);
    if (type === 'entry') {
      const found = docs.find((d) => d.id === id);
      if (found) setCottage(found.cottage);
    } else if (type === 'exit') {
      const found = exits.find((x) => x.id === id);
      if (found) setCottage(found.cottage);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-md animate-in fade-in font-vazir dir-rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-[100dvh] pt-safe-top pb-safe-bar ios-glass-modal border-r border-white/20 flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.9)] text-slate-100"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03] flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/25 to-cyan-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-lalezar text-lg sm:text-xl text-slate-100 truncate">مدیریت کارهای روزانه</h3>
              <p className="text-[11px] text-slate-400 truncate">
                پیگیری ساتا، آزمایشگاه، مدارک و خروج فیزیکی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {canManage && (
              <button
                type="button"
                onClick={openCreateForm}
                className="min-h-[42px] flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl ios-glass-btn-primary text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>کار جدید</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-white/15 cursor-pointer"
              aria-label="بستن کارهای روزانه"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 5 Views Bar */}
        <div className="px-5 py-2.5 border-b border-white/10 bg-slate-950/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs">
          {[
            { id: 'today', label: 'امروز', count: counts.today },
            { id: 'overdue', label: 'عقب‌افتاده', count: counts.overdue },
            { id: 'upcoming', label: 'آینده', count: counts.upcoming },
            { id: 'completed', label: 'تکمیل‌شده', count: counts.completed },
            { id: 'all', label: 'همه', count: counts.all },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id as TaskViewFilter)}
              className={`px-3 py-1.5 rounded-xl border whitespace-nowrap shrink-0 font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                view === tab.id
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{fa(tab.count)}</span>
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 flex-wrap shrink-0 text-xs">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجو در عنوان، کوتاژ، توضیحات..."
              className="w-full glass-input rounded-xl py-1.5 pr-9 pl-3 text-xs outline-none"
            />
          </div>

          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="glass-input rounded-xl px-2.5 py-1.5 text-xs outline-none"
          >
            <option value="all" className="bg-slate-900">همه مسئولین</option>
            <option value="نظری" className="bg-slate-900">نظری</option>
            <option value="یوسفی" className="bg-slate-900">یوسفی</option>
            <option value="افسر" className="bg-slate-900">افسر</option>
            <option value="مدیر" className="bg-slate-900">مدیر</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="glass-input rounded-xl px-2.5 py-1.5 text-xs outline-none"
          >
            <option value="all" className="bg-slate-900">همه اولویت‌ها</option>
            <option value="critical" className="bg-slate-900">بحرانی</option>
            <option value="high" className="bg-slate-900">بالا</option>
            <option value="medium" className="bg-slate-900">متوسط</option>
            <option value="low" className="bg-slate-900">کم</option>
          </select>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Task Create/Edit Form */}
          {showForm && canManage && (
            <form onSubmit={handleSubmitForm} className="ios-glass-card p-4 rounded-2xl border border-cyan-400/35 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h4 className="font-bold text-sm text-cyan-200">
                  {editingTask ? 'ویرایش کار' : 'ثبت کار روزانه جدید'}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  بستن فرم
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">عنوان کار *:</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثلاً: پیگیری تاییدیه ساتا کوتاژ ۱۴۰۰..."
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">مسئول انجام:</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="نظری" className="bg-slate-900">نظری</option>
                    <option value="یوسفی" className="bg-slate-900">یوسفی</option>
                    <option value="افسر" className="bg-slate-900">افسر</option>
                    <option value="مدیر" className="bg-slate-900">مدیر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">اولویت:</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="low" className="bg-slate-900">کم</option>
                    <option value="medium" className="bg-slate-900">متوسط</option>
                    <option value="high" className="bg-slate-900">بالا</option>
                    <option value="critical" className="bg-slate-900">بحرانی</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تاریخ سررسید:</label>
                  <JalaliDatePicker value={dueDate} onChange={setDueDate} />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">وضعیت:</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="pending" className="bg-slate-900">در انتظار</option>
                    <option value="in_progress" className="bg-slate-900">در حال انجام</option>
                    <option value="completed" className="bg-slate-900">تکمیل‌شده</option>
                    <option value="cancelled" className="bg-slate-900">لغوشده</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">پرونده مرتبط (ورود یا خروج):</label>
                  <select
                    value={relatedType && relatedId ? `${relatedType}:${relatedId}` : ''}
                    onChange={(e) => handleSelectLinkedDoc(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="" className="bg-slate-900">— بدون اتصال مستقیم —</option>
                    {docs.map((d) => (
                      <option key={d.id} value={`entry:${d.id}`} className="bg-slate-900">
                        ورود · کوتاژ {fa(d.cottage)} ({d.goods})
                      </option>
                    ))}
                    {exits.map((x) => (
                      <option key={x.id} value={`exit:${x.id}`} className="bg-slate-900">
                        خروج · کوتاژ {fa(x.cottage)} ({x.goods})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">شماره کوتاژ مرتبط:</label>
                  <input
                    type="text"
                    value={cottage}
                    onChange={(e) => setCottage(e.target.value)}
                    placeholder="اختیاری"
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">توضیحات:</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="شرح دقیق اقدام لازم..."
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">یادداشت:</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="یادداشت پیگیری..."
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl ios-glass-btn text-slate-300 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl ios-glass-btn-primary font-bold cursor-pointer"
                >
                  {editingTask ? 'بروزرسانی کار' : 'ذخیره کار'}
                </button>
              </div>
            </form>
          )}

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-14 text-slate-400 space-y-2 text-xs">
              <p className="text-sm font-bold text-slate-300">کاری در این نمای زمانی یافت نشد</p>
              <p>می‌توانید از دکمه «کار جدید» اقدام جدیدی ثبت کنید.</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const pMeta = PRIORITY_META[task.priority];
              const sMeta = STATUS_META[task.status];
              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-2xl border transition-all space-y-2 text-xs ${
                    task.status === 'completed'
                      ? 'bg-emerald-500/5 border-emerald-500/20 opacity-85'
                      : 'bg-white/5 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-bold text-slate-100 ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                          {task.title}
                        </h4>
                        {task.isAuto && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-400/30 text-purple-300 text-[10px] font-bold">
                            <Sparkles className="w-2.5 h-2.5" />
                            خودکار
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-slate-300 leading-relaxed">{task.description}</p>
                      )}
                      {task.notes && (
                        <p className="text-[11px] text-slate-400">یادداشت: {task.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${pMeta.cls}`}>
                        {pMeta.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sMeta.cls}`}>
                        {sMeta.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-white/5 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-200">
                        <User className="w-3 h-3 text-cyan-400" />
                        {task.assignedTo}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        سررسید: {fmtJ(task.dueDate)}
                      </span>
                      {task.cottage && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-cyan-300">کوتاژ {fa(task.cottage)}</span>
                        </>
                      )}
                      {task.completionDate && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-300">تکمیل: {fmtJ(task.completionDate)}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {task.relatedRecordId && (task.relatedRecordType === 'entry' || task.relatedRecordType === 'exit') && (
                        <button
                          type="button"
                          onClick={() =>
                            task.relatedRecordType === 'entry'
                              ? onNavigateToEntry(task.relatedRecordId!)
                              : onNavigateToExit(task.relatedRecordId!)
                          }
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 font-bold cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>پرونده</span>
                        </button>
                      )}

                      {canManage && task.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateTask({
                              ...task,
                              status: 'completed',
                              completionDate: todayJ(),
                              completedAt: Date.now(),
                            })
                          }
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold cursor-pointer"
                          title="علامت به عنوان انجام‌شده"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>انجام شد</span>
                        </button>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openEditForm(task)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                          title="ویرایش"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}

                      {canManage && canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
