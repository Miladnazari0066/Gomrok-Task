import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Printer,
  X,
  Upload,
  Image as ImageIcon,
  Check,
  AlertCircle,
  FileText,
  Calendar,
  ArrowUpDown,
  Eye,
  Maximize2,
  Lock,
  Sparkles,
  FileCheck2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { CustomsLetter, JalaliDate } from '../types';
import { fa, todayJ, uid } from '../utils/jalali';
import { JalaliDatePicker } from './JalaliDatePicker';
import { sanitizeInputText, logSecurityEvent } from '../utils/security';

interface CustomsLettersSectionProps {
  onClose?: () => void;
  primaryCompany?: string;
  primaryCargo?: string;
  canManageLetters?: boolean;
  isViewOnly?: boolean;
}

const STORAGE_KEY = 'gm_customs_letters_user';

// Persian text normalizer for ultrafast and robust searching
const normalizeFa = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ') // zero-width spaces
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ة]/g, 'ه')
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584))
    .toLowerCase()
    .trim();
};

// Client-side image compressor to preserve high-clarity document text
// while avoiding excessive browser storage consumption
const compressImageFile = (file: File): Promise<{ dataUrl: string; sizeKb: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 2200; // ample resolution for crisp reading of fine text
        let { width, height } = img;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: readerEvent.target?.result as string, sizeKb: Math.round(file.size / 1024) });
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
        resolve({ dataUrl, sizeKb });
      };
      img.onerror = () => reject(new Error('خطا در بارگذاری تصویر'));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.readAsDataURL(file);
  });
};

