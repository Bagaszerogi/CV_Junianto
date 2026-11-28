import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { Locale } from '../data/cvData';
import {
  compressPortraitImage,
  CvProfileData,
  saveProfileToFirestore,
} from '../utils/cvFirestoreApi';
import { formatReadableFirestoreError } from '../firebase';
import {
  DEFAULT_PORTRAIT_SRC,
  isValidEmailAddress,
  sanitizePortraitSrc,
} from '../utils/safeUrls';

export type ProfileEditTab = 'identity' | 'contact' | 'metrics' | 'education';

interface ProfileEditModalProps {
  isOpen: boolean;
  initialTab?: ProfileEditTab;
  locale: Locale;
  profile: CvProfileData;
  onSaveProfile?: (patch: Partial<CvProfileData>) => Promise<void>;
  onClose: () => void;
}

type ModalAutoSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'incomplete' | 'error';

function validateProfileDraft(d: CvProfileData): boolean {
  if (
    !d.name.trim() ||
    !d.brandShort.trim() ||
    !d.titleEn.trim() ||
    !d.currentCompany.trim() ||
    !d.currentRole.trim() ||
    !d.summaryEn.trim() ||
    !d.phoneDisplay.trim() ||
    !d.email.trim() ||
    !d.address.trim()
  ) {
    return false;
  }
  if (!isValidEmailAddress(d.email)) {
    return false;
  }
  if (!d.metrics.length || d.metrics.some((m) => !m.value.trim() || !m.label.trim())) {
    return false;
  }
  if (
    !d.education.institution.trim() ||
    !d.education.majorEn.trim() ||
    !d.education.period.trim() ||
    !d.education.gpaEn.trim()
  ) {
    return false;
  }
  return true;
}

function serializeProfileFields(d: CvProfileData): string {
  return JSON.stringify({
    name: d.name,
    brandShort: d.brandShort,
    titleEn: d.titleEn,
    titleId: d.titleId,
    kickerEn: d.kickerEn,
    kickerId: d.kickerId,
    currentCompany: d.currentCompany,
    currentRole: d.currentRole,
    summaryEn: d.summaryEn,
    summaryId: d.summaryId,
    phoneDisplay: d.phoneDisplay,
    whatsappHref: d.whatsappHref,
    email: d.email,
    address: d.address,
    portraitDataUrl: d.portraitDataUrl,
    metrics: d.metrics,
    education: d.education,
  });
}

