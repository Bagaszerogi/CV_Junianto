import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  Copy,
  Mail,
  MapPin,
  Phone,
  ArrowUpRight,
  Sun,
  Moon,
  Printer,
  Pencil,
  Camera,
} from 'lucide-react';
import { Locale } from '../data/cvData';
import {
  compressPortraitImage,
  CvProfileData,
  MetricItem,
  SiteCopyLocale,
} from '../utils/cvFirestoreApi';
import { sanitizeEmailForHref, sanitizePortraitSrc, sanitizeWhatsAppHref } from '../utils/safeUrls';
import { EditableText } from './EditableText';
import { ProfileEditTab } from './ProfileEditModal';

export type ThemeMode = 'light' | 'dark';

interface HeroSectionProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  profile: CvProfileData;
  siteCopy: SiteCopyLocale;
  isAdminUser: boolean;
  onSaveProfilePatch: (patch: Partial<CvProfileData>) => Promise<void>;
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
  onOpenProfileEdit: (tab?: ProfileEditTab) => void;
  onPrint: () => void;
}

export function HeroSection({
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
  profile,
  siteCopy,
  isAdminUser,
  onSaveProfilePatch,
  onSaveSiteCopyField,
  onOpenProfileEdit,
  onPrint,
}: HeroSectionProps) {
  const [imgError, setImgError] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setImgError(false);
  }, [profile.portraitDataUrl]);

  const handleCopy = async (text: string, field: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleQuickPhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAdminUser) return;
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressPortraitImage(file);
      await onSaveProfilePatch({ portraitDataUrl: compressed });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveMetricField = async (
    idx: number,
    field: 'value' | 'label' | 'detail',
    nextVal: string
  ) => {
    const nextMetrics: MetricItem[] = profile.metrics.map((m, i) => {
      if (i !== idx) return m;
      if (field === 'value') {
        return locale === 'en' ? { ...m, value: nextVal } : { ...m, valueId: nextVal };
      }
      if (field === 'label') {
        return locale === 'en' ? { ...m, label: nextVal } : { ...m, labelId: nextVal };
      }
      return locale === 'en' ? { ...m, detail: nextVal } : { ...m, detailId: nextVal };
    });
    await onSaveProfilePatch({ metrics: nextMetrics });
  };

  const digits = profile.phoneDisplay.replace(/\D/g, '');
  const phoneHref = digits.startsWith('0')
    ? `tel:+62${digits.slice(1)}`
    : digits
      ? `tel:+${digits}`
      : '#';

  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <section
      id="profile"
      className="print-section border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto max-w-6xl px-6 py-12 print:px-0 print:py-0 md:py-16">
        {/* Split-screen hero with equal-height columns */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 gap-10 print:grid-cols-12 print:gap-5 lg:grid-cols-12 lg:items-stretch"
        >
          {/* Left Column: Typographic hierarchy, profile prose, and functional controls */}
          <div className="flex flex-col justify-between print:col-span-7 lg:col-span-7">
            <div>
              {/* Toolbar row: Kicker + Theme & Language Switches */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
                  <EditableText
                    value={locale === 'en' ? profile.kickerEn : profile.kickerId}
                    canEdit={isAdminUser}
                    maxLength={160}
                    onSave={(val) =>
                      onSaveProfilePatch(locale === 'en' ? { kickerEn: val } : { kickerId: val })
                    }
                  />
                </p>

                <div className="no-print flex items-center gap-2">
                  {/* Light / Dark Theme Switch */}
                  <div
                    role="group"
                    aria-label="Theme mode"
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() => onThemeChange('light')}
                      aria-label="Light mode"
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onThemeChange('dark')}
                      aria-label="Dark mode"
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Dark</span>
                    </button>
                  </div>

                  {/* Language Switch */}
                  <div
                    role="group"
                    aria-label="Language switch"
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() => onLocaleChange('en')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                        locale === 'en'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => onLocaleChange('id')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                        locale === 'id'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      ID
                    </button>
                  </div>
                </div>
              </div>

              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-slate-950 text-balance print:mt-2 print:text-2xl dark:text-white sm:text-5xl">
                <EditableText
                  value={profile.name}
                  canEdit={isAdminUser}
                  maxLength={120}
                  onSave={(val) => onSaveProfilePatch({ name: val })}
                />
              </h1>

              <p className="mt-2 text-lg font-semibold text-blue-700 print:mt-1 print:text-sm dark:text-blue-400">
                <EditableText
                  value={locale === 'en' ? profile.titleEn : profile.titleId}
                  canEdit={isAdminUser}
                  maxLength={140}
                  onSave={(val) =>
                    onSaveProfilePatch(locale === 'en' ? { titleEn: val } : { titleId: val })
                  }
                />
              </p>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 print:mt-3 print:text-xs print:leading-snug dark:text-slate-300">
                <EditableText
                  value={locale === 'en' ? profile.summaryEn : profile.summaryId}
                  canEdit={isAdminUser}
                  multiline
                  maxLength={1500}
                  onSave={(val) =>
                    onSaveProfilePatch(locale === 'en' ? { summaryEn: val } : { summaryId: val })
                  }
                />
              </p>
            </div>

            {/* Primary Actions */}
            <div className="no-print mt-8 flex flex-wrap items-center gap-3 pt-4">
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <EditableText
                  value={siteCopy.downloadPdf}
                  canEdit={isAdminUser}
                  maxLength={80}
                  onSave={(val) => onSaveSiteCopyField('downloadPdf', val)}
                />
              </button>

              <a
                href={`mailto:${sanitizeEmailForHref(profile.email)}?subject=${encodeURIComponent(`Hospitality IT Opportunity — ${profile.name}`)}`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                <EditableText
                  value={siteCopy.heroSendEmail}
                  canEdit={isAdminUser}
                  maxLength={50}
                  onSave={(val) => onSaveSiteCopyField('heroSendEmail', val)}
                />
              </a>

              <a
                href={sanitizeWhatsAppHref(profile.whatsappHref)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
              >
                <span>WhatsApp</span>
                <ArrowUpRight className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => handleCopy(profile.email, 'email')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedField === 'email' ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Copied' : 'Disalin'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Copy Email' : 'Salin Email'}</span>
                  </>
                )}
              </button>

              {isAdminUser && (
                <button
                  type="button"
                  onClick={() => onOpenProfileEdit('identity')}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Edit All Profile Fields' : 'Editor Lengkap Profil'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Editorial Portrait & Executive Dossier Card */}
          <div className="print:col-span-5 lg:col-span-5">
            <div className="print-dossier-card flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-slate-50/75 p-6 shadow-xs transition-colors print:rounded-lg print:border-slate-300 print:bg-slate-50 print:p-4 dark:border-slate-800 dark:bg-slate-950/90 sm:p-7">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 print:gap-3">
                    <div className="group/photo relative h-22 w-22 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs print:h-16 print:w-16 print:rounded-full print:border-slate-300 dark:border-slate-700 dark:bg-slate-800 sm:h-24 sm:w-24">
                      {!imgError ? (
                        <img
                          src={sanitizePortraitSrc(profile.portraitDataUrl)}
                          alt={`${profile.name} portrait`}
                          referrerPolicy="no-referrer"
                          onError={() => setImgError(true)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 font-display text-2xl font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {initials || 'JB'}
                        </div>
                      )}

                      {isAdminUser && (
                        <>
                          <button
                            type="button"
                            disabled={isUploadingPhoto}
                            onClick={() => photoInputRef.current?.click()}
                            aria-label="Change portrait photo"
                            className="no-print absolute inset-0 flex flex-col items-center justify-center bg-slate-950/55 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/photo:opacity-100 cursor-pointer"
                          >
                            <Camera className="mb-0.5 h-4 w-4" aria-hidden="true" />
                            <span>{isUploadingPhoto ? '...' : locale === 'en' ? 'Photo' : 'Ganti'}</span>
                          </button>
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleQuickPhotoUpload}
                            className="hidden"
                          />
                        </>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-emerald-700 print:hidden dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        <EditableText
                          value={siteCopy.heroActiveBadge}
                          canEdit={isAdminUser}
                          maxLength={60}
                          onSave={(val) => onSaveSiteCopyField('heroActiveBadge', val)}
                        />
                      </div>
                      <p className="mt-1 font-display text-lg font-bold tracking-tight text-slate-950 print:mt-0 print:text-sm dark:text-white">
                        <EditableText
                          value={profile.currentCompany}
                          canEdit={isAdminUser}
                          maxLength={140}
                          onSave={(val) => onSaveProfilePatch({ currentCompany: val })}
                        />
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-blue-800 print:text-xs dark:text-blue-400">
                        <EditableText
                          value={profile.currentRole}
                          canEdit={isAdminUser}
                          maxLength={140}
                          onSave={(val) => onSaveProfilePatch({ currentRole: val })}
                        />
                      </p>
                      <p className="mt-1 text-xs text-slate-500 print:text-[10px] dark:text-slate-400">
                        <EditableText
                          value={siteCopy.heroPropertyScale}
                          canEdit={isAdminUser}
                          maxLength={140}
                          onSave={(val) => onSaveSiteCopyField('heroPropertyScale', val)}
                        />
                      </p>
                    </div>
                  </div>
                </div>

                {/* Clean hairline-divided contact & verification details */}
                <div className="mt-6 divide-y divide-slate-200/80 border-t border-slate-200/80 text-sm print:mt-3 print:divide-slate-200 print:border-slate-200 print:text-xs dark:divide-slate-800 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3 py-3 print:py-1.5">
                    <a
                      href={phoneHref}
                      className="flex min-w-0 items-center gap-3 text-slate-700 transition-colors hover:text-blue-700 print:text-slate-800 dark:text-slate-200 dark:hover:text-blue-400"
                    >
                      <Phone className="h-4 w-4 shrink-0 text-slate-400 print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                      <EditableText
                        value={profile.phoneDisplay}
                        canEdit={isAdminUser}
                        maxLength={40}
                        className="font-mono tabular-nums"
                        onSave={(val) => onSaveProfilePatch({ phoneDisplay: val })}
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(profile.phoneDisplay, 'phone')}
                      aria-label="Copy phone number"
                      className="no-print inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      {copiedField === 'phone' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {locale === 'en' ? 'Copied' : 'Disalin'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{locale === 'en' ? 'Copy' : 'Salin'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 py-3 print:py-1.5">
                    <a
                      href={`mailto:${sanitizeEmailForHref(profile.email)}`}
                      className="flex min-w-0 items-center gap-3 text-slate-700 transition-colors hover:text-blue-700 print:text-slate-800 dark:text-slate-200 dark:hover:text-blue-400"
                    >
                      <Mail className="h-4 w-4 shrink-0 text-slate-400 print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                      <EditableText
                        value={profile.email}
                        canEdit={isAdminUser}
                        maxLength={140}
                        className="truncate"
                        onSave={(val) => onSaveProfilePatch({ email: val })}
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(profile.email, 'email')}
                      aria-label="Copy email address"
                      className="no-print inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      {copiedField === 'email' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {locale === 'en' ? 'Copied' : 'Disalin'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{locale === 'en' ? 'Copy' : 'Salin'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-start gap-3 pt-3 print:pt-1.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                    <span className="leading-snug text-slate-600 print:text-slate-700 dark:text-slate-300">
                      <EditableText
                        value={profile.address}
                        canEdit={isAdminUser}
                        maxLength={240}
                        onSave={(val) => onSaveProfilePatch({ address: val })}
                      />
                    </span>
                  </div>
                </div>
              </div>

              <div className="no-print mt-5 flex items-center justify-between border-t border-slate-200/80 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <EditableText
                  value={siteCopy.heroDossierFooter}
                  canEdit={isAdminUser}
                  maxLength={100}
                  onSave={(val) => onSaveSiteCopyField('heroDossierFooter', val)}
                />
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                  EN / ID
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Full-width 4-Column Quantitative Strip below Hero Split */}
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 print:mt-4 print:grid-cols-4 print:rounded-lg dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          {profile.metrics.map((metric, idx) => (
            <div key={idx} className="bg-slate-50 px-5 py-4 print:bg-white print:px-3 print:py-2.5 dark:bg-slate-950">
              <p className="font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums print:text-base dark:text-white">
                <EditableText
                  value={locale === 'en' ? metric.value : metric.valueId}
                  canEdit={isAdminUser}
                  maxLength={40}
                  onSave={(val) => handleSaveMetricField(idx, 'value', val)}
                />
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800 print:mt-0.5 print:text-[11px] dark:text-slate-200">
                <EditableText
                  value={locale === 'en' ? metric.label : metric.labelId}
                  canEdit={isAdminUser}
                  maxLength={80}
                  onSave={(val) => handleSaveMetricField(idx, 'label', val)}
                />
              </p>
              <p className="mt-0.5 text-xs text-slate-500 print:text-[10px] dark:text-slate-400">
                <EditableText
                  value={locale === 'en' ? metric.detail : metric.detailId}
                  canEdit={isAdminUser}
                  maxLength={120}
                  onSave={(val) => handleSaveMetricField(idx, 'detail', val)}
                />
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
