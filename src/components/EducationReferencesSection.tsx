import { useState } from 'react';
import { Check, Copy, Phone } from 'lucide-react';
import { EDUCATION, Locale, REFERENCES, UI_COPY } from '../data/cvData';

interface EducationReferencesSectionProps {
  locale: Locale;
}

export function EducationReferencesSection({ locale }: EducationReferencesSectionProps) {
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const t = UI_COPY[locale].sections;

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    } catch {
      // Ignore if clipboard unavailable
    }
  };

  return (
    <section
      id="education"
      className="border-b border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left: Education */}
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
              {t.educationKicker}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t.educationTitle}
            </h2>

            <div className="print-break-inside-avoid mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-7 dark:border-slate-800 dark:bg-slate-950">
              <p className="font-mono text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                {EDUCATION.period} · {locale === 'en' ? EDUCATION.gpa : EDUCATION.gpaId}
              </p>
              <h3 className="mt-3 font-display text-xl font-bold text-slate-950 dark:text-white">
                {EDUCATION.institution}
              </h3>
              <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-400">
                {EDUCATION.major[locale]}
              </p>
              <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
                {EDUCATION.focus[locale]}
              </p>
            </div>
          </div>

          {/* Right: Professional References */}
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
              {t.referencesKicker}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t.referencesTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t.referencesNote}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {REFERENCES.map((ref) => (
                <div
                  key={ref.name}
                  className="print-break-inside-avoid flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
                      {ref.name}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {ref.role}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <a
                      href={ref.phoneHref}
                      className="inline-flex items-center gap-2 font-mono text-xs font-medium text-slate-700 transition-colors hover:text-blue-700 tabular-nums dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                      <span>{ref.phone}</span>
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
    </section>
  );
}