export function ProfileEditModal({
  isOpen,
  initialTab = 'identity',
  locale,
  profile,
  onSaveProfile,
  onClose,
}: ProfileEditModalProps) {
  const [activeTab, setActiveTab] = useState<ProfileEditTab>(initialTab);
  const [draft, setDraft] = useState<CvProfileData>(profile);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [saveState, setSaveState] = useState<ModalAutoSaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const lastSavedDigestRef = useRef('');
  const latestProfileRef = useRef(profile);
  const onSaveProfileRef = useRef(onSaveProfile);

  useEffect(() => {
    latestProfileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    onSaveProfileRef.current = onSaveProfile;
  }, [onSaveProfile]);

  // Only hydrate draft when modal opens so background Firestore snapshots never overwrite typing
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setDraft(profile);
      setActiveTab(initialTab);
      setError(null);
      setSaveState('idle');
      lastSavedDigestRef.current = serializeProfileFields(profile);
    }
    wasOpenRef.current = isOpen;
  }, [initialTab, isOpen, profile]);

  const persistProfileNow = async (nextDraft: CvProfileData) => {
    setError(null);
    setSaveState('saving');
    try {
      if (onSaveProfileRef.current) {
        const { fromFirestore: _ignored, ...patch } = nextDraft;
        await onSaveProfileRef.current(patch);
      } else {
        await saveProfileToFirestore(nextDraft, Boolean(latestProfileRef.current.fromFirestore));
      }
      lastSavedDigestRef.current = serializeProfileFields(nextDraft);
      setSaveState('saved');
    } catch (err) {
      setError(formatReadableFirestoreError(err));
      setSaveState('error');
    }
  };

  // Debounced live auto-save on any valid draft change
  useEffect(() => {
    if (!isOpen) return;
    const digest = serializeProfileFields(draft);
    if (digest === lastSavedDigestRef.current) return;

    if (!validateProfileDraft(draft)) {
      setSaveState('incomplete');
      return;
    }

    setSaveState('pending');
    const timer = window.setTimeout(() => {
      void persistProfileNow(draft);
    }, 480);

    return () => window.clearTimeout(timer);
  }, [draft, isOpen]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressPortraitImage(file);
      const nextDraft = { ...draft, portraitDataUrl: compressed };
      setDraft(nextDraft);
      await persistProfileNow(nextDraft);
    } catch (err) {
      setError(formatReadableFirestoreError(err));
      setSaveState('error');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemoveDraftPhoto = async () => {
    setError(null);
    const nextDraft = { ...draft, portraitDataUrl: '' };
    setDraft(nextDraft);
    await persistProfileNow(nextDraft);
  };

  const handleRestoreDefaultDraftPhoto = async () => {
    setError(null);
    const nextDraft = { ...draft, portraitDataUrl: DEFAULT_PORTRAIT_SRC };
    setDraft(nextDraft);
    await persistProfileNow(nextDraft);
  };

  const previewPortrait = sanitizePortraitSrc(draft.portraitDataUrl, '');
  const isCutoutPreview =
    Boolean(previewPortrait) &&
    (previewPortrait.toLowerCase().includes('.png') ||
      previewPortrait.startsWith('data:image/png') ||
      previewPortrait.startsWith('data:image/webp'));
  const initials = draft.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const tabs: { key: ProfileEditTab; en: string; id: string }[] = [
    { key: 'identity', en: 'Photo & Title', id: 'Foto & Judul' },
    { key: 'contact', en: 'Contact & Summary', id: 'Kontak & Profil' },
    { key: 'metrics', en: 'KPI Metrics', id: 'Metrik Utama' },
    { key: 'education', en: 'Education', id: 'Pendidikan' },
  ];

  const inputClass =
    'mt-1.5 w-full min-w-0 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#0a1024]/70 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-[min(42rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[22px] border border-[var(--line)] bg-[var(--bg2)] p-5 text-[var(--ink)] shadow-2xl sm:p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3
              id="profile-edit-title"
              className="font-display text-xl font-bold text-[var(--ink)]"
            >
              {locale === 'en'
                ? 'Edit CV Profile, Contact & Education'
                : 'Ubah Profil, Foto, Kontak & Pendidikan'}
            </h3>
            <p className="mt-1 text-xs text-[var(--mute)]">
              {locale === 'en'
                ? 'Every edit & photo change auto-saves to Cloud Firestore immediately.'
                : 'Setiap perubahan teks maupun foto otomatis tersimpan ke Cloud Firestore dan langsung update global.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="shrink-0 rounded-full p-2 text-[var(--mute)] hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-1 sm:rounded-full">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-[var(--brass)] text-[#1a1405]'
                  : 'text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              {locale === 'en' ? tab.en : tab.id}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium break-words text-red-700 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {activeTab === 'identity' && (
            <div className="space-y-4">
              {/* Portrait Photo Upload & Remove */}
              <div className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 sm:flex-row sm:items-center">
                <div className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-t-full rounded-b-[16px] border border-[var(--brass)] bg-[var(--card)] p-1.5">
                  <div className="h-full w-full overflow-hidden rounded-t-full rounded-b-[10px] bg-gradient-to-b from-[var(--bg2)] to-[var(--bg)]">
                    {previewPortrait ? (
                      <img
                        src={previewPortrait}
                        alt="Portrait preview"
                        className={`h-full w-full ${
                          isCutoutPreview ? 'object-contain object-bottom' : 'object-cover object-top'
                        }`}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[var(--bg2)] to-[var(--bg)] font-display text-2xl font-bold text-[var(--brass)]">
                        {initials || 'JB'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--ink)]">
                    {locale === 'en'
                      ? '3D Profile Portrait Photo (Full-Res PNG / JPG / WebP)'
                      : 'Foto Profil 3D Utama (PNG Transparan / JPG / WebP)'}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--mute)]">
                    {locale === 'en'
                      ? 'Transparent PNG cutouts render in 3D over the brass arch at full resolution and auto-save immediately.'
                      : 'PNG transparan tampil 3D menembus bingkai atas tanpa penurunan resolusi & langsung tersimpan otomatis.'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessingPhoto || saveState === 'saving'}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brass)] px-4 py-1.5 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {isProcessingPhoto
                          ? locale === 'en'
                            ? 'Processing...'
                            : 'Memproses...'
                          : locale === 'en'
                            ? 'Upload PNG / Photo'
                            : 'Upload PNG / Foto'}
                      </span>
                    </button>
                    {previewPortrait !== DEFAULT_PORTRAIT_SRC && (
                      <button
                        type="button"
                        disabled={isProcessingPhoto || saveState === 'saving'}
                        onClick={() => void handleRestoreDefaultDraftPhoto()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brass)] disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-[var(--brass)]" aria-hidden="true" />
                        <span>{locale === 'en' ? 'Default 3D PNG' : 'Foto 3D Default'}</span>
                      </button>
                    )}
                    {Boolean(previewPortrait) && (
                      <button
                        type="button"
                        disabled={isProcessingPhoto || saveState === 'saving'}
                        onClick={() => void handleRemoveDraftPhoto()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{locale === 'en' ? 'Remove Photo' : 'Hapus Foto'}</span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/webp,image/jpeg,image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="prof-name" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Full Name *' : 'Nama Lengkap *'}
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="prof-brand" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Header Brand Name *' : 'Nama di Pojok Kiri Atas *'}
                  </label>
                  <input
                    id="prof-brand"
                    type="text"
                    maxLength={60}
                    value={draft.brandShort}
                    onChange={(e) => setDraft({ ...draft, brandShort: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="prof-title-en" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Headline Title (EN) *' : 'Judul Profesi (EN) *'}
                  </label>
                  <input
                    id="prof-title-en"
                    type="text"
                    maxLength={140}
                    value={draft.titleEn}
                    onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="prof-title-id" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Headline Title (ID) *' : 'Judul Profesi (ID) *'}
                  </label>
                  <input
                    id="prof-title-id"
                    type="text"
                    maxLength={140}
                    value={draft.titleId}
                    onChange={(e) => setDraft({ ...draft, titleId: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="prof-kicker-en" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Sub-Kicker (EN)' : 'Keterangan Atas (EN)'}
                  </label>
                  <input
                    id="prof-kicker-en"
                    type="text"
                    maxLength={160}
                    value={draft.kickerEn}
                    onChange={(e) => setDraft({ ...draft, kickerEn: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="prof-kicker-id" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Sub-Kicker (ID)' : 'Keterangan Atas (ID)'}
                  </label>
                  <input
                    id="prof-kicker-id"
                    type="text"
                    maxLength={160}
                    value={draft.kickerId}
                    onChange={(e) => setDraft({ ...draft, kickerId: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="prof-cur-comp" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Current Company *' : 'Tempat Kerja Saat Ini *'}
                  </label>
                  <input
                    id="prof-cur-comp"
                    type="text"
                    maxLength={140}
                    value={draft.currentCompany}
                    onChange={(e) => setDraft({ ...draft, currentCompany: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="prof-cur-role" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Current Position *' : 'Jabatan Saat Ini *'}
                  </label>
                  <input
                    id="prof-cur-role"
                    type="text"
                    maxLength={140}
                    value={draft.currentRole}
                    onChange={(e) => setDraft({ ...draft, currentRole: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="prof-phone" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Phone Number *' : 'Nomor Telepon *'}
                  </label>
                  <input
                    id="prof-phone"
                    type="text"
                    maxLength={40}
                    value={draft.phoneDisplay}
                    onChange={(e) => setDraft({ ...draft, phoneDisplay: e.target.value })}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="prof-email" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Email Address *' : 'Alamat Email *'}
                  </label>
                  <input
                    id="prof-email"
                    type="email"
                    maxLength={140}
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prof-wa" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'WhatsApp URL (https://wa.me/...)' : 'Link WhatsApp (https://wa.me/...)'}
                </label>
                <input
                  id="prof-wa"
                  type="url"
                  maxLength={200}
                  value={draft.whatsappHref}
                  onChange={(e) => setDraft({ ...draft, whatsappHref: e.target.value })}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label htmlFor="prof-address" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'Address *' : 'Alamat Lengkap *'}
                </label>
                <input
                  id="prof-address"
                  type="text"
                  maxLength={240}
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="prof-summary-en" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'Profile Summary (EN) *' : 'Ringkasan Profil (EN) *'}
                </label>
                <textarea
                  id="prof-summary-en"
                  rows={3}
                  maxLength={1500}
                  value={draft.summaryEn}
                  onChange={(e) => setDraft({ ...draft, summaryEn: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="prof-summary-id" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'Profile Summary (ID) *' : 'Ringkasan Profil (ID) *'}
                </label>
                <textarea
                  id="prof-summary-id"
                  rows={3}
                  maxLength={1500}
                  value={draft.summaryId}
                  onChange={(e) => setDraft({ ...draft, summaryId: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-4">
              {draft.metrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 sm:grid-cols-3"
                >
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-[var(--mute)]">
                      {locale === 'en' ? `Metric ${idx + 1} Value` : `Nilai Metrik ${idx + 1}`}
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={locale === 'en' ? metric.value : metric.valueId}
                      onChange={(e) => {
                        const updated = [...draft.metrics];
                        updated[idx] =
                          locale === 'en'
                            ? { ...updated[idx], value: e.target.value }
                            : { ...updated[idx], valueId: e.target.value };
                        setDraft({ ...draft, metrics: updated });
                      }}
                      className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3 py-1.5 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-[var(--mute)]">
                      {locale === 'en' ? 'Label (EN / ID)' : 'Judul Metrik'}
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={locale === 'en' ? metric.label : metric.labelId}
                      onChange={(e) => {
                        const updated = [...draft.metrics];
                        updated[idx] =
                          locale === 'en'
                            ? { ...updated[idx], label: e.target.value }
                            : { ...updated[idx], labelId: e.target.value };
                        setDraft({ ...draft, metrics: updated });
                      }}
                      className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3 py-1.5 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col justify-between gap-1">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--mute)]">
                        {locale === 'en' ? 'Sub-detail' : 'Keterangan'}
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        value={locale === 'en' ? metric.detail : metric.detailId}
                        onChange={(e) => {
                          const updated = [...draft.metrics];
                          updated[idx] =
                            locale === 'en'
                              ? { ...updated[idx], detail: e.target.value }
                              : { ...updated[idx], detailId: e.target.value };
                          setDraft({ ...draft, metrics: updated });
                        }}
                        className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3 py-1.5 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                      />
                    </div>
                    {draft.metrics.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = draft.metrics.filter((_, i) => i !== idx);
                          setDraft({ ...draft, metrics: updated });
                        }}
                        className="self-end text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400 cursor-pointer"
                      >
                        {locale === 'en' ? 'Remove' : 'Hapus'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {draft.metrics.length < 6 && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      metrics: [
                        ...draft.metrics,
                        {
                          value: 'New KPI',
                          valueId: 'KPI Baru',
                          label: 'Metric Label',
                          labelId: 'Judul Metrik',
                          detail: 'Short context',
                          detailId: 'Keterangan singkat',
                        },
                      ],
                    })
                  }
                  className="rounded-full border border-dashed border-[var(--line)] px-4 py-2 text-xs font-semibold text-[var(--brass)] hover:border-[var(--brass)] cursor-pointer"
                >
                  {locale === 'en' ? '+ Add Metric' : '+ Tambah Metrik'}
                </button>
              )}
            </div>
          )}

          {activeTab === 'education' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="edu-inst" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'University / Institution *' : 'Universitas / Institusi *'}
                </label>
                <input
                  id="edu-inst"
                  type="text"
                  maxLength={160}
                  value={draft.education.institution}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      education: { ...draft.education, institution: e.target.value },
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="edu-major-en" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Major (EN) *' : 'Jurusan (EN) *'}
                  </label>
                  <input
                    id="edu-major-en"
                    type="text"
                    maxLength={140}
                    value={draft.education.majorEn}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        education: { ...draft.education, majorEn: e.target.value },
                      })
                    }
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="edu-major-id" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Major (ID) *' : 'Jurusan (ID) *'}
                  </label>
                  <input
                    id="edu-major-id"
                    type="text"
                    maxLength={140}
                    value={draft.education.majorId}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        education: { ...draft.education, majorId: e.target.value },
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="min-w-0">
                  <label htmlFor="edu-period" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Years *' : 'Tahun *'}
                  </label>
                  <input
                    id="edu-period"
                    type="text"
                    maxLength={40}
                    value={draft.education.period}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        education: { ...draft.education, period: e.target.value },
                      })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="edu-gpa-en" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'GPA (EN) *' : 'IPK (EN) *'}
                  </label>
                  <input
                    id="edu-gpa-en"
                    type="text"
                    maxLength={40}
                    value={draft.education.gpaEn}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        education: { ...draft.education, gpaEn: e.target.value },
                      })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="edu-gpa-id" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'GPA (ID) *' : 'IPK (ID) *'}
                  </label>
                  <input
                    id="edu-gpa-id"
                    type="text"
                    maxLength={40}
                    value={draft.education.gpaId}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        education: { ...draft.education, gpaId: e.target.value },
                      })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edu-focus-en" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'Academic Focus (EN)' : 'Fokus Studi (EN)'}
                </label>
                <textarea
                  id="edu-focus-en"
                  rows={2}
                  maxLength={600}
                  value={draft.education.focusEn}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      education: { ...draft.education, focusEn: e.target.value },
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edu-focus-id" className="block text-xs font-semibold text-[var(--mute)]">
                  {locale === 'en' ? 'Academic Focus (ID)' : 'Fokus Studi (ID)'}
                </label>
                <textarea
                  id="edu-focus-id"
                  rows={2}
                  maxLength={600}
                  value={draft.education.focusId}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      education: { ...draft.education, focusId: e.target.value },
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <div className="min-w-0 flex-1 text-xs">
              {saveState === 'saving' && (
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--brass)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Auto-saving to cloud...' : 'Menyimpan otomatis...'}</span>
                </span>
              )}
              {saveState === 'pending' && (
                <span className="font-medium text-[var(--brass)]">
                  {locale === 'en' ? 'Pending auto-save...' : 'Menyiapkan simpan otomatis...'}
                </span>
              )}
              {saveState === 'saved' && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {locale === 'en' ? 'Auto-saved globally' : 'Tersimpan otomatis secara global'}
                  </span>
                </span>
              )}
              {saveState === 'incomplete' && (
                <span className="font-medium text-amber-600 dark:text-amber-300">
                  {locale === 'en'
                    ? 'Fill required fields (*) and valid email to auto-save.'
                    : 'Lengkapi kolom wajib (*) & email valid untuk auto-save.'}
                </span>
              )}
              {saveState === 'idle' && (
                <span className="text-[var(--mute)]">
                  {locale === 'en' ? 'Auto-save ready' : 'Auto-save aktif'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[#1a1405] transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)] cursor-pointer"
            >
              {locale === 'en' ? 'Done' : 'Tutup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
