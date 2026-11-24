import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Locale, UI_COPY } from '../data/cvData';
import { CvProfileData } from '../utils/cvFirestoreApi';
import { sanitizeEmailForHref, sanitizePortraitSrc, sanitizeWhatsAppHref } from '../utils/safeUrls';
import { ProfileEditTab } from './ProfileEditModal';

export type ThemeMode = 'light' | 'dark';

interface HeroSectionProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  profile: CvProfileData;
  isAdminUser: boolean;
  onOpenProfileEdit: (tab?: ProfileEditTab) => void;
  onPrint: () => void;
}

export function HeroSection({
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
  profile,
  isAdminUser,
  onOpenProfileEdit,
  onPrint,
}: HeroSectionProps) {
  const [imgError, setImgError] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const t = UI_COPY[locale];

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
                  {locale === 'en' ? profile.kickerEn : profile.kickerId}
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
                {profile.name}
              </h1>

              <p className="mt-2 text-lg font-semibold text-blue-700 print:mt-1 print:text-sm dark:text-blue-400">
                {locale === 'en' ? profile.titleEn : profile.titleId}
              </p>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 print:mt-3 print:text-xs print:leading-snug dark:text-slate-300">
                {locale === 'en' ? profile.summaryEn : profile.summaryId}
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
                <span>{t.downloadPdf}</span>
              </button>

              <a
                href={`mailto:${sanitizeEmailForHref(profile.email)}?subject=${encodeURIComponent(`Hospitality IT Opportunity — ${profile.name}`)}`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>{locale === 'en' ? 'Send Email' : 'Kirim Email'}</span>
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
                  <span>{locale === 'en' ? 'Edit Profile & Photo' : 'Ubah Profil & Foto'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Executive Portrait & Contact Dossier Card */}
          <div className="print:col-span-5 lg:col-span-5">
            <div className="print-dossier-card flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-7 text-slate-100 print:rounded-lg print:border-slate-300 print:bg-slate-50 print:p-4 print:text-slate-900 dark:bg-slate-950">
              <div className="flex items-center gap-5 print:gap-3">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-slate-700 bg-slate-800 print:h-16 print:w-16 print:border-slate-300 sm:h-28 sm:w-28">
                  {!imgError ? (
                    <img
                      src={sanitizePortraitSrc(profile.portraitDataUrl)}
                      alt={`${profile.name} portrait`}
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-800 font-display text-2xl font-bold text-slate-200">
                      {initials || 'CV'}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium tracking-wide text-slate-400 print:text-[10px] print:text-slate-500">
                    {locale === 'en' ? 'Current Assignment' : 'Penugasan Saat Ini'}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold tracking-wide text-white print:mt-0.5 print:text-sm print:text-slate-950">
                    {profile.currentCompany}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-300 print:text-xs print:text-slate-700">
                    {profile.currentRole}
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-4 border-t border-slate-800 pt-6 text-sm print:mt-3 print:space-y-1.5 print:border-slate-200 print:pt-3 print:text-xs">
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={phoneHref}
                    className="flex items-center gap-3 text-slate-200 transition-colors hover:text-white print:text-slate-800"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-slate-400 print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{profile.phoneDisplay}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile.phoneDisplay, 'phone')}
                    aria-label="Copy phone number"
                    className="no-print rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    {copiedField === 'phone' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400 print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                  <a
                    href={`mailto:${sanitizeEmailForHref(profile.email)}`}
                    className="truncate text-slate-200 transition-colors hover:text-white print:text-slate-800"
                  >
                    {profile.email}
                  </a>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                  <span className="leading-snug text-slate-300 print:text-slate-700">
                    {profile.address}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Full-width 4-Column Quantitative Strip below Hero Split */}
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 print:mt-4 print:grid-cols-4 print:rounded-lg dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          {profile.metrics.map((metric, idx) => (
            <div key={idx} className="bg-slate-50 px-5 py-4 print:bg-white print:px-3 print:py-2.5 dark:bg-slate-950">
              <p className="font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums print:text-base dark:text-white">
                {locale === 'en' ? metric.value : metric.valueId}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800 print:mt-0.5 print:text-[11px] dark:text-slate-200">
                {locale === 'en' ? metric.label : metric.labelId}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 print:text-[10px] dark:text-slate-400">
                {locale === 'en' ? metric.detail : metric.detailId}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
