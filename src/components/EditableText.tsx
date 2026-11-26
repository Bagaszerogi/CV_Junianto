import { useCallback, useEffect, useRef, useState, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  GripHorizontal,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  X,
} from 'lucide-react';

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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const [boxPos, setBoxPos] = useState({ top: 80, left: 24 });
  const [boxSize, setBoxSize] = useState({ width: 380, height: 84 });

  const triggerRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousSizeRef = useRef<{ width: number; height: number } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  const computeInitialLayout = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = triggerRef.current?.getBoundingClientRect();

    const estimatedTextWidth = Math.min(680, Math.max(320, value.length * 8.5 + 96));
    const initialWidth = Math.min(
      vw - 24,
      Math.max(MIN_WIDTH, rect ? Math.max(rect.width + 120, estimatedTextWidth) : estimatedTextWidth)
    );

    const estimatedRows = Math.max(
      multiline ? 3 : 1,
      Math.min(8, Math.ceil((value.length * 8.5) / Math.max(240, initialWidth - 36)))
    );
    const initialHeight = multiline || value.length > 70
      ? Math.max(108, Math.min(260, estimatedRows * 24 + 28))
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
    setDraft(value);
    setError(null);
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

  const cancelEdit = useCallback((e?: MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDraft(value);
    setError(null);
    setIsEditing(false);
  }, [value]);

  const commitEdit = useCallback(async (e?: MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const normalized = multiline ? draft.trim() : draft.replace(/\s+/g, ' ').trim();
    const currentNormalized = multiline ? value.trim() : value.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      setError('Teks tidak boleh kosong.');
      return;
    }
    if (normalized === currentNormalized) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(normalized.slice(0, maxLength));
      setIsEditing(false);
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  }, [draft, maxLength, multiline, onSave, value]);

  useEffect(() => {
    if (!isEditing) return;
    const handleWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [cancelEdit, isEditing]);

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
        const nextTop = Math.max(8, Math.min(startPos.top + dy, vh - Math.min(startSize.height + 92, vh - 24)));
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
      const targetWidth = Math.min(820, vw - 24);
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
    return <Component className={className}>{value}</Component>;
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
      cancelEdit();
    } else if (!multiline && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      void commitEdit();
    } else if (multiline && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      void commitEdit();
    }
  };

  const floatingEditor =
    isEditing && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-label={ariaLabel ? `Edit ${ariaLabel}` : 'Edit teks'}
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
            className="no-print fixed z-[9999] flex flex-col rounded-2xl border border-[var(--brass)] bg-[var(--bg2)] text-[var(--ink)] shadow-2xl ring-4 ring-[color-mix(in_srgb,var(--brass)_18%,transparent)]"
          >
            {/* Top drag bar (drop & tarik posisi) */}
            <div
              onPointerDown={startPointerInteraction('move')}
              title="Tarik untuk memindahkan kotak edit"
              className="flex cursor-grab items-center justify-between gap-2 rounded-t-2xl border-b border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 active:cursor-grabbing"
            >
              <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[var(--mute)]">
                <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--brass)]" aria-hidden="true" />
                <span className="truncate">
                  Tarik tepi kanan / sudut untuk perlebar ({boxSize.width}px)
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

            {/* Editable textarea + right/bottom/corner drag handles */}
            <div className="relative p-2.5 pr-4 pb-3.5">
              <textarea
                ref={textareaRef}
                value={draft}
                maxLength={maxLength}
                disabled={isSaving}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ height: `${boxSize.height}px` }}
                className={`w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm leading-relaxed font-normal text-[var(--ink)] shadow-inner focus:border-[var(--brass)] focus:outline-none ${inputClassName}`}
              />

              {/* Right edge resize handle */}
              <div
                onPointerDown={startPointerInteraction('resize-right')}
                title="Tarik ke kanan / kiri untuk memperlebar"
                aria-label="Tarik untuk memperlebar"
                className="group/rh absolute top-2.5 right-0.5 bottom-4 flex w-3 cursor-ew-resize items-center justify-center touch-none"
              >
                <span className="h-8 w-1 rounded-full bg-[var(--line)] transition-colors group-hover/rh:bg-[var(--brass)]" />
              </div>

              {/* Bottom edge resize handle */}
              <div
                onPointerDown={startPointerInteraction('resize-bottom')}
                title="Tarik ke atas / bawah untuk memperpanjang"
                aria-label="Tarik untuk memperpanjang"
                className="group/bh absolute right-4 bottom-0.5 left-2.5 flex h-3 cursor-ns-resize items-center justify-center touch-none"
              >
                <span className="h-1 w-10 rounded-full bg-[var(--line)] transition-colors group-hover/bh:bg-[var(--brass)]" />
              </div>

              {/* Bottom-right corner resize handle */}
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

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-[var(--line)] bg-[var(--bg)] px-3 py-2">
              <div className="min-w-0 flex-1">
                {error ? (
                  <p className="truncate text-[11px] font-medium text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--mute)]">
                    {draft.length}/{maxLength} · {multiline ? 'Ctrl+Enter simpan' : 'Enter simpan'} · Esc batal
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Batal</span>
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={(e) => void commitEdit(e)}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--brass)] px-3.5 py-1.5 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Simpan</span>
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
        title="Klik untuk edit teks (bisa tarik untuk perlebar)"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openEditor();
          }
        }}
        className={`group/edit relative inline cursor-pointer rounded-sm transition-colors ${
          isEditing
            ? 'bg-[color-mix(in_srgb,var(--brass)_20%,transparent)] outline-2 outline-[var(--brass)]'
            : 'hover:bg-[color-mix(in_srgb,var(--brass)_12%,transparent)] hover:outline-1 hover:outline-dashed hover:outline-[var(--brass)]'
        } ${className}`}
      >
        {value}
        <Pencil
          className={`no-print ml-1.5 inline-block h-3 w-3 text-[var(--brass)] transition-opacity ${
            isEditing ? 'opacity-100' : 'opacity-50 group-hover/edit:opacity-100'
          }`}
          aria-hidden="true"
        />
      </Component>
      {floatingEditor}
    </>
  );
}
