import { useEffect, useRef, useState, KeyboardEvent, MouseEvent } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      if (inputRef.current && 'select' in inputRef.current && !multiline) {
        inputRef.current.select();
      }
    }
  }, [isEditing, multiline]);

  if (!canEdit) {
    return <Component className={className}>{value}</Component>;
  }

  const startEdit = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraft(value);
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = (e?: MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDraft(value);
    setError(null);
    setIsEditing(false);
  };

  const commitEdit = async (e?: MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Teks tidak boleh kosong.');
      return;
    }
    if (trimmed === value.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed.slice(0, maxLength));
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
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      void commitEdit();
    } else if (multiline && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void commitEdit();
    }
  };

  if (isEditing) {
    return (
      <span
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="no-print inline-flex w-full max-w-full flex-col gap-1.5 align-middle"
      >
        <span className="flex w-full items-start gap-1.5">
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              maxLength={maxLength}
              rows={3}
              disabled={isSaving}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full rounded-lg border border-blue-500 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-900 shadow-xs focus:outline-none dark:border-blue-400 dark:bg-slate-950 dark:text-slate-100 ${inputClassName}`}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={draft}
              maxLength={maxLength}
              disabled={isSaving}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full min-w-[140px] rounded-lg border border-blue-500 bg-white px-2.5 py-1 text-sm font-normal text-slate-900 shadow-xs focus:outline-none dark:border-blue-400 dark:bg-slate-950 dark:text-slate-100 ${inputClassName}`}
            />
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={(e) => void commitEdit(e)}
            aria-label="Simpan teks"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={cancelEdit}
            aria-label="Batal edit"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
        {error && (
          <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <Component
      onClick={startEdit}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ? `${ariaLabel} (klik untuk edit)` : 'Klik untuk edit teks'}
      title="Klik untuk mengedit teks ini"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setDraft(value);
          setError(null);
          setIsEditing(true);
        }
      }}
      className={`group/edit relative inline cursor-pointer rounded-sm transition-colors hover:bg-blue-500/10 hover:outline-1 hover:outline-dashed hover:outline-blue-500/70 ${className}`}
    >
      {value}
      <Pencil
        className="no-print ml-1.5 inline-block h-3 w-3 text-blue-600 opacity-45 transition-opacity group-hover/edit:opacity-100 dark:text-blue-400"
        aria-hidden="true"
      />
    </Component>
  );
}
