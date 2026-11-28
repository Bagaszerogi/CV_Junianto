import { FormEvent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Pencil, Phone, Plus, Trash2, X } from 'lucide-react';
import { Locale } from '../data/cvData';
import {
  deleteReferenceFromFirestore,
  EducationData,
  FirestoreReferenceItem,
  saveReferenceToFirestore,
  SiteCopyLocale,
  subscribeReferences,
} from '../utils/cvFirestoreApi';
import { formatReadableFirestoreError } from '../firebase';
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
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'invalid'>('idle');

  const editingRefObjRef = useRef<FirestoreReferenceItem | null>(null);
  const lastSavedRefDigestRef = useRef('');
  const refAutoSaveTimerRef = useRef<number | null>(null);

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
        setLoadError(formatReadableFirestoreError(err));
      }
    );
    return () => unsubscribe();
  }, [authReady, invitedReferences, isAdminUser]);

  const handleCardPointerMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    el.style.setProperty('--mx', `${x.toFixed(1)}%`);
    el.style.setProperty('--my', `${y.toFixed(1)}%`);
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    } catch {
      // Ignore clipboard unavailable
    }
  };

  const buildRefPayload = useCallback(
    (id: string) => {
      const cleanName = refName.trim().slice(0, 120);
      const cleanRole = refRole.trim().slice(0, 140);
      const cleanPhone = refPhone.trim().slice(0, 40);
      const clampedOrder = Math.min(1000, Math.max(0, Math.round(Number(refOrder) || 0)));
      const isValid = cleanName.length > 0 && cleanRole.length > 0 && cleanPhone.length > 0;
      const payload = {
        id,
        name: cleanName,
        role: cleanRole,
        phone: cleanPhone,
        sortOrder: clampedOrder,
      };
      const digest = JSON.stringify(payload);
      return { isValid, payload, digest };
    },
    [refName, refOrder, refPhone, refRole]
  );

  const openAddRef = () => {
    editingRefObjRef.current = null;
    lastSavedRefDigestRef.current = '';
    setEditingRef(null);
    setRefName('');
    setRefRole('');
    setRefPhone('');
    setRefOrder(references.length);
    setFormError(null);
    setAutoSaveState('idle');
    setIsRefModalOpen(true);
  };

  const openEditRef = (item: FirestoreReferenceItem) => {
    editingRefObjRef.current = item;
    const initialDigest = JSON.stringify({
      id: item.id,
      name: item.name.trim().slice(0, 120),
      role: item.role.trim().slice(0, 140),
      phone: item.phone.trim().slice(0, 40),
      sortOrder: Math.min(1000, Math.max(0, Math.round(Number(item.sortOrder) || 0))),
    });
    lastSavedRefDigestRef.current = initialDigest;
    setEditingRef(item);
    setRefName(item.name);
    setRefRole(item.role);
    setRefPhone(item.phone);
    setRefOrder(item.sortOrder);
    setFormError(null);
    setAutoSaveState('idle');
    setIsRefModalOpen(true);
  };

  const persistRefEdit = useCallback(async () => {
    const current = editingRefObjRef.current;
    if (!current) return;
    const { isValid, payload, digest } = buildRefPayload(current.id);
    if (!isValid) {
      setAutoSaveState('invalid');
      return;
    }
    if (digest === lastSavedRefDigestRef.current) return;

    setAutoSaveState('saving');
    setFormError(null);
    try {
      await saveReferenceToFirestore(payload, Boolean(current.fromFirestore));
      lastSavedRefDigestRef.current = digest;
      const digits = payload.phone.replace(/\D/g, '');
      const phoneHref = digits.startsWith('0')
        ? `tel:+62${digits.slice(1)}`
        : digits
          ? `tel:+${digits}`
          : '#';
      const updated: FirestoreReferenceItem = {
        ...payload,
        phoneHref,
        fromFirestore: true,
      };
      editingRefObjRef.current = updated;
      setEditingRef(updated);
      setAutoSaveState('saved');
    } catch (err) {
      setFormError(formatReadableFirestoreError(err));
      setAutoSaveState('idle');
    }
  }, [buildRefPayload]);

  useEffect(() => {
    if (!isRefModalOpen || !editingRefObjRef.current) return;
    const { isValid, digest } = buildRefPayload(editingRefObjRef.current.id);
    if (!isValid) {
      setAutoSaveState('invalid');
      return;
    }
    if (digest === lastSavedRefDigestRef.current) return;

    if (refAutoSaveTimerRef.current !== null) {
      window.clearTimeout(refAutoSaveTimerRef.current);
    }
    refAutoSaveTimerRef.current = window.setTimeout(() => {
      refAutoSaveTimerRef.current = null;
      void persistRefEdit();
    }, 480);

    return () => {
      if (refAutoSaveTimerRef.current !== null) {
        window.clearTimeout(refAutoSaveTimerRef.current);
        refAutoSaveTimerRef.current = null;
      }
    };
  }, [buildRefPayload, isRefModalOpen, persistRefEdit]);

  const closeRefModal = () => {
    if (refAutoSaveTimerRef.current !== null) {
      window.clearTimeout(refAutoSaveTimerRef.current);
      refAutoSaveTimerRef.current = null;
    }
    if (editingRefObjRef.current) {
      void persistRefEdit();
    }
    editingRefObjRef.current = null;
    setEditingRef(null);
    setIsRefModalOpen(false);
  };

  const handleSaveRef = async (e: FormEvent) => {
    e.preventDefault();
    if (editingRefObjRef.current) {
      await persistRefEdit();
      return;
    }
    setFormError(null);
    const id = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { isValid, payload } = buildRefPayload(id);
    if (!isValid) {
      setFormError(
        locale === 'en'
          ? 'Name, role, and phone number are required.'
          : 'Nama, jabatan, dan nomor telepon wajib diisi.'
      );
      return;
    }

    setIsSaving(true);
    try {
      await saveReferenceToFirestore(payload, false);
      setIsRefModalOpen(false);
    } catch (err) {
      setFormError(formatReadableFirestoreError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRef = async (id: string) => {
    try {
      await deleteReferenceFromFirestore(id);
    } catch (err) {
      setLoadError(formatReadableFirestoreError(err));
    }
  };

  return (
    <section
      id="education"
      data-animate="section"
      className="print-section overflow-x-clip border-b border-[var(--line)] bg-[var(--bg2)] py-14 print:bg-white print:py-5 md:py-20"
    >
      <div className="mx-auto max-w-[1120px] px-[clamp(20px,5vw,48px)] print:px-0">
        <div className="grid grid-cols-1 gap-10 print:grid-cols-12 print:gap-5 lg:grid-cols-12">
          {/* Left: Education */}
          <div className="min-w-0 print:col-span-5 lg:col-span-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-3 text-xs font-semibold tracking-wider text-[var(--brass)] uppercase print:text-[10px]">
                  <span className="inline-block h-px w-6 bg-[var(--brass)] print:hidden" aria-hidden="true" />
                  <EditableText
                    value={siteCopy.educationKicker}
                    canEdit={isAdminUser}
                    maxLength={80}
                    onSave={(val) => onSaveSiteCopyField('educationKicker', val)}
                  />
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--ink)] print:mt-0.5 print:text-lg">
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
                  className="no-print inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--brass)] hover:border-[var(--brass)] whitespace-nowrap cursor-pointer"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Edit' : 'Ubah'}</span>
                </button>
              )}
            </div>

            <div
              onMouseMove={handleCardPointerMove}
              className="editorial-card print-break-inside-avoid mt-6 min-w-0 bg-[var(--bg)]/85 p-6 [overflow-wrap:anywhere] print:mt-3 print:rounded-lg print:bg-white print:p-3.5 sm:p-7"
            >
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-[var(--mute)] tabular-nums print:text-[10px]">
                  <EditableText
                    value={education.period}
                    canEdit={isAdminUser}
                    maxLength={40}
                    onSave={(val) => onSaveEducationField({ period: val })}
                  />
                </span>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--brass)_16%,transparent)] px-3 py-0.5 font-mono text-xs font-semibold text-[var(--brass)] print:bg-transparent print:px-0 print:text-[10px]">
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
              <h3 className="relative z-10 mt-3 font-display text-xl font-bold text-[var(--ink)] print:mt-1 print:text-sm">
                <EditableText
                  value={education.institution}
                  canEdit={isAdminUser}
                  maxLength={160}
                  onSave={(val) => onSaveEducationField({ institution: val })}
                />
              </h3>
              <p className="relative z-10 mt-1 text-sm font-semibold text-[var(--ice)] print:text-xs">
                <EditableText
                  value={locale === 'en' ? education.majorEn : education.majorId}
                  canEdit={isAdminUser}
                  maxLength={140}
                  onSave={(val) =>
                    onSaveEducationField(locale === 'en' ? { majorEn: val } : { majorId: val })
                  }
                />
              </p>
              <p className="relative z-10 mt-4 border-t border-[var(--line)] pt-4 text-sm leading-relaxed text-[var(--mute)] print:mt-2 print:pt-2 print:text-[11px] print:leading-snug">
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
          <div className="min-w-0 print:col-span-7 lg:col-span-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-3 text-xs font-semibold tracking-wider text-[var(--brass)] uppercase print:text-[10px]">
                  <span className="inline-block h-px w-6 bg-[var(--brass)] print:hidden" aria-hidden="true" />
                  <EditableText
                    value={siteCopy.referencesKicker}
                    canEdit={isAdminUser}
                    maxLength={80}
                    onSave={(val) => onSaveSiteCopyField('referencesKicker', val)}
                  />
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--ink)] print:mt-0.5 print:text-lg">
                  <EditableText
                    value={siteCopy.referencesTitle}
                    canEdit={isAdminUser}
                    maxLength={120}
                    onSave={(val) => onSaveSiteCopyField('referencesTitle', val)}
                  />
                </h2>
                <p className="mt-2 text-sm text-[var(--mute)] print:hidden">
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
                  className="no-print inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--brass)] px-4 py-2 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Add Reference' : 'Tambah Referensi'}</span>
                </button>
              )}
            </div>

            {loadError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200"
              >
                {loadError}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 print:mt-3 print:grid-cols-2 print:gap-2.5 sm:grid-cols-2">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  onMouseMove={handleCardPointerMove}
                  className="editorial-card print-break-inside-avoid group flex min-w-0 flex-col justify-between bg-[var(--bg)]/85 p-5 print:rounded-lg print:bg-white print:p-3"
                >
                  <div className="relative z-10 flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <h3 className="font-display text-base font-bold text-[var(--ink)] print:text-xs">
                        <EditableText
                          value={ref.name}
                          canEdit={isAdminUser}
                          maxLength={120}
                          onSave={(val) =>
                            saveReferenceToFirestore({ ...ref, name: val }, ref.fromFirestore)
                          }
                        />
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-[var(--ice)] print:mt-0.5 print:text-[10px]">
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
                          className="rounded-full p-1 text-[var(--brass)] hover:bg-[var(--brass)]/15 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        {ref.fromFirestore && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteRef(ref.id)}
                            aria-label={`Delete ${ref.name}`}
                            className="rounded-full p-1 text-red-600 hover:bg-red-500/15 dark:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 print:mt-2 print:pt-1.5">
                    <a
                      href={ref.phoneHref}
                      className="inline-flex min-w-0 flex-1 items-center gap-2 font-mono text-xs font-medium text-[var(--ink)] transition-colors hover:text-[var(--brass)] tabular-nums print:text-[10px]"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--brass)] print:h-3 print:w-3" aria-hidden="true" />
                      <EditableText
                        value={ref.phone}
                        canEdit={isAdminUser}
                        maxLength={40}
                        className="min-w-0 [overflow-wrap:anywhere]"
                        onSave={(val) =>
                          saveReferenceToFirestore({ ...ref, phone: val }, ref.fromFirestore)
                        }
                      />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyPhone(ref.phone)}
                      aria-label={`Copy phone number for ${ref.name}`}
                      className="no-print inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--mute)] transition-colors hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {copiedPhone === ref.phone ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                          <span className="text-[var(--ink)]">
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
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#0a1024]/70 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[92vh] w-full max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[22px] border border-[var(--line)] bg-[var(--bg2)] p-5 text-[var(--ink)] shadow-2xl sm:p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3
                  id="ref-modal-title"
                  className="font-display text-lg font-bold text-[var(--ink)]"
                >
                  {editingRef
                    ? locale === 'en'
                      ? 'Edit Reference'
                      : 'Ubah Referensi'
                    : locale === 'en'
                      ? 'Add Reference'
                      : 'Tambah Referensi'}
                </h3>
                {editingRef && (
                  <p className="mt-0.5 text-xs text-[var(--mute)]">
                    {locale === 'en'
                      ? 'Changes save automatically to Cloud Firestore.'
                      : 'Perubahan tersimpan otomatis ke Cloud Firestore.'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeRefModal}
                aria-label="Close modal"
                className="shrink-0 rounded-full p-1.5 text-[var(--mute)] hover:bg-[var(--card)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRef} className="mt-5 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-200"
                >
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="ref-name" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'Full Name *' : 'Nama Lengkap *'}
                </label>
                <input
                  id="ref-name"
                  type="text"
                  required
                  maxLength={120}
                  value={refName}
                  onChange={(e) => setRefName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ref-role" className="block text-xs font-semibold text-[var(--mute)]">
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
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ref-phone" className="block text-xs font-semibold text-[var(--mute)]">
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
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 font-mono text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="ref-order" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Order' : 'Urutan'}
                  </label>
                  <input
                    id="ref-order"
                    type="number"
                    min={0}
                    max={1000}
                    value={refOrder}
                    onChange={(e) => setRefOrder(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 font-mono text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                {editingRef ? (
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
                            {locale === 'en' ? 'Saved automatically' : 'Tersimpan otomatis'}
                          </span>
                        </span>
                      ) : autoSaveState === 'invalid' ? (
                        <span className="text-[var(--mute)]">
                          {locale === 'en'
                            ? 'Complete required (*) fields to auto-save'
                            : 'Lengkapi kolom wajib (*) untuk auto-save'}
                        </span>
                      ) : (
                        <span className="text-[var(--mute)]">
                          {locale === 'en' ? 'Auto-save ready' : 'Auto-save aktif'}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={closeRefModal}
                      className="rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] cursor-pointer"
                    >
                      {locale === 'en' ? 'Done' : 'Selesai'}
                    </button>
                  </>
                ) : (
                  <div className="ml-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeRefModal}
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