export const CustomsLettersSection: React.FC<CustomsLettersSectionProps> = ({
  onClose,
  canManageLetters = true,
  isViewOnly = false,
}) => {
  // Letters list loaded from localStorage
  const [letters, setLetters] = useState<CustomsLetter[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item: any) => ({
              id: item.id || uid(),
              title: item.title || item.subject || 'بدون عنوان',
              imageUrl: item.imageUrl || item.attachment?.dataUrl || '',
              imageName: item.imageName || item.attachment?.name || 'نامه',
              sizeKb: item.sizeKb || item.attachment?.sizeKb || 0,
              date: item.date || todayJ(),
              note: item.note || item.content || '',
              createdAt: item.createdAt || Date.now(),
            }))
            .filter((l: CustomsLetter) => Boolean(l.imageUrl || l.title));
        }
      }
    } catch (e) {
      console.error('Failed to parse saved customs letters', e);
    }
    return [];
  });

  // Effective edit permission
  const userCanManage = canManageLetters && !isViewOnly;

  // Save to localStorage whenever list changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
    } catch (e) {
      console.error('Failed to save customs letters to storage', e);
    }
  }, [letters]);

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');

  // Modals & Active Viewers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeZoomLetter, setActiveZoomLetter] = useState<CustomsLetter | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Edit Title State
  const [editingLetter, setEditingLetter] = useState<CustomsLetter | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  // Add Form State
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newDate, setNewDate] = useState<JalaliDate>(todayJ());
  const [newImageData, setNewImageData] = useState<{ url: string; name: string; sizeKb: number } | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Focus search input with keyboard shortcut (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !isAddModalOpen && !activeZoomLetter) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (activeZoomLetter) {
          setActiveZoomLetter(null);
        } else if (isAddModalOpen) {
          setIsAddModalOpen(false);
        } else if (deleteConfirmId) {
          setDeleteConfirmId(null);
        } else if (editingLetter) {
          setEditingLetter(null);
        }
      }
      // Zoom shortcuts when viewing modal
      if (activeZoomLetter) {
        if (e.key === '+' || e.key === '=') {
          setZoomLevel((prev) => Math.min(prev + 0.25, 4));
        } else if (e.key === '-' || e.key === '_') {
          setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
        } else if (e.key === '0') {
          setZoomLevel(1);
          setRotation(0);
        } else if (e.key === 'r' || e.key === 'R') {
          setRotation((prev) => (prev + 90) % 360);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeZoomLetter, isAddModalOpen, deleteConfirmId, editingLetter]);

  // Support pasting image from clipboard (Ctrl+V) when add modal is open
  useEffect(() => {
    if (!userCanManage) return;

    const handlePaste = async (e: ClipboardEvent) => {
      if (!isAddModalOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isAddModalOpen, userCanManage]);

  // Handle selected image file
  const handleImageFile = async (file: File) => {
    if (!userCanManage) return;
    if (!file.type.startsWith('image/')) {
      setFormError('لطفاً یک فایل تصویری (JPG, PNG, WebP) انتخاب کنید.');
      return;
    }
    // Security check: restrict SVGs with potential malicious script injection
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      setFormError('به دلایل امنیتی، بارگذاری فایل SVG مجاز نیست. لطفاً فایل تصویری JPG، PNG یا WebP انتخاب کنید.');
      return;
    }
    // Security check: maximum 15MB file size to prevent browser/storage memory crash
    if (file.size > 15 * 1024 * 1024) {
      setFormError('حجم فایل تصویر نباید بیش از ۱۵ مگابایت باشد.');
      return;
    }

    setIsProcessingImage(true);
    setFormError(null);
    try {
      const { dataUrl, sizeKb } = await compressImageFile(file);
      setNewImageData({
        url: dataUrl,
        name: file.name,
        sizeKb,
      });
      // Suggest title from file name if empty
      if (!newTitle.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        if (cleanName && cleanName.length > 2 && cleanName !== 'image') {
          setNewTitle(sanitizeInputText(cleanName));
        }
      }
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error(err);
      setFormError('خطا در پردازش تصویر. لطفاً مجدداً امتحان نمایید.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!userCanManage) return;
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  // Submit new letter
  const handleSaveLetter = (e?: React.FormEvent) => {
    if (!userCanManage) return;
    if (e) e.preventDefault();
    const sanitizedTitle = sanitizeInputText(newTitle);
    const sanitizedNote = sanitizeInputText(newNote);

    if (!sanitizedTitle) {
      setFormError('لطفاً عنوان نامه را وارد کنید.');
      titleInputRef.current?.focus();
      return;
    }
    if (!newImageData) {
      setFormError('لطفاً عکس یا تصویر نامه را بارگذاری کنید.');
      return;
    }

    const newLetterItem: CustomsLetter = {
      id: uid(),
      title: sanitizedTitle,
      imageUrl: newImageData.url,
      imageName: newImageData.name,
      sizeKb: newImageData.sizeKb,
      date: newDate,
      note: sanitizedNote,
      createdAt: Date.now(),
    };

    setLetters((prev) => [newLetterItem, ...prev]);

    logSecurityEvent({
      type: 'doc_created',
      user: 'کاربر سیستم',
      role: 'مجاز',
      description: `تصویر نامه گمرکی جدید با عنوان «${sanitizedTitle}» بایگانی شد`,
      severity: 'info',
    });

    // Reset and close
    setNewTitle('');
    setNewNote('');
    setNewDate(todayJ());
    setNewImageData(null);
    setFormError(null);
    setIsAddModalOpen(false);
  };

  // Delete letter
  const handleDeleteLetter = (id: string) => {
    if (!userCanManage) return;
    const target = letters.find((l) => l.id === id);
    setLetters((prev) => prev.filter((l) => l.id !== id));
    setDeleteConfirmId(null);
    if (activeZoomLetter?.id === id) {
      setActiveZoomLetter(null);
    }

    logSecurityEvent({
      type: 'doc_deleted',
      user: 'کاربر سیستم',
      role: 'مدیر',
      description: `نامه گمرکی «${target?.title || id}» حذف شد`,
      severity: 'warning',
    });
  };

  // Save edited title
  const handleSaveEditedTitle = () => {
    if (!userCanManage || !editingLetter || !editTitleValue.trim()) return;
    const sanitized = sanitizeInputText(editTitleValue);
    setLetters((prev) =>
      prev.map((l) => (l.id === editingLetter.id ? { ...l, title: sanitized } : l))
    );
    setEditingLetter(null);
    setEditTitleValue('');
  };

  // Download letter image
  const handleDownload = (letter: CustomsLetter) => {
    const link = document.createElement('a');
    link.href = letter.imageUrl;
    const sanitizedTitle = letter.title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50);
    link.download = `${sanitizedTitle || 'نامه_گمرکی'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print letter image directly
  const handlePrint = (letter: CustomsLetter) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>${letter.title}</title>
          <style>
            @page { margin: 10mm; size: auto; }
            body { font-family: Tahoma, sans-serif; margin: 0; padding: 15px; text-align: center; background: #fff; }
            .header { margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 8px; text-align: right; }
            .title { font-size: 17px; font-weight: bold; margin-bottom: 4px; color: #000; }
            .date { font-size: 12px; color: #333; }
            img { max-width: 100%; max-height: 86vh; height: auto; object-fit: contain; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${letter.title}</div>
            <div class="date">تاریخ نامه: ${fa(letter.date?.jy || 1403)}/${fa(letter.date?.jm || 1)}/${fa(letter.date?.jd || 1)}</div>
          </div>
          <img src="${letter.imageUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Open zoom modal
  const openZoomModal = (letter: CustomsLetter) => {
    setActiveZoomLetter(letter);
    setZoomLevel(1);
    setRotation(0);
  };

  // Filter and Sort letters by search query in real time
  const filteredLetters = useMemo(() => {
    const queryNorm = normalizeFa(searchQuery);

    let result = letters.filter((letter) => {
      if (!queryNorm) return true;
      const titleNorm = normalizeFa(letter.title);
      const noteNorm = normalizeFa(letter.note || '');
      return titleNorm.includes(queryNorm) || noteNorm.includes(queryNorm);
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'fa');
      return 0;
    });

    return result;
  }, [letters, searchQuery, sortBy]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header & Controls Bar */}
      <div className="bg-[#0b1329]/80 rounded-2xl border border-cyan-500/20 p-4 sm:p-5 backdrop-blur-xl shadow-xl shadow-black/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-lalezar text-white flex items-center gap-2">
                  آرشیو اسناد و نامه‌های گمرکی
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono font-bold">
                    {fa(letters.length)} پرونده ثبت‌شده
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  فهرست عناوین نامه‌ها با قابلیت جستجوی آنی و باز شدن تصویر با کیفیت اصلی پس از کلیک
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons & Badges */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            {userCanManage ? (
              <button
                onClick={() => {
                  setNewTitle('');
                  setNewImageData(null);
                  setNewNote('');
                  setFormError(null);
                  setIsAddModalOpen(true);
                }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>افزودن نامه جدید</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/70 text-slate-300 text-xs font-medium">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>حالت بازدیدکننده (فقط مشاهده و جستجو)</span>
              </div>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors"
                title="بستن بخش"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Instant Filter Section */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی سریع در عنوان نامه‌ها... (برای جستجو تایپ کنید یا کلید / را بزنید)"
              className="w-full pr-10 pl-10 py-2.5 bg-slate-900/90 rounded-xl border border-cyan-500/30 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                title="پاک کردن جستجو"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/80 rounded-xl border border-white/10 text-xs text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span>مرتب‌سازی:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-white font-medium outline-none cursor-pointer pr-1"
              >
                <option value="newest" className="bg-slate-900 text-white">جدیدترین ثبت‌ها</option>
                <option value="oldest" className="bg-slate-900 text-white">قدیمی‌ترین‌ها</option>
                <option value="title" className="bg-slate-900 text-white">حروف الفبا (عنوان)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search Results Summary Tag */}
        {searchQuery && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 bg-cyan-950/40 px-3 py-1.5 rounded-lg border border-cyan-500/20">
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-300">نتایج جستجو برای:</span>
              <span className="text-white font-bold bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-200">
                «{searchQuery}»
              </span>
              <span className="text-slate-400 mr-2">
                ({fa(filteredLetters.length)} نامه یافت شد)
              </span>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-cyan-400 hover:text-cyan-200 underline cursor-pointer text-xs"
            >
              نمایش همه نامه‌ها
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CLASSY DOCKET CARDS GRID (باکلاس، بدون لود مستقیم عکس، کلیک برای باز شدن)  */}
      {/* ========================================================================= */}
      {filteredLetters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLetters.map((letter) => (
            <div
              key={letter.id}
              onClick={() => openZoomModal(letter)}
              className="group relative bg-[#0b1329]/90 hover:bg-[#0f1a38] rounded-2xl border border-white/10 hover:border-amber-400/60 p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-lg shadow-black/40 hover:shadow-amber-500/10 hover:-translate-y-0.5 flex flex-col justify-between"
            >
              {/* Top Row: Official Seal Badge & Meta */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      سند گمرکی
                    </span>
                  </div>

                  {/* Date Badge */}
                  {letter.date && (
                    <div className="flex items-center gap-1 text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-white/5 text-[11px] font-mono">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      <span>
                        {fa(letter.date.jy)}/{fa(letter.date.jm)}/{fa(letter.date.jd)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Primary Letter Title (عنوان باکلاس و برجسته) */}
                <h3
                  className="text-sm sm:text-base font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-relaxed mb-2"
                  title={letter.title}
                >
                  {letter.title}
                </h3>

                {/* Optional Note / Reference */}
                {letter.note ? (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3 bg-white/5 p-2 rounded-lg border border-white/5 leading-relaxed">
                    {letter.note}
                  </p>
                ) : (
                  <div className="h-2" />
                )}
              </div>

              {/* Bottom Action Row: View Button & Administrative Tools */}
              <div
                className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Main "View & Zoom" Button */}
                <button
                  type="button"
                  onClick={() => openZoomModal(letter)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 hover:from-amber-500 hover:to-orange-500 border border-amber-400/30 hover:border-amber-400 text-amber-300 hover:text-slate-950 font-bold text-xs transition-all duration-200 cursor-pointer shadow-sm active:scale-98"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>مشاهده و بزرگنمایی تصویر</span>
                </button>

                {/* Quick Print & Download */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDownload(letter)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                    title="دانلود فایل تصویر"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit & Delete (Admin Only) */}
                  {userCanManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLetter(letter);
                          setEditTitleValue(letter.title);
                        }}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-300 transition-colors"
                        title="ویرایش عنوان نامه"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(letter.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                        title="حذف این نامه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : letters.length === 0 ? (
        /* Empty State */
        <div className="bg-[#0b1329]/60 rounded-2xl border border-dashed border-cyan-500/30 p-8 sm:p-12 text-center backdrop-blur-xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
            <FileCheck2 className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-lalezar text-white mb-2">
            هنوز نامه‌ای در آرشیو ثبت نشده است
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            {userCanManage
              ? 'تصویر نامه گمرکی خود را با یک عنوان مشخص آپلود کنید تا در قالب پرونده‌های منظم ثبت و با یک جستجوی ساده قابل دسترسی باشد.'
              : 'درحال حاضر نامه‌ای توسط مدیر سیستم بارگذاری نشده است.'}
          </p>
          {userCanManage && (
            <button
              onClick={() => {
                setNewTitle('');
                setNewImageData(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>افزودن اولین نامه</span>
            </button>
          )}
        </div>
      ) : (
        /* No Search Results */
        <div className="bg-[#0b1329]/60 rounded-2xl border border-white/10 p-8 text-center backdrop-blur-xl">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-400/70 mb-3" />
          <h3 className="text-base font-bold text-white mb-1.5">
            هیچ نامه‌ای با عنوان «{searchQuery}» پیدا نشد!
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            کلمه دیگری را جستجو کنید یا دکمه زیر را برای نمایش همه نامه‌ها بزنید.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              searchInputRef.current?.focus();
            }}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            پاک کردن عبارت جستجو
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HIGH-RES LIGHTBOX / FULLSCREEN VIEWER (عکس بزرگ و امکان بزرگنمایی)         */}
      {/* ========================================================================= */}
      {activeZoomLetter && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setActiveZoomLetter(null)}
        >
          {/* Lightbox Top Toolbar */}
          <div
            className="p-3 sm:p-4 bg-[#090f21]/95 border-b border-white/10 flex items-center justify-between text-white z-10 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title & Date */}
            <div className="flex items-center gap-2.5 overflow-hidden max-w-[50%]">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <h3 className="text-sm sm:text-base font-bold text-white truncate" title={activeZoomLetter.title}>
                  {activeZoomLetter.title}
                </h3>
                {activeZoomLetter.date && (
                  <span className="text-xs text-slate-400 font-mono">
                    تاریخ نامه: {fa(activeZoomLetter.date.jy)}/{fa(activeZoomLetter.date.jm)}/{fa(activeZoomLetter.date.jd)}
                  </span>
                )}
              </div>
            </div>

            {/* Viewer Zoom & Manipulation Controls */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setZoomLevel((prev) => Math.min(prev + 0.25, 4))}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                title="بزرگ‌نمایی (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono px-2 py-1 bg-white/5 rounded-lg text-amber-300 min-w-[50px] text-center hidden sm:inline-block">
                {fa(Math.round(zoomLevel * 100))}%
              </span>

              <button
                onClick={() => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5))}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                title="کوچک‌نمایی (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                title="چرخش ۹۰ درجه (R)"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                title="بازنشانی زوم و چرخش (0)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-white/15 mx-1" />

              <button
                onClick={() => handlePrint(activeZoomLetter)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                title="چاپ تصویر نامه"
              >
                <Printer className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDownload(activeZoomLetter)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                title="دانلود تصویر با کیفیت اصلی"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveZoomLetter(null)}
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors mr-1"
                title="بستن (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Image Canvas */}
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-auto select-none"
            onClick={() => setActiveZoomLetter(null)}
          >
            <div
              className="transition-transform duration-150 max-w-full max-h-full flex items-center justify-center cursor-zoom-in"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setZoomLevel((prev) => (prev > 1 ? 1 : 2));
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={activeZoomLetter.imageUrl}
                alt={activeZoomLetter.title}
                className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border border-white/15"
                draggable={false}
              />
            </div>
          </div>

          {/* Bottom Hint Bar */}
          <div
            className="py-2.5 px-4 bg-[#090f21]/95 border-t border-white/10 flex items-center justify-between text-xs text-slate-400"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">راهنما:</span>
              <span>برای بزرگ‌نمایی از دکمه‌های بالا یا دوبار کلیک استفاده کنید • کلید Esc برای خروج</span>
            </div>
            {activeZoomLetter.note && (
              <span className="text-slate-300 truncate max-w-md">
                یادداشت: {activeZoomLetter.note}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD NEW LETTER MODAL (ADMIN ONLY)                                         */}
      {/* ========================================================================= */}
      {isAddModalOpen && userCanManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
          <div
            className="bg-[#0c142b] w-full max-w-xl rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#080d1e]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-lalezar text-white">افزودن عکس نامه جدید</h3>
                  <p className="text-xs text-slate-400">عکس نامه را وارد کرده و یک عنوان برای آن مشخص کنید</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveLetter} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title Field (Essential) */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  عنوان نامه <span className="text-rose-400">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثلاً: تقاضای تمدید مهلت انبارداری کوتاژ ۴۷۸۹۵۲۱۰"
                  className="w-full px-3.5 py-2.5 bg-slate-900/90 rounded-xl border border-white/15 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-white placeholder-slate-500 text-sm outline-none transition-all"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  این عنوان برای جستجو و یافتن سریع نامه به کار می‌رود.
                </span>
              </div>

              {/* Image Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  تصویر یا اسکن نامه <span className="text-rose-400">*</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {newImageData ? (
                  /* Image Selected Preview */
                  <div className="relative rounded-xl border border-amber-500/40 bg-slate-950 p-2 overflow-hidden flex flex-col items-center">
                    <img
                      src={newImageData.url}
                      alt="پیش‌نمایش نامه"
                      className="max-h-60 w-auto object-contain rounded-lg shadow-md"
                    />
                    <div className="w-full mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 px-1">
                      <span className="truncate max-w-[200px]" title={newImageData.name}>
                        {newImageData.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {fa(newImageData.sizeKb)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-amber-300 text-xs transition-colors"
                        >
                          تغییر عکس
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewImageData(null)}
                          className="p-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                          title="حذف تصویر"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Dropzone */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2.5 ${
                      isDragOver
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-white/15 hover:border-amber-400/60 bg-slate-900/60 hover:bg-slate-900/90'
                    }`}
                  >
                    {isProcessingImage ? (
                      <div className="py-4 text-xs text-amber-300 flex items-center gap-2">
                        <span className="animate-spin">⌛</span>
                        <span>در حال بهینه‌سازی و ذخیره تصویر...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white mb-0.5">
                            عکس نامه را اینجا بکشید یا برای انتخاب کلیک کنید
                          </p>
                          <p className="text-xs text-slate-400">
                            فرمت‌های JPG, PNG, WebP • یا تصویر را در کلیپ‌بورد کپی و با Ctrl+V پیست کنید
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Date & Optional Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    تاریخ نامه (اختیاری)
                  </label>
                  <JalaliDatePicker value={newDate} onChange={setNewDate} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    یادداشت یا شماره کوتاژ (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="مثلاً: ارجاع به رئیس سرویس ارزیابی"
                    className="w-full px-3 py-2 bg-slate-900/90 rounded-xl border border-white/10 text-white placeholder-slate-500 text-xs outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isProcessingImage || !newTitle.trim() || !newImageData}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>ذخیره نامه</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT TITLE MODAL (ADMIN ONLY)                                             */}
      {/* ========================================================================= */}
      {editingLetter && userCanManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0c142b] w-full max-w-md rounded-2xl border border-white/15 p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>ویرایش عنوان نامه</span>
            </h3>

            <input
              type="text"
              value={editTitleValue}
              onChange={(e) => setEditTitleValue(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 rounded-xl border border-white/20 focus:border-amber-400 text-white text-sm outline-none"
              placeholder="عنوان جدید نامه..."
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingLetter(null)}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
              >
                انصراف
              </button>
              <button
                onClick={handleSaveEditedTitle}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL (ADMIN ONLY)                                    */}
      {/* ========================================================================= */}
      {deleteConfirmId && userCanManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0c142b] w-full max-w-sm rounded-2xl border border-rose-500/30 p-5 shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">آیا از حذف این نامه مطمئن هستید؟</h3>
            <p className="text-xs text-slate-400">
              این سند از آرشیو نامه‌های شما حذف خواهد شد و قابل بازگشت نیست.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
              >
                انصراف
              </button>
              <button
                onClick={() => handleDeleteLetter(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-600/20"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
