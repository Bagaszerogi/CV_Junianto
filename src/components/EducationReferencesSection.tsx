import { FormEvent, useEffect, useState } from 'react';
import { Check, Copy, Pencil, Phone, Plus, Trash2, X } from 'lucide-react';
import { Locale } from '../data/cvData';
import {
  deleteReferenceFromFirestore,
  EducationData,
  FirestoreReferenceItem,
  saveReferenceToFirestore,
  SiteCopyLocale,
  subscribeReferences,
} from '../utils/cvFirestoreApi';
import { EditableText } from './EditableText';

interface EducationReferencesSectionProps {
  locale: Locale;
  authReady: boolean;
  isAdminUser: boolean;
  education: EducationData;
  siteCopy: SiteCopyLocale;
  invitedReferences?: FirestoreReferenceItem[];
  onSaveEducationField: (patch: Partial<EducationData>) => Promise<void>;
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
  onEditEducation: () => void;
}

export function EducationReferencesSection({
  locale,
  authReady,
  isAdminUser,
  education,
  siteCopy,
  invitedReferences,
  onSaveEducationField,
  onSaveSiteCopyField,
  onEditEducation,
}: EducationReferencesSectionProps) {
  const [references, setReferences] = useState<FirestoreReferenceItem[]>(invitedReferences ?? []);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add / Edit Reference modal
  const [isRefModalOpen, setIsRefModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<FirestoreReferenceItem | null>(null);
  const [refName, setRefName] = useState('');
  const [refRole, setRefRole] = useState('');
  const [refPhone, setRefPhone] = useState('');
  const [refOrder, setRefOrder] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAdminUser && invitedReferences) {
      setReferences(invitedReferences);
      setLoadError(null);
      return;
    }
    if (!authReady || !isAdminUser) return;
    const unsubscribe = subscribeReferences(
      (items) => {
        setReferences(items);
        setLoadError(null);
      },
      (err) => {
        setLoadError(err.message);
      }
    );
    return () => unsubscribe();
  }, [authReady, invitedReferences, isAdminUser]);

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    } catch {
      // Ignore if clipboard unavailable
    }
  };

  const openAddRef = () => {
    setEditingRef(null);
    setRefName('');
    setRefRole('');
    setRefPhone('');
    setRefOrder(references.length);
    setFormError(null);
    setIsRefModalOpen(true);
  };

  const openEditRef = (item: FirestoreReferenceItem) => {
    setEditingRef(item);
    setRefName(item.name);
    setRefRole(item.role);
    setRefPhone(item.phone);
    setRefOrder(item.sortOrder);
    setFormError(null);
    setIsRefModalOpen(true);
  };

  const handleSaveRef = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!refName.trim() || !refRole.trim() || !refPhone.trim()) {
      setFormError(
        locale === 'en'
          ? 'Name, role, and phone number are required.'
          : 'Nama, jabatan, dan nomor telepon wajib diisi.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const id = editingRef
        ? editingRef.id
        : `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await saveReferenceToFirestore(
        {
          id,
          name: refName.trim(),
          role: refRole.trim(),
          phone: refPhone.trim(),
          sortOrder: Number(refOrder) || 0,
        },
        Boolean(editingRef?.fromFirestore)
      );
      setIsRefModalOpen(false);
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

  const handleDeleteRef = async (id: string) => {
    try {
      await deleteReferenceFromFirestore(id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section
      id="education"
      data-animate="section"
      className="print-section border-b border-slate-200 bg-white py-14 print:py-5 dark:border-slate-800 dark:bg-slate-900 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-6 print:px-0">
        <div className="grid grid-cols-1 gap-10 print:grid-cols-12 print:gap-5 lg:grid-cols-12">
          {/* Left: Education */}
          <div className="print:col-span-5 lg:col-span-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-blue-700 print:text-[10px] dark:text-blue-400">
                  <EditableText
                    value={siteCopy.educationKicker}
                    canEdit={isAdminUser}
                    maxLength={80}
                    onSave={(val) => onSaveSiteCopyField('educationKicker', val)}
                  />
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 print:mt-0.5 print:text-lg dark:text-white">
                  <EditableText
                    value={siteCopy.educationTitle}
                    canEdit={isAdminUser}
                    maxLength={120}
                    onSave={(val) => onSaveSiteCopyField('educationTitle', val)}
                  />
                </h2>
              </div>

              {isAdminUser && (
                <button
                  type="button"
                  onClick={onEditEducation}
                  className="no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 cursor-pointer"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Edit' : 'Ubah'}</span>
                </button>
              )}
            </div>

            <div className="print-break-inside-avoid mt-6 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-6 shadow-2xs transition-colors hover:border-slate-300 print:mt-3 print:rounded-lg print:bg-white print:p-3.5 dark:border-slate-800 dark:bg-slate-950/80 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-slate-500 tabular-nums print:text-[10px] dark:text-slate-400">
                  <EditableText
                    value={education.period}
                    canEdit={isAdminUser}
                    maxLength={40}
                    onSave={(val) => onSaveEducationField({ period: val })}
                  />
                </span>
                <span className="rounded-md bg-blue-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-blue-800 print:bg-transparent print:px-0 print:text-[10px] dark:bg-blue-950/60 dark:text-blue-300">
                  <EditableText
                    value={locale === 'en' ? education.gpaEn : education.gpaId}
                    canEdit={isAdminUser}
                    maxLength={40}
                    onSave={(val) =>
                      onSaveEducationField(locale === 'en' ? { gpaEn: val } : { gpaId: val })
                    }
                  />
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-bold text-slate-950 print:mt-1 print:text-sm dark:text-white">
                <EditableText
                  value={education.institution}
                  canEdit={isAdminUser}
                  maxLength={160}
                  onSave={(val) => onSaveEducationField({ institution: val })}
                />
              </h3>
              <p className="mt-1 text-sm font-semibold text-blue-700 print:text-xs dark:text-blue-400">
                <EditableText
                  value={locale === 'en' ? education.majorEn : education.majorId}
                  canEdit={isAdminUser}
                  maxLength={140}
                  onSave={(val) =>
                    onSaveEducationField(locale === 'en' ? { majorEn: val } : { majorId: val })
                  }
                />
              </p>
              <p className="mt-4 border-t border-slate-200/80 pt-4 text-sm leading-relaxed text-slate-600 print:mt-2 print:pt-2 print:text-[11px] print:leading-snug dark:border-slate-800 dark:text-slate-300">
                <EditableText
                  value={locale === 'en' ? education.focusEn : education.focusId}
                  canEdit={isAdminUser}
                  multiline
                  maxLength={600}
                  onSave={(val) =>
                    onSaveEducationField(locale === 'en' ? { focusEn: val } : { focusId: val })
                  }
                />
              </p>
            </div>
          </div>

          {/* Right: Professional References */}
          <div className="print:col-span-7 lg:col-span-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-blue-700 print:text-[10px] dark:text-blue-400">
                  <EditableText
                    value={siteCopy.referencesKicker}
                    canEdit={isAdminUser}
                    maxLength={80}
                    onSave={(val) => onSaveSiteCopyField('referencesKicker', val)}
                  />
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 print:mt-0.5 print:text-lg dark:text-white">
                  <EditableText
                    value={siteCopy.referencesTitle}
                    canEdit={isAdminUser}
                    maxLength={120}
                    onSave={(val) => onSaveSiteCopyField('referencesTitle', val)}
                  />
                </h2>
                <p className="mt-2 text-sm text-slate-600 print:hidden dark:text-slate-300">
                  <EditableText
                    value={siteCopy.referencesNote}
                    canEdit={isAdminUser}
                    maxLength={300}
                    onSave={(val) => onSaveSiteCopyField('referencesNote', val)}
                  />
                </p>
              </div>

              {isAdminUser && (
                <button
                  type="button"
                  onClick={openAddRef}
                  className="no-print inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Add Reference' : 'Tambah Referensi'}</span>
                </button>
              )}
            </div>

            {loadError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
              >
                {loadError}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 print:mt-3 print:grid-cols-2 print:gap-2.5 sm:grid-cols-2">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="print-break-inside-avoid group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5 shadow-2xs transition-all duration-150 hover:border-slate-300 hover:bg-white print:rounded-lg print:bg-white print:p-3 dark:border-slate-800 dark:bg-slate-950/80 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-950 print:text-xs dark:text-white">
                        <EditableText
                          value={ref.name}
                          canEdit={isAdminUser}
                          maxLength={120}
                          onSave={(val) =>
                            saveReferenceToFirestore({ ...ref, name: val }, ref.fromFirestore)
                          }
                        />
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-blue-800 print:mt-0.5 print:text-[10px] dark:text-blue-400">
                        <EditableText
                          value={ref.role}
                          canEdit={isAdminUser}
                          maxLength={140}
                          onSave={(val) =>
                            saveReferenceToFirestore({ ...ref, role: val }, ref.fromFirestore)
                          }
                        />
                      </p>
                    </div>
                    {isAdminUser && (
                      <div className="no-print flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditRef(ref)}
                          aria-label={`Edit ${ref.name}`}
                          className="rounded p-1 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        {ref.fromFirestore && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteRef(ref.id)}
                            aria-label={`Delete ${ref.name}`}
                            className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-3 print:mt-2 print:pt-1.5 dark:border-slate-800">
                    <a
                      href={ref.phoneHref}
                      className="inline-flex items-center gap-2 font-mono text-xs font-medium text-slate-700 transition-colors hover:text-blue-700 tabular-nums print:text-[10px] dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      <Phone className="h-3.5 w-3.5 text-slate-400 print:h-3 print:w-3 dark:text-slate-500" aria-hidden="true" />
                      <EditableText
                        value={ref.phone}
                        canEdit={isAdminUser}
                        maxLength={40}
                        onSave={(val) =>
                          saveReferenceToFirestore({ ...ref, phone: val }, ref.fromFirestore)
                        }
                      />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyPhone(ref.phone)}
                      aria-label={`Copy phone number for ${ref.name}`}
                      className="no-print inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      {copiedPhone === ref.phone ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {locale === 'en' ? 'Copied' : 'Disalin'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{locale === 'en' ? 'Copy' : 'Salin'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Reference Modal */}
      {isRefModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ref-modal-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <h3
                id="ref-modal-title"
                className="font-display text-lg font-bold text-slate-950 dark:text-white"
              >
                {editingRef
                  ? locale === 'en'
                    ? 'Edit Reference'
                    : 'Ubah Referensi'
                  : locale === 'en'
                    ? 'Add Reference'
                    : 'Tambah Referensi'}
              </h3>
              <button
                type="button"
                onClick={() => setIsRefModalOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRef} className="mt-5 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="ref-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'Full Name *' : 'Nama Lengkap *'}
                </label>
                <input
                  id="ref-name"
                  type="text"
                  required
                  maxLength={120}
                  value={refName}
                  onChange={(e) => setRefName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="ref-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'Role & Hotel / Company *' : 'Jabatan & Hotel / Perusahaan *'}
                </label>
                <input
                  id="ref-role"
                  type="text"
                  required
                  maxLength={140}
                  value={refRole}
                  onChange={(e) => setRefRole(e.target.value)}
                  placeholder="GM Cluster – Hotel Aston Cilacap"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ref-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Phone Number *' : 'Nomor Telepon *'}
                  </label>
                  <input
                    id="ref-phone"
                    type="text"
                    required
                    maxLength={40}
                    value={refPhone}
                    onChange={(e) => setRefPhone(e.target.value)}
                    placeholder="0877-3919-9722"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="ref-order" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Order' : 'Urutan'}
                  </label>
                  <input
                    id="ref-order"
                    type="number"
                    min={0}
                    max={1000}
                    value={refOrder}
                    onChange={(e) => setRefOrder(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRefModalOpen(false)}
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
