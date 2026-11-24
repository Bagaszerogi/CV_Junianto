import { useState } from 'react';
import { Check, Copy, Mail, MapPin, Phone, ArrowUpRight, Sun, Moon } from 'lucide-react';
import { CV_PROFILE, KEY_METRICS, Locale } from '../data/cvData';

export type ThemeMode = 'light' | 'dark';

interface HeroSectionProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export function HeroSection({
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
}: HeroSectionProps) {
  const [imgError, setImgError] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);

  const handleCopy = async (text: string, field: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  return (
    <section
      id="profile"
      className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {/* Split-screen hero with equal-height columns */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
          {/* Left Column: Typographic hierarchy, profile prose, and functional controls */}
          <div className="flex flex-col justify-between lg:col-span-7">
            <div>
              {/* Toolbar row: Kicker + Theme & Language Switches */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
                  {CV_PROFILE.kicker[locale]}
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

              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-slate-950 text-balance dark:text-white sm:text-5xl">
                {CV_PROFILE.name}
              </h1>

              <p className="mt-2 text-lg font-semibold text-blue-700 dark:text-blue-400">
                {CV_PROFILE.title[locale]}
              </p>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {CV_PROFILE.summary[locale]}
              </p>
            </div>

            {/* Primary Actions */}
            <div className="no-print mt-8 flex flex-wrap items-center gap-3 pt-4">
              <a
                href={`mailto:${CV_PROFILE.contact.email}?subject=Hospitality%20IT%20Opportunity%20%E2%80%94%20Junianto%20Bagas%20Prasetyo`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>{locale === 'en' ? 'Send Email' : 'Kirim Email'}</span>
              </a>

              <a
                href={CV_PROFILE.contact.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
              >
                <span>WhatsApp</span>
                <ArrowUpRight className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => handleCopy(CV_PROFILE.contact.email, 'email')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedField === 'email' ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Email Copied' : 'Email Disalin'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Copy Email' : 'Salin Email'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Executive Portrait & Contact Dossier Card */}
          <div className="lg:col-span-5">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-7 text-slate-100 dark:bg-slate-950">
              <div className="flex items-center gap-5">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-slate-700 bg-slate-800 sm:h-28 sm:w-28">
                  {!imgError ? (
                    <img
                      src={CV_PROFILE.portraitSrc}
                      alt="Junianto Bagas Prasetyo portrait"
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-800 font-display text-2xl font-bold text-slate-200">
                      JB
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium tracking-wide text-slate-400">
                    {locale === 'en' ? 'Current Assignment' : 'Penugasan Saat Ini'}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold tracking-wide text-white">
                    Hotel Ciputra Jakarta
                  </p>
                  <p className="mt-0.5 text-sm text-slate-300">
                    IT Supervisor
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-4 border-t border-slate-800 pt-6 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={CV_PROFILE.contact.phoneHref}
                    className="flex items-center gap-3 text-slate-200 transition-colors hover:text-white"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{CV_PROFILE.contact.phoneDisplay}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(CV_PROFILE.contact.phoneDisplay, 'phone')}
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
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <a
                    href={`mailto:${CV_PROFILE.contact.email}`}
                    className="truncate text-slate-200 transition-colors hover:text-white"
                  >
                    {CV_PROFILE.contact.email}
                  </a>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="leading-snug text-slate-300">
                    {CV_PROFILE.contact.address}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width 4-Column Quantitative Strip below Hero Split */}
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          {KEY_METRICS.map((metric) => (
            <div key={metric.label} className="bg-slate-50 px-5 py-4 dark:bg-slate-950">
              <p className="font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
                {locale === 'en' ? metric.value : metric.valueId}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                {locale === 'en' ? metric.label : metric.labelId}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {locale === 'en' ? metric.detail : metric.detailId}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
