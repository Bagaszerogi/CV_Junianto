import { useCallback, useEffect, useRef, useState, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckCircle2,
  GripHorizontal,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { formatReadableFirestoreError } from '../firebase';

interface EditableTextProps {
  value: string;
  canEdit: boolean;
  onSave: (nextValue: string) => Promise<void> | void;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div';
  ariaLabel?: string;
}

type DragMode = 'move' | 'resize-right' | 'resize-bottom' | 'resize-corner';
type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const MIN_WIDTH = 220;
const MIN_HEIGHT = 48;

export function EditableText({
  value,
  canEdit,
  onSave,
  multiline = false,
  maxLength = 500,
  placeholder,
  className = '',
  inputClassName = '',
  as: Component = 'span',
  ariaLabel,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const [boxPos, setBoxPos] = useState({ top: 80, left: 24 });
  const [boxSize, setBoxSize] = useState({ width: 380, height: 84 });

  const triggerRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousSizeRef = useRef<{ width: number; height: number } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const initialValueRef = useRef(value);
  const lastSavedValueRef = useRef(value);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
      lastSavedValueRef.current = value;
    }
  }, [value, isEditing]);

  const normalizeText = useCallback(
    (raw: string) =>
      (multiline ? raw.trim() : raw.replace(/\s+/g, ' ').trim()).slice(0, maxLength),
    [maxLength, multiline]
  );

  const persistDraftNow = useCallback(
    async (rawDraft: string) => {
      const normalized = normalizeText(rawDraft);
      const lastNormalized = normalizeText(lastSavedValueRef.current);

      if (!normalized) {
        setError('Teks tidak boleh kosong.');
        setAutoSaveStatus('error');
        return false;
      }
      if (normalized === lastNormalized) {
        setError(null);
        return true;
      }

      setAutoSaveStatus('saving');
      setError(null);
      try {
        await onSaveRef.current(normalized);
        lastSavedValueRef.current = normalized;
        setAutoSaveStatus('saved');
        return true;
      } catch (err) {
        setError(formatReadableFirestoreError(err));
        setAutoSaveStatus('error');
        return false;
      }
    },
    [normalizeText]
  );

  // Debounced live auto-save while typing
  useEffect(() => {
    if (!isEditing) return;

    const normalized = normalizeText(draft);
    const lastNormalized = normalizeText(lastSavedValueRef.current);

    if (!normalized) {
      setError('Teks tidak boleh kosong.');
      setAutoSaveStatus('error');
      return;
    }

    setError(null);
    if (normalized === lastNormalized) {
      return;
    }

    setAutoSaveStatus('pending');
    const timer = window.setTimeout(() => {
      void persistDraftNow(draft);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [draft, isEditing, normalizeText, persistDraftNow]);

  const computeInitialLayout = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = triggerRef.current?.getBoundingClientRect();

    const estimatedTextWidth = Math.min(640, Math.max(300, value.length * 8.2 + 96));
    const initialWidth = Math.min(
      vw - 24,
      Math.max(MIN_WIDTH, rect ? Math.max(rect.width + 100, estimatedTextWidth) : estimatedTextWidth)
    );

    const estimatedRows = Math.max(
      multiline ? 3 : 1,
      Math.min(8, Math.ceil((value.length * 8.2) / Math.max(220, initialWidth - 36)))
    );
    const initialHeight =
      multiline || value.length > 70
        ? Math.max(104, Math.min(240, estimatedRows * 24 + 28))
        : Math.max(54, estimatedRows * 24 + 22);

    const estimatedTotalHeight = initialHeight + 96;

    let left = rect ? rect.left : Math.round((vw - initialWidth) / 2);
    left = Math.max(12, Math.min(left, vw - initialWidth - 12));

    let top = rect ? rect.bottom + 8 : Math.round((vh - estimatedTotalHeight) / 2);
    if (top + estimatedTotalHeight > vh - 12 && rect && rect.top - estimatedTotalHeight - 8 >= 12) {
      top = rect.top - estimatedTotalHeight - 8;
    }
    top = Math.max(12, Math.min(top, Math.max(12, vh - estimatedTotalHeight - 12)));

    setBoxPos({ top: Math.round(top), left: Math.round(left) });
    setBoxSize({ width: Math.round(initialWidth), height: Math.round(initialHeight) });
    setIsExpanded(false);
    previousSizeRef.current = null;
  }, [multiline, value]);

  const openEditor = useCallback(() => {
    initialValueRef.current = value;
    lastSavedValueRef.current = value;
    setDraft(value);
    setError(null);
    setAutoSaveStatus('idle');
    computeInitialLayout();
    setIsEditing(true);
  }, [computeInitialLayout, value]);

  useEffect(() => {
    if (isEditing) {
      const id = window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
        if (textareaRef.current && !multiline) {
          textareaRef.current.select();
        } else if (textareaRef.current) {
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [isEditing, multiline]);

  const closeAndFlushEdit = useCallback(
    async (e?: MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const normalized = normalizeText(draft);
      if (!normalized) {
        setError('Teks tidak boleh kosong.');
        return;
      }
      if (normalized !== normalizeText(lastSavedValueRef.current)) {
        const ok = await persistDraftNow(draft);
        if (!ok) return;
      }
      setError(null);
      setIsEditing(false);
    },
    [draft, normalizeText, persistDraftNow]
  );

  const revertAndClose = useCallback(
    async (e?: MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const initialNormalized = normalizeText(initialValueRef.current);
      if (initialNormalized && initialNormalized !== normalizeText(lastSavedValueRef.current)) {
        await persistDraftNow(initialNormalized);
      }
      setDraft(initialValueRef.current);
      setError(null);
      setAutoSaveStatus('idle');
      setIsEditing(false);
    },
    [normalizeText, persistDraftNow]
  );

  // Close & auto-flush when clicking outside floating editor
  useEffect(() => {
    if (!isEditing) return;
    const handleOutsideDown = (e: globalThis.MouseEvent) => {
      const target = e.target as Node | null;
      if (editorRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      const normalized = normalizeText(draft);
      if (normalized) {
        void closeAndFlushEdit();
      } else {
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideDown);
    return () => document.removeEventListener('mousedown', handleOutsideDown);
  }, [closeAndFlushEdit, draft, isEditing, normalizeText]);

  useEffect(() => {
    if (!isEditing) return;
    const handleWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void revertAndClose();
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [isEditing, revertAndClose]);

  useEffect(() => {
    if (!isEditing) return;
    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setBoxPos((prev) => ({
        left: Math.max(12, Math.min(prev.left, vw - MIN_WIDTH - 12)),
        top: Math.max(12, Math.min(prev.top, vh - 140)),
      }));
      setBoxSize((prev) => ({
        width: Math.min(prev.width, vw - 24),
        height: Math.min(prev.height, vh - 120),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isEditing]);

  const startPointerInteraction = (mode: DragMode) => (e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...boxPos };
    const startSize = { ...boxSize };
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (mode === 'move') {
        const nextLeft = Math.max(8, Math.min(startPos.left + dx, vw - startSize.width - 8));
        const nextTop = Math.max(
          8,
          Math.min(startPos.top + dy, vh - Math.min(startSize.height + 92, vh - 24))
        );
        setBoxPos({ top: Math.round(nextTop), left: Math.round(nextLeft) });
        return;
      }

      if (mode === 'resize-right' || mode === 'resize-corner') {
        const maxWidth = Math.max(MIN_WIDTH, vw - startPos.left - 12);
        const nextWidth = Math.max(MIN_WIDTH, Math.min(startSize.width + dx, maxWidth));
        setBoxSize((prev) => ({ ...prev, width: Math.round(nextWidth) }));
        setIsExpanded(false);
      }

      if (mode === 'resize-bottom' || mode === 'resize-corner') {
        const maxHeight = Math.max(MIN_HEIGHT, vh - startPos.top - 104);
        const nextHeight = Math.max(MIN_HEIGHT, Math.min(startSize.height + dy, maxHeight));
        setBoxSize((prev) => ({ ...prev, height: Math.round(nextHeight) }));
        setIsExpanded(false);
      }
    };

    const stopPointer = () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopPointer);
      window.removeEventListener('pointercancel', stopPointer);
      dragCleanupRef.current = null;
    };

    dragCleanupRef.current = stopPointer;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopPointer);
    window.addEventListener('pointercancel', stopPointer);
  };

  const toggleExpandWidth = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!isExpanded) {
      previousSizeRef.current = { ...boxSize };
      const targetWidth = Math.min(780, vw - 24);
      const targetHeight = Math.min(320, Math.max(boxSize.height, multiline ? 180 : 96));
      setBoxPos((prev) => ({
        left: Math.max(12, Math.min(prev.left, vw - targetWidth - 12)),
        top: Math.max(12, Math.min(prev.top, Math.max(12, vh - targetHeight - 110))),
      }));
      setBoxSize({ width: Math.round(targetWidth), height: Math.round(targetHeight) });
      setIsExpanded(true);
    } else if (previousSizeRef.current) {
      setBoxSize(previousSizeRef.current);
      setIsExpanded(false);
    }
  };

  if (!canEdit) {
    return (
      <Component className={`max-w-full [overflow-wrap:anywhere] ${className}`}>
        {value}
      </Component>
    );
  }

  const startEdit = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openEditor();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      void revertAndClose();
    } else if (!multiline && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      void closeAndFlushEdit();
    } else if (multiline && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      void closeAndFlushEdit();
    }
  };

  const floatingEditor =
    isEditing && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={editorRef}
            role="dialog"
            aria-label={ariaLabel ? `Edit ${ariaLabel}` : 'Edit teks otomatis'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              top: `${boxPos.top}px`,
              left: `${boxPos.left}px`,
              width: `${boxSize.width}px`,
            }}
            className="no-print fixed z-[9999] flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-[var(--brass)] bg-[var(--bg2)] text-[var(--ink)] shadow-2xl ring-4 ring-[color-mix(in_srgb,var(--brass)_18%,transparent)]"
          >
            {/* Top drag bar */}
            <div
              onPointerDown={startPointerInteraction('move')}
              title="Tarik untuk memindahkan kotak edit"
              className="flex cursor-grab items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 active:cursor-grabbing"
            >
              <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[var(--mute)]">
                <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--brass)]" aria-hidden="true" />
                <span className="truncate">
                  Auto-Save · Tarik tepi untuk perlebar ({boxSize.width}px)
                </span>
              </div>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggleExpandWidth}
                title={isExpanded ? 'Kembalikan ukuran' : 'Perlebar maksimal'}
                aria-label={isExpanded ? 'Kembalikan ukuran' : 'Perlebar maksimal'}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--mute)] hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Editable textarea + resize handles */}
            <div className="relative p-2.5 pr-4 pb-3.5">
              <textarea
                ref={textareaRef}
                value={draft}
                maxLength={maxLength}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ height: `${boxSize.height}px` }}
                className={`w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm leading-relaxed font-normal text-[var(--ink)] shadow-inner focus:border-[var(--brass)] focus:outline-none ${inputClassName}`}
              />

              <div
                onPointerDown={startPointerInteraction('resize-right')}
                title="Tarik ke kanan / kiri untuk memperlebar"
                aria-label="Tarik untuk memperlebar"
                className="group/rh absolute top-2.5 right-0.5 bottom-4 flex w-3 cursor-ew-resize items-center justify-center touch-none"
              >
                <span className="h-8 w-1 rounded-full bg-[var(--line)] transition-colors group-hover/rh:bg-[var(--brass)]" />
              </div>

              <div
                onPointerDown={startPointerInteraction('resize-bottom')}
                title="Tarik ke atas / bawah untuk memperpanjang"
                aria-label="Tarik untuk memperpanjang"
                className="group/bh absolute right-4 bottom-0.5 left-2.5 flex h-3 cursor-ns-resize items-center justify-center touch-none"
              >
                <span className="h-1 w-10 rounded-full bg-[var(--line)] transition-colors group-hover/bh:bg-[var(--brass)]" />
              </div>

              <div
                onPointerDown={startPointerInteraction('resize-corner')}
                title="Tarik sudut untuk perlebar & perpanjang"
                aria-label="Tarik sudut untuk mengubah ukuran"
                className="group/ch absolute right-1 bottom-1 flex h-4 w-4 cursor-nwse-resize items-end justify-end rounded-br-md p-0.5 touch-none"
              >
                <svg
                  viewBox="0 0 12 12"
                  className="h-3 w-3 text-[var(--mute)] transition-colors group-hover/ch:text-[var(--brass)]"
                  aria-hidden="true"
                >
                  <path
                    d="M11 1L1 11M11 5L5 11M11 9L9 11"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Footer auto-save status & quick actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--bg)] px-3 py-2">
              <div className="min-w-0 flex-1">
                {error ? (
                  <p className="break-words whitespace-normal text-[11px] font-medium text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ) : autoSaveStatus === 'saving' ? (
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--brass)]">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    <span>Menyimpan otomatis...</span>
                  </p>
                ) : autoSaveStatus === 'saved' ? (
                  <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    <span>Tersimpan otomatis · {draft.length}/{maxLength}</span>
                  </p>
                ) : autoSaveStatus === 'pending' ? (
                  <p className="text-[11px] text-[var(--brass)]">
                    Menyimpan sebentar lagi... ({draft.length}/{maxLength})
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--mute)]">
                    {draft.length}/{maxLength} · Auto-save aktif
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {normalizeText(draft) !== normalizeText(initialValueRef.current) && (
                  <button
                    type="button"
                    onClick={(e) => void revertAndClose(e)}
                    title="Kembalikan teks awal (Esc)"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg2)] px-2.5 py-1 text-[11px] font-medium text-[var(--mute)] hover:border-[var(--brass)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>Reset</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => void closeAndFlushEdit(e)}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--brass)] px-3 py-1 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Selesai</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <Component
        ref={triggerRef as never}
        onClick={startEdit}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel ? `${ariaLabel} (klik untuk edit)` : 'Klik untuk edit teks'}
        title="Klik untuk edit teks (tersimpan otomatis)"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openEditor();
          }
        }}
        className={`group/edit relative inline max-w-full cursor-pointer rounded-sm transition-colors [overflow-wrap:anywhere] ${
          isEditing
            ? 'bg-[color-mix(in_srgb,var(--brass)_20%,transparent)] outline-2 outline-[var(--brass)]'
            : 'hover:bg-[color-mix(in_srgb,var(--brass)_12%,transparent)] hover:outline-1 hover:outline-dashed hover:outline-[var(--brass)]'
        } ${className}`}
      >
        {value}
        <Pencil
          className={`no-print ml-1.5 inline-block h-3 w-3 shrink-0 text-[var(--brass)] transition-opacity ${
            isEditing ? 'opacity-100' : 'opacity-50 group-hover/edit:opacity-100'
          }`}
          aria-hidden="true"
        />
      </Component>
      {floatingEditor}
    </>
  );
}
