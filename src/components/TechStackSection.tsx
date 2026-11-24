import { FormEvent, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Locale, TechCategory, UI_COPY } from '../data/cvData';
import {
  deleteTechStackFromFirestore,
  FirestoreTechCategory,
  saveTechStackToFirestore,
  SiteCopyLocale,
  subscribeTechStacks,
} from '../utils/cvFirestoreApi';
import { EditableText } from './EditableText';

interface TechStackSectionProps {
  locale: Locale;
  authReady: boolean;
  isAdminUser: boolean;
  siteCopy: SiteCopyLocale;
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
}

type StackFilter = 'all' | TechCategory['group'];

export function TechStackSection({
  locale,
  authReady,
  isAdminUser,
  siteCopy,
  onSaveSiteCopyField,
}: TechStackSectionProps) {
  const [categories, setCategories] = useState<FirestoreTechCategory[]>([]);
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

  const t = UI_COPY[locale].sections;

  useEffect(() => {
    if (!authReady) return;
    const unsubscribe = subscribeTechStacks(
      (items) => {
        setCategories(items);
        setLoadError(null);
      },
      (err) => {
        setLoadError(err.message);
      }
    );
    return () => unsubscribe();
  }, [authReady]);

  const visibleCategories = categories.filter((cat) =>
    groupFilter === 'all' ? true : cat.group === groupFilter
  );

  const filterKeys: StackFilter[] = ['all', 'core', 'infra', 'guest', 'productivity'];

  const openAddModal = () => {
    setEditingItem(null);
    setGroup('core');
    setLabel('');
    setLabelId('');
    setItemsText('');
    setSortOrder(categories.length);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: FirestoreTechCategory) => {
    setEditingItem(item);
    setGroup(item.group);
    setLabel(item.label);
    setLabelId(item.labelId);
    setItemsText(item.items.join(', '));
    setSortOrder(item.sortOrder);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const items = itemsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!label.trim() || items.length === 0) {
      setFormError(
        locale === 'en'
          ? 'Category label and at least one tool are required.'
          : 'Nama kategori dan minimal satu teknologi wajib diisi.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const id = editingItem
        ? editingItem.id
        : `stack_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await saveTechStackToFirestore(
        {
          id,
          group,
          label: label.trim(),
          labelId: (labelId || label).trim(),
          items,
          sortOrder: Number(sortOrder) || 0,
        },
        Boolean(editingItem?.fromFirestore)
      );
      setIsModalOpen(false);
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTechStackFromFirestore(id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section
      id="tech-stack"
      data-animate="section"
      className="print-section border-b border-slate-200 bg-slate-50 py-14 print:bg-white print:py-5 dark:border-slate-800 dark:bg-slate-950 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-6 print:px-0">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 print:text-[10px] dark:text-blue-400">
              <EditableText
                value={siteCopy.stackKicker}
                canEdit={isAdminUser}
                maxLength={80}
                onSave={(val) => onSaveSiteCopyField('stackKicker', val)}
              />
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 print:mt-0.5 print:text-lg dark:text-white">
              <EditableText
                value={siteCopy.stackTitle}
                canEdit={isAdminUser}
                maxLength={120}
                onSave={(val) => onSaveSiteCopyField('stackTitle', val)}
              />
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 print:hidden dark:text-slate-300">
              <EditableText
                value={siteCopy.stackDesc}
                canEdit={isAdminUser}
                multiline
                maxLength={400}
                onSave={(val) => onSaveSiteCopyField('stackDesc', val)}
              />
            </p>
          </div>

          <div className="no-print flex flex-wrap items-center gap-3 self-start">
            {isAdminUser && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{locale === 'en' ? 'Add Category' : 'Tambah Kategori'}</span>
              </button>
            )}

            <div
              role="tablist"
              aria-label="Filter technology stack categories"
              className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800"
            >
              {filterKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={groupFilter === key}
                  onClick={() => setGroupFilter(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    groupFilter === key
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
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
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
          >
            {loadError}
          </div>
        )}

        {/* Clean 2-column architectural grid with hairline dividers */}
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 print:mt-3 print:grid-cols-2 print:rounded-lg dark:border-slate-800 dark:bg-slate-800 md:grid-cols-2">
          {visibleCategories.map((category, index) => (
            <div
              key={category.id}
              className="print-break-inside-avoid flex flex-col justify-between bg-white p-6 print:p-3 dark:bg-slate-900"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-base font-bold text-slate-950 print:text-xs dark:text-white">
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
                <div className="flex items-center gap-2">
                  {isAdminUser && (
                    <div className="no-print flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(category)}
                        aria-label={`Edit ${category.label}`}
                        className="rounded p-1 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      {category.fromFirestore && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(category.id)}
                          aria-label={`Delete ${category.label}`}
                          className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                  <span className="font-mono text-xs text-slate-400 tabular-nums print:text-[10px] dark:text-slate-500">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-700 print:mt-1 print:text-[11px] print:leading-snug dark:text-slate-300">
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
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <h3
                id="stack-modal-title"
                className="font-display text-lg font-bold text-slate-950 dark:text-white"
              >
                {editingItem
                  ? locale === 'en'
                    ? 'Edit Tech Category'
                    : 'Ubah Kategori Keahlian'
                  : locale === 'en'
                    ? 'Add Tech Category'
                    : 'Tambah Kategori Keahlian'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="stack-group" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Group' : 'Grup'}
                  </label>
                  <select
                    id="stack-group"
                    value={group}
                    onChange={(e) => setGroup(e.target.value as TechCategory['group'])}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="core">{t.stackFilters.core}</option>
                    <option value="infra">{t.stackFilters.infra}</option>
                    <option value="guest">{t.stackFilters.guest}</option>
                    <option value="productivity">{t.stackFilters.productivity}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="stack-order" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Order' : 'Urutan'}
                  </label>
                  <input
                    id="stack-order"
                    type="number"
                    min={0}
                    max={1000}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="stack-label" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="stack-label-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Category Name (ID)' : 'Nama Kategori (ID)'}
                  </label>
                  <input
                    id="stack-label-id"
                    type="text"
                    maxLength={100}
                    value={labelId}
                    onChange={(e) => setLabelId(e.target.value)}
                    placeholder="mis. Cloud & DevOps"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="stack-items" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'Tools / Technologies (comma-separated) *' : 'Daftar Teknologi (pisahkan dengan koma) *'}
                </label>
                <textarea
                  id="stack-items"
                  rows={3}
                  required
                  value={itemsText}
                  onChange={(e) => setItemsText(e.target.value)}
                  placeholder="Protel, VHP, Opera PMS"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {locale === 'en' ? 'Cancel' : 'Batal'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 cursor-pointer"
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
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
