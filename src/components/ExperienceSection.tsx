import { useState } from 'react';
import { EXPERIENCES, Locale, UI_COPY } from '../data/cvData';

interface ExperienceSectionProps {
  locale: Locale;
}

type RoleFilter = 'all' | 'leadership' | 'operations';

export function ExperienceSection({ locale }: ExperienceSectionProps) {
  const [filter, setFilter] = useState<RoleFilter>('all');
  const t = UI_COPY[locale].sections;

  const filteredExperiences = EXPERIENCES.filter((item) =>
    filter === 'all' ? true : item.category === filter
  );

  return (
    <section
      id="experience"
      className="border-b border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-950 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
              {t.experienceKicker}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t.experienceTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t.experienceDesc}
            </p>
          </div>

          {/* Interactive Filter Tabs */}
          <div
            role="tablist"
            aria-label="Filter work experience"
            className="no-print inline-flex items-center gap-1 self-start rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800"
          >
            {(['all', 'leadership', 'operations'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === key
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {t.filters[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Hairline-separated editorial timeline */}
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {filteredExperiences.map((exp, idx) => {
            const bullets = locale === 'en' ? exp.bullets : exp.bulletsId;
            return (
              <article
                key={exp.id}
                className="print-break-inside-avoid grid grid-cols-1 gap-6 p-6 md:grid-cols-12 md:gap-8 md:p-8"
              >
                {/* Left Meta Column */}
                <div className="md:col-span-4">
                  <p className="font-mono text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                    {String(idx + 1).padStart(2, '0')}. {locale === 'en' ? exp.period : exp.periodId}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {exp.company}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-400">
                    {locale === 'en' ? exp.role : exp.roleId}
                  </p>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {locale === 'en' ? exp.scaleContext : exp.scaleContextId}
                  </p>
                </div>

                {/* Right Achievements Column */}
                <div className="md:col-span-8">
                  <ul className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-2 h-px w-3 shrink-0 bg-slate-400 dark:bg-slate-600"
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Unboxed systems list separated with typographic middle dots */}
                  <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {locale === 'en' ? 'Core Systems:' : 'Sistem Utama:'}
                    </span>{' '}
                    {exp.systems.join(' · ')}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
