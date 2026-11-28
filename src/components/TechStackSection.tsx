import { FormEvent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Locale, TechCategory, UI_COPY } from '../data/cvData';
import {
  deleteTechStackFromFirestore,
  FirestoreTechCategory,
  saveTechStackToFirestore,
  SiteCopyLocale,
  subscribeTechStacks,
} from '../utils/cvFirestoreApi';
import { formatReadableFirestoreError } from '../firebase';
import { EditableText } from './EditableText';

interface TechStackSectionProps {
  locale: Locale;
  authReady: boolean;
  isAdminUser: boolean;
  siteCopy: SiteCopyLocale;
  invitedItems?: FirestoreTechCategory[];
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
}

type StackFilter = 'all' | TechCategory['group'];

export function TechStackSection({
  locale,
  authReady,
  isAdminUser,
  siteCopy,
  invitedItems,
  onSaveSiteCopyField,
}: TechStackSectionProps) {
  const [categories, setCategories] = useState<FirestoreTechCategory[]>(invitedItems ?? []);
  const [groupFilter, setGroupFilter] = useState<StackFilter>('all');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Admin modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FirestoreTechCategory | null>(null);
  const [group, setGroup] = useState<TechCategory['group']>('core');
  const [label, setLabel] = useState('');
  const [labelId, setLabelId] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'invalid'>('idle');

  const editingItemRef = useRef<FirestoreTechCategory | null>(null);
  const lastSavedDigestRef = useRef('');
  const autoSaveTimerRef = useRef<number | null>(null);

  const t = UI_COPY[locale].sections;

  useEffect(() => {
    if (!isAdminUser && invitedItems) {
      setCategories(invitedItems);
      setLoadError(null);
      return;
    }
    if (!authReady || !isAdminUser) return;
    const unsubscribe = subscribeTechStacks(
      (items) => {
        setCategories(items);
        setLoadError(null);
      },
      (err) => {
        setLoadError(formatReadableFirestoreError(err));
      }
    );
    return () => unsubscribe();
  }, [authReady, invitedItems, isAdminUser]);

  const visibleCategories = categories.filter((cat) =>
    groupFilter === 'all' ? true : cat.group === groupFilter
  );

  const marqueeItems = Array.from(
    new Set(categories.flatMap((c) => c.items).filter(Boolean))
  );

  const filterKeys: StackFilter[] = ['all', 'core', 'infra', 'guest', 'productivity'];

  const handleCardPointerMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    el.style.setProperty('--mx', `${x.toFixed(1)}%`);
    el.style.setProperty('--my', `${y.toFixed(1)}%`);
  };

  const buildStackPayload = useCallback(
    (itemId: string) => {
      const items = itemsText
        .split(',')
        .map((s) => s.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 40);
      const clampedOrder = Math.min(1000, Math.max(0, Math.round(Number(sortOrder) || 0)));
      const cleanLabel = label.trim().slice(0, 100);
      const cleanLabelId = (labelId || label).trim().slice(0, 100);
      const isValid = cleanLabel.length >= 1 && items.length >= 1;
      const payload = {
        id: itemId,
        group,
        label: cleanLabel,
        labelId: cleanLabelId,
        items,
        sortOrder: clampedOrder,
      };
      const digest = JSON.stringify(payload);
      return { isValid, payload, digest };
    },
    [group, itemsText, label, labelId, sortOrder]
  );

  const openAddModal = () => {
    editingItemRef.current = null;
    lastSavedDigestRef.current = '';
    setEditingItem(null);
    setGroup('core');
    setLabel('');
    setLabelId('');
    setItemsText('');
    setSortOrder(categories.length);
    setFormError(null);
    setAutoSaveState('idle');
    setIsModalOpen(true);
  };

  const openEditModal = (item: FirestoreTechCategory) => {
    editingItemRef.current = item;
    const initialDigest = JSON.stringify({
      id: item.id,
      group: item.group,
      label: item.label.trim().slice(0, 100),
      labelId: (item.labelId || item.label).trim().slice(0, 100),
      items: item.items.map((s) => s.trim().slice(0, 100)).filter(Boolean).slice(0, 40),
      sortOrder: Math.min(1000, Math.max(0, Math.round(Number(item.sortOrder) || 0))),
    });
    lastSavedDigestRef.current = initialDigest;
    setEditingItem(item);
    setGroup(item.group);
    setLabel(item.label);
    setLabelId(item.labelId);
    setItemsText(item.items.join(', '));
    setSortOrder(item.sortOrder);
    setFormError(null);
    setAutoSaveState('idle');
    setIsModalOpen(true);
  };

  const persistStackEdit = useCallback(async () => {
    const current = editingItemRef.current;
    if (!current) return;
    const { isValid, payload, digest } = buildStackPayload(current.id);
    if (!isValid) {
      setAutoSaveState('invalid');
      return;
    }
    if (digest === lastSavedDigestRef.current) return;

    setAutoSaveState('saving');
    setFormError(null);
    try {
      await saveTechStackToFirestore(payload, Boolean(current.fromFirestore));
      lastSavedDigestRef.current = digest;
      const updated = { ...payload, fromFirestore: true };
      editingItemRef.current = updated;
      setEditingItem(updated);
      setAutoSaveState('saved');
    } catch (err) {
      setFormError(formatReadableFirestoreError(err));
      setAutoSaveState('idle');
    }
  }, [buildStackPayload]);

  useEffect(() => {
    if (!isModalOpen || !editingItemRef.current) return;
    const { isValid, digest } = buildStackPayload(editingItemRef.current.id);
    if (!isValid) {
      setAutoSaveState('invalid');
      return;
    }
    if (digest === lastSavedDigestRef.current) return;

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistStackEdit();
    }, 480);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [buildStackPayload, isModalOpen, persistStackEdit]);

  const closeModal = () => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (editingItemRef.current) {
      void persistStackEdit();
    }
    editingItemRef.current = null;
    setEditingItem(null);
    setIsModalOpen(false);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (editingItemRef.current) {
      await persistStackEdit();
      return;
    }
    setFormError(null);

    const newId = `stack_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { isValid, payload } = buildStackPayload(newId);

    if (!isValid) {
      setFormError(
        locale === 'en'
          ? 'Category label and at least one tool are required.'
          : 'Nama kategori dan minimal satu teknologi wajib diisi.'
      );
      return;
    }

    setIsSaving(true);
    try {
      await saveTechStackToFirestore(payload, false);
      setIsModalOpen(false);
    } catch (err) {
      setFormError(formatReadableFirestoreError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTechStackFromFirestore(id);
    } catch (err) {
      setLoadError(formatReadableFirestoreError(err));
    }
  };

  return (
    <section
      id="tech-stack"
      data-animate="section"
      className="print-section overflow-x-clip border-b border-[var(--line)] bg-[var(--bg)] pb-14 print:bg-white print:py-5 md:pb-20"
    >
      {/* Full-bleed Hospitality Systems Marquee Ribbon */}
      {marqueeItems.length > 0 && (
        <div className="marq mb-12 print:hidden" aria-hidden="true">
          <div className="track">
            {marqueeItems.concat(marqueeItems).map((item, i) => (
              <span key={`${item}-${i}`}>{item}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1120px] px-[clamp(20px,5vw,48px)] pt-6 print:px-0 print:pt-0">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-3 text-xs font-semibold tracking-wider text-[var(--brass)] uppercase print:text-[10px]">
              <span className="inline-block h-px w-6 bg-[var(--brass)] print:hidden" aria-hidden="true" />
              <EditableText
                value={siteCopy.stackKicker}
                canEdit={isAdminUser}
                maxLength={80}
                onSave={(val) => onSaveSiteCopyField('stackKicker', val)}
              />
            </p>
            <h2 className="mt-2 font-display text-[clamp(1.85rem,4vw,3rem)] font-bold tracking-tight text-[var(--ink)] print:mt-0.5 print:text-lg">
              <EditableText
                value={siteCopy.stackTitle}
                canEdit={isAdminUser}
                maxLength={120}
                onSave={(val) => onSaveSiteCopyField('stackTitle', val)}
              />
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--mute)] print:hidden">
              <EditableText
                value={siteCopy.stackDesc}
                canEdit={isAdminUser}
                multiline
                maxLength={400}
                onSave={(val) => onSaveSiteCopyField('stackDesc', val)}
              />
            </p>
          </div>

          <div className="no-print flex max-w-full flex-wrap items-center gap-3 self-start">
            {isAdminUser && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brass)] px-4 py-2 text-xs font-semibold text-[#1a1405] transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{locale === 'en' ? 'Add Category' : 'Tambah Kategori'}</span>
              </button>
            )}

            <div
              role="tablist"
              aria-label="Filter technology stack categories"
              className="flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-1 sm:rounded-full"
            >
              {filterKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={groupFilter === key}
                  onClick={() => setGroupFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    groupFilter === key
                      ? 'bg-[var(--brass)] text-[#1a1405]'
                      : 'text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  {t.stackFilters[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200"
          >
            {loadError}
          </div>
        )}

        {/* Spotlight 22px Editorial Grid */}
        <div className="mt-10 grid grid-cols-1 gap-5 print:mt-3 print:grid-cols-2 print:gap-3 md:grid-cols-2">
          {visibleCategories.map((category, index) => (
            <div
              key={category.id}
              onMouseMove={handleCardPointerMove}
              className="editorial-card print-break-inside-avoid flex min-w-0 flex-col justify-between p-6 print:p-3 sm:p-7"
            >
              <div className="relative z-10 flex min-w-0 items-baseline justify-between gap-4">
                <h3 className="min-w-0 flex-1 font-display text-xl font-bold text-[var(--ink)] [overflow-wrap:anywhere] print:text-xs">
                  <EditableText
                    value={locale === 'en' ? category.label : category.labelId}
                    canEdit={isAdminUser}
                    maxLength={100}
                    onSave={(val) =>
                      saveTechStackToFirestore(
                        {
                          ...category,
                          ...(locale === 'en' ? { label: val } : { labelId: val }),
                        },
                        category.fromFirestore
                      )
                    }
                  />
                </h3>
                <div className="flex shrink-0 items-center gap-2">
                  {isAdminUser && (
                    <div className="no-print flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(category)}
                        aria-label={`Edit ${category.label}`}
                        className="rounded-full p-1.5 text-[var(--brass)] hover:bg-[var(--brass)]/15 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      {category.fromFirestore && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(category.id)}
                          aria-label={`Delete ${category.label}`}
                          className="rounded-full p-1.5 text-red-600 hover:bg-red-500/15 dark:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                  <span className="font-mono text-xs text-[var(--brass)] tabular-nums print:text-[10px]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="relative z-10 mt-4">
                {isAdminUser ? (
                  <p className="text-sm leading-relaxed text-[var(--mute)] print:mt-1 print:text-[11px]">
                    <EditableText
                      value={category.items.join(' · ')}
                      canEdit={isAdminUser}
                      multiline
                      maxLength={1200}
                      onSave={(val) => {
                        const parsed = val
                          .split(/[·,]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (parsed.length === 0) {
                          throw new Error('Minimal satu keahlian wajib diisi.');
                        }
                        return saveTechStackToFirestore(
                          { ...category, items: parsed },
                          category.fromFirestore
                        );
                      }}
                    />
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2 print:gap-1">
                    {category.items.map((tool) => (
                      <li
                        key={tool}
                        className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-medium text-[var(--ink)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brass)] hover:bg-[var(--brass)] hover:text-[#1a1405] print:border-slate-300 print:px-2 print:py-0.5 print:text-[10px]"
                      >
                        {tool}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Tech Stack Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stack-modal-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#0a1024]/70 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[92vh] w-full max-w-[min(32rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[22px] border border-[var(--line)] bg-[var(--bg2)] p-5 text-[var(--ink)] shadow-2xl sm:p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3
                  id="stack-modal-title"
                  className="font-display text-lg font-bold text-[var(--ink)]"
                >
                  {editingItem
                    ? locale === 'en'
                      ? 'Edit Tech Category'
                      : 'Ubah Kategori Keahlian'
                    : locale === 'en'
                      ? 'Add Tech Category'
                      : 'Tambah Kategori Keahlian'}
                </h3>
                {editingItem && (
                  <p className="mt-0.5 text-xs text-[var(--mute)]">
                    {locale === 'en'
                      ? 'Every change saves automatically to Firestore.'
                      : 'Setiap perubahan tersimpan otomatis ke Cloud Firestore.'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                className="shrink-0 rounded-full p-1.5 text-[var(--mute)] hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-200"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="stack-group" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Group' : 'Grup'}
                  </label>
                  <select
                    id="stack-group"
                    value={group}
                    onChange={(e) => setGroup(e.target.value as TechCategory['group'])}
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                  >
                    <option value="core">{t.stackFilters.core}</option>
                    <option value="infra">{t.stackFilters.infra}</option>
                    <option value="guest">{t.stackFilters.guest}</option>
                    <option value="productivity">{t.stackFilters.productivity}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="stack-order" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Order' : 'Urutan'}
                  </label>
                  <input
                    id="stack-order"
                    type="number"
                    min={0}
                    max={1000}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 font-mono text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="stack-label" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Category Name (EN) *' : 'Nama Kategori (EN) *'}
                  </label>
                  <input
                    id="stack-label"
                    type="text"
                    required
                    maxLength={100}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Cloud & DevOps"
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="stack-label-id" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Category Name (ID)' : 'Nama Kategori (ID)'}
                  </label>
                  <input
                    id="stack-label-id"
                    type="text"
                    maxLength={100}
                    value={labelId}
                    onChange={(e) => setLabelId(e.target.value)}
                    placeholder="mis. Cloud & DevOps"
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="stack-items" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'Tools / Technologies (comma-separated) *' : 'Daftar Teknologi (pisahkan dengan koma) *'}
                </label>
                <textarea
                  id="stack-items"
                  rows={3}
                  required
                  value={itemsText}
                  onChange={(e) => setItemsText(e.target.value)}
                  placeholder="Protel, VHP, Opera PMS"
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                {editingItem ? (
                  <>
                    <div className="flex min-w-0 items-center gap-2 text-xs">
                      {autoSaveState === 'saving' ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--brass)]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          <span>
                            {locale === 'en' ? 'Auto-saving...' : 'Menyimpan otomatis...'}
                          </span>
                        </span>
                      ) : autoSaveState === 'saved' ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {locale === 'en'
                              ? 'Saved automatically'
                              : 'Tersimpan otomatis'}
                          </span>
                        </span>
                      ) : autoSaveState === 'invalid' ? (
                        <span className="text-[var(--mute)]">
                          {locale === 'en'
                            ? 'Enter category & at least 1 item to auto-save'
                            : 'Isi kategori & minimal 1 teknologi untuk auto-save'}
                        </span>
                      ) : (
                        <span className="text-[var(--mute)]">
                          {locale === 'en' ? 'Auto-save ready' : 'Auto-save aktif'}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] cursor-pointer"
                    >
                      {locale === 'en' ? 'Done' : 'Selesai'}
                    </button>
                  </>
                ) : (
                  <div className="ml-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
                    >
                      {locale === 'en' ? 'Cancel' : 'Batal'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving
                        ? locale === 'en'
                          ? 'Saving...'
                          : 'Menyimpan...'
                        : locale === 'en'
                          ? 'Save'
                          : 'Simpan'}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
