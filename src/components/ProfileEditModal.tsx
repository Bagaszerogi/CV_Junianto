import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Trash2, Upload, X } from 'lucide-react';
import { Locale } from '../data/cvData';
import {
  compressPortraitImage,
  CvProfileData,
  saveProfileToFirestore,
} from '../utils/cvFirestoreApi';
import { sanitizePortraitSrc } from '../utils/safeUrls';

export type ProfileEditTab = 'identity' | 'contact' | 'metrics' | 'education';

interface ProfileEditModalProps {
  isOpen: boolean;
  initialTab?: ProfileEditTab;
  locale: Locale;
  profile: CvProfileData;
  onClose: () => void;
}

export function ProfileEditModal({
  isOpen,
  initialTab = 'identity',
  locale,
  profile,
  onClose,
}: ProfileEditModalProps) {
  const [activeTab, setActiveTab] = useState<ProfileEditTab>(initialTab);
  const [draft, setDraft] = useState<CvProfileData>(profile);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(profile);
      setActiveTab(initialTab);
      setError(null);
    }
  }, [isOpen, initialTab, profile]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressPortraitImage(file);
      setDraft((prev) => ({ ...prev, portraitDataUrl: compressed }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process photo.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemoveDraftPhoto = () => {
    setError(null);
    setDraft((prev) => ({ ...prev, portraitDataUrl: '' }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await saveProfileToFirestore(draft, Boolean(profile.fromFirestore));
      onClose();
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

  const previewPortrait = sanitizePortraitSrc(draft.portraitDataUrl, '');
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
    'mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#0a1024]/70 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-[var(--line)] bg-[var(--bg2)] p-6 text-[var(--ink)] shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
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
                ? 'Changes are saved to Cloud Firestore and update the CV & PDF export immediately.'
                : 'Perubahan tersimpan ke Cloud Firestore dan langsung memperbarui CV serta cetak PDF.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-[var(--mute)] hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--card)] p-1">
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

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {activeTab === 'identity' && (
            <div className="space-y-4">
              {/* Portrait Photo Upload & Remove */}
              <div className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 sm:flex-row sm:items-center">
                <div className="aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-t-full rounded-b-[16px] border border-[var(--brass)] bg-[var(--card)] p-1.5">
                  <div className="h-full w-full overflow-hidden rounded-t-full rounded-b-[10px] bg-gradient-to-b from-[var(--bg2)] to-[var(--bg)]">
                    {previewPortrait ? (
                      <img
                        src={previewPortrait}
                        alt="Portrait preview"
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[var(--bg2)] to-[var(--bg)] font-display text-2xl font-bold text-[var(--brass)]">
                        {initials || 'JB'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[var(--ink)]">
                    {locale === 'en' ? 'Profile Portrait Photo (PNG / JPG / WebP)' : 'Foto Profil Utama (PNG Transparan / JPG / WebP)'}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--mute)]">
                    {locale === 'en'
                      ? 'Framed prominently on the right side in a 4:5 brass arch. Transparent PNG cutouts preserve their alpha background.'
                      : 'Ditampilkan besar di sisi kanan dalam bingkai melengkung emas 4:5. Upload PNG transparan tetap menjaga latar bening.'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brass)] px-4 py-1.5 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] cursor-pointer"
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
                    {Boolean(previewPortrait) && (
                      <button
                        type="button"
                        disabled={isProcessingPhoto}
                        onClick={handleRemoveDraftPhoto}
                        className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-300 cursor-pointer"
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
                <div>
                  <label htmlFor="prof-name" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Full Name *' : 'Nama Lengkap *'}
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    required
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="prof-brand" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Header Brand Name *' : 'Nama di Pojok Kiri Atas *'}
                  </label>
                  <input
                    id="prof-brand"
                    type="text"
                    required
                    maxLength={60}
                    value={draft.brandShort}
                    onChange={(e) => setDraft({ ...draft, brandShort: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="prof-title-en" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Headline Title (EN) *' : 'Judul Profesi (EN) *'}
                  </label>
                  <input
                    id="prof-title-en"
                    type="text"
                    required
                    maxLength={140}
                    value={draft.titleEn}
                    onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="prof-title-id" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Headline Title (ID) *' : 'Judul Profesi (ID) *'}
                  </label>
                  <input
                    id="prof-title-id"
                    type="text"
                    required
                    maxLength={140}
                    value={draft.titleId}
                    onChange={(e) => setDraft({ ...draft, titleId: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
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
                <div>
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
                <div>
                  <label htmlFor="prof-cur-comp" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Current Company *' : 'Tempat Kerja Saat Ini *'}
                  </label>
                  <input
                    id="prof-cur-comp"
                    type="text"
                    required
                    maxLength={140}
                    value={draft.currentCompany}
                    onChange={(e) => setDraft({ ...draft, currentCompany: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="prof-cur-role" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Current Position *' : 'Jabatan Saat Ini *'}
                  </label>
                  <input
                    id="prof-cur-role"
                    type="text"
                    required
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
                <div>
                  <label htmlFor="prof-phone" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Phone Number *' : 'Nomor Telepon *'}
                  </label>
                  <input
                    id="prof-phone"
                    type="text"
                    required
                    maxLength={40}
                    value={draft.phoneDisplay}
                    onChange={(e) => setDraft({ ...draft, phoneDisplay: e.target.value })}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label htmlFor="prof-email" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Email Address *' : 'Alamat Email *'}
                  </label>
                  <input
                    id="prof-email"
                    type="email"
                    required
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
                  required
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
                  required
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
                  required
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
                  <div>
                    <label className="block text-xs font-semibold text-[var(--mute)]">
                      {locale === 'en' ? `Metric ${idx + 1} Value` : `Nilai Metrik ${idx + 1}`}
                    </label>
                    <input
                      type="text"
                      required
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
                  <div>
                    <label className="block text-xs font-semibold text-[var(--mute)]">
                      {locale === 'en' ? 'Label (EN / ID)' : 'Judul Metrik'}
                    </label>
                    <input
                      type="text"
                      required
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
                  <div className="flex flex-col justify-between gap-1">
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
                  required
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
                <div>
                  <label htmlFor="edu-major-en" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Major (EN) *' : 'Jurusan (EN) *'}
                  </label>
                  <input
                    id="edu-major-en"
                    type="text"
                    required
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
                <div>
                  <label htmlFor="edu-major-id" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Major (ID) *' : 'Jurusan (ID) *'}
                  </label>
                  <input
                    id="edu-major-id"
                    type="text"
                    required
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
                <div>
                  <label htmlFor="edu-period" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'Years *' : 'Tahun *'}
                  </label>
                  <input
                    id="edu-period"
                    type="text"
                    required
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
                <div>
                  <label htmlFor="edu-gpa-en" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'GPA (EN) *' : 'IPK (EN) *'}
                  </label>
                  <input
                    id="edu-gpa-en"
                    type="text"
                    required
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
                <div>
                  <label htmlFor="edu-gpa-id" className="block text-xs font-semibold text-[var(--mute)]">
                    {locale === 'en' ? 'GPA (ID) *' : 'IPK (ID) *'}
                  </label>
                  <input
                    id="edu-gpa-id"
                    type="text"
                    required
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

          <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
            >
              {locale === 'en' ? 'Cancel' : 'Batal'}
            </button>
            <button
              type="submit"
              disabled={isSaving || isProcessingPhoto}
              className="rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[#1a1405] transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
            >
              {isSaving
                ? locale === 'en'
                  ? 'Saving...'
                  : 'Menyimpan...'
                : locale === 'en'
                  ? 'Save All Changes'
                  : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
