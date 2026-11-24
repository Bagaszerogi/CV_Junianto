import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
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

  const tabs: { key: ProfileEditTab; en: string; id: string }[] = [
    { key: 'identity', en: 'Photo & Title', id: 'Foto & Judul' },
    { key: 'contact', en: 'Contact & Summary', id: 'Kontak & Profil' },
    { key: 'metrics', en: 'KPI Metrics', id: 'Metrik Utama' },
    { key: 'education', en: 'Education', id: 'Pendidikan' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="profile-edit-title"
              className="font-display text-xl font-bold text-slate-950 dark:text-white"
            >
              {locale === 'en'
                ? 'Edit CV Profile, Contact & Education'
                : 'Ubah Profil, Foto, Kontak & Pendidikan'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {locale === 'en'
                ? 'Changes are saved to Cloud Firestore and update the CV & PDF export immediately.'
                : 'Perubahan tersimpan ke Cloud Firestore dan langsung memperbarui CV serta cetak PDF.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
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
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {activeTab === 'identity' && (
            <div className="space-y-4">
              {/* Portrait Photo Upload */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-800">
                  <img
                    src={sanitizePortraitSrc(draft.portraitDataUrl)}
                    alt="Portrait preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {locale === 'en' ? 'Profile Portrait Photo' : 'Foto Profil CV'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {locale === 'en'
                      ? 'Automatically cropped 1:1 and compressed for fast loading.'
                      : 'Otomatis dipotong 1:1 dan dikompresi agar ringan dan cepat.'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {isProcessingPhoto
                          ? locale === 'en'
                            ? 'Processing...'
                            : 'Memproses...'
                          : locale === 'en'
                            ? 'Change Photo'
                            : 'Ganti Foto'}
                      </span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Full Name *' : 'Nama Lengkap *'}
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    required
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="prof-brand" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Header Brand Name *' : 'Nama di Pojok Kiri Atas *'}
                  </label>
                  <input
                    id="prof-brand"
                    type="text"
                    required
                    maxLength={60}
                    value={draft.brandShort}
                    onChange={(e) => setDraft({ ...draft, brandShort: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="prof-title-en" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Headline Title (EN) *' : 'Judul Profesi (EN) *'}
                  </label>
                  <input
                    id="prof-title-en"
                    type="text"
                    required
                    maxLength={140}
                    value={draft.titleEn}
                    onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="prof-title-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Headline Title (ID) *' : 'Judul Profesi (ID) *'}
                  </label>
                  <input
                    id="prof-title-id"
                    type="text"
                    required
                    maxLength={140}
                    value={draft.titleId}
                    onChange={(e) => setDraft({ ...draft, titleId: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="prof-kicker-en" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Sub-Kicker (EN)' : 'Keterangan Atas (EN)'}
                  </label>
                  <input
                    id="prof-kicker-en"
                    type="text"
                    maxLength={160}
                    value={draft.kickerEn}
                    onChange={(e) => setDraft({ ...draft, kickerEn: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="prof-kicker-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Sub-Kicker (ID)' : 'Keterangan Atas (ID)'}
                  </label>
                  <input
                    id="prof-kicker-id"
                    type="text"
                    maxLength={160}
                    value={draft.kickerId}
                    onChange={(e) => setDraft({ ...draft, kickerId: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="prof-cur-comp" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Current Company *' : 'Tempat Kerja Saat Ini *'}
                  </label>
                  <input
                    id="prof-cur-comp"
                    type="text"
                    required
                    maxLength={140}
                    value={draft.currentCompany}
                    onChange={(e) => setDraft({ ...draft, currentCompany: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="prof-cur-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Current Position *' : 'Jabatan Saat Ini *'}
                  </label>
                  <input
                    id="prof-cur-role"
                    type="text"
                    required
                    maxLength={140}
                    value={draft.currentRole}
                    onChange={(e) => setDraft({ ...draft, currentRole: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="prof-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Phone Number *' : 'Nomor Telepon *'}
                  </label>
                  <input
                    id="prof-phone"
                    type="text"
                    required
                    maxLength={40}
                    value={draft.phoneDisplay}
                    onChange={(e) => setDraft({ ...draft, phoneDisplay: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="prof-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Email Address *' : 'Alamat Email *'}
                  </label>
                  <input
                    id="prof-email"
                    type="email"
                    required
                    maxLength={140}
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prof-wa" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'WhatsApp URL (https://wa.me/...)' : 'Link WhatsApp (https://wa.me/...)'}
                </label>
                <input
                  id="prof-wa"
                  type="url"
                  maxLength={200}
                  value={draft.whatsappHref}
                  onChange={(e) => setDraft({ ...draft, whatsappHref: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="prof-address" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'Address *' : 'Alamat Lengkap *'}
                </label>
                <input
                  id="prof-address"
                  type="text"
                  required
                  maxLength={240}
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="prof-summary-en" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'Profile Summary (EN) *' : 'Ringkasan Profil (EN) *'}
                </label>
                <textarea
                  id="prof-summary-en"
                  rows={3}
                  required
                  maxLength={1500}
                  value={draft.summaryEn}
                  onChange={(e) => setDraft({ ...draft, summaryEn: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="prof-summary-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'Profile Summary (ID) *' : 'Ringkasan Profil (ID) *'}
                </label>
                <textarea
                  id="prof-summary-id"
                  rows={3}
                  required
                  maxLength={1500}
                  value={draft.summaryId}
                  onChange={(e) => setDraft({ ...draft, summaryId: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-4">
              {draft.metrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {locale === 'en' ? `Metric ${idx + 1} Value` : `Nilai Metrik ${idx + 1}`}
                    </label>
                    <input
                      type="text"
                      value={metric.value}
                      onChange={(e) => {
                        const updated = [...draft.metrics];
                        updated[idx] = { ...updated[idx], value: e.target.value, valueId: e.target.value };
                        setDraft({ ...draft, metrics: updated });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {locale === 'en' ? 'Label (EN / ID)' : 'Judul Metrik'}
                    </label>
                    <input
                      type="text"
                      value={locale === 'en' ? metric.label : metric.labelId}
                      onChange={(e) => {
                        const updated = [...draft.metrics];
                        updated[idx] =
                          locale === 'en'
                            ? { ...updated[idx], label: e.target.value }
                            : { ...updated[idx], labelId: e.target.value };
                        setDraft({ ...draft, metrics: updated });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {locale === 'en' ? 'Sub-detail' : 'Keterangan'}
                    </label>
                    <input
                      type="text"
                      value={locale === 'en' ? metric.detail : metric.detailId}
                      onChange={(e) => {
                        const updated = [...draft.metrics];
                        updated[idx] =
                          locale === 'en'
                            ? { ...updated[idx], detail: e.target.value }
                            : { ...updated[idx], detailId: e.target.value };
                        setDraft({ ...draft, metrics: updated });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'education' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="edu-inst" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edu-major-en" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="edu-major-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="edu-period" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="edu-gpa-en" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="edu-gpa-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edu-focus-en" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="edu-focus-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {locale === 'en' ? 'Cancel' : 'Batal'}
            </button>
            <button
              type="submit"
              disabled={isSaving || isProcessingPhoto}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
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
