import { useState } from 'react';
import { Locale, TECH_STACK, TechCategory, UI_COPY } from '../data/cvData';

interface TechStackSectionProps {
  locale: Locale;
}

type StackFilter = 'all' | TechCategory['group'];

export function TechStackSection({ locale }: TechStackSectionProps) {
  const [groupFilter, setGroupFilter] = useState<StackFilter>('all');
  const t = UI_COPY[locale].sections;

  const visibleCategories = TECH_STACK.filter((cat) =>
    groupFilter === 'all' ? true : cat.group === groupFilter
  );

  const filterKeys: StackFilter[] = ['all', 'core', 'infra', 'guest', 'productivity'];

  return (
    <section
      id="tech-stack"
      className="border-b border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-950 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
              {t.stackKicker}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t.stackTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t.stackDesc}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter technology stack categories"
            className="no-print flex flex-wrap items-center gap-1 self-start rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800"
          >
            {filterKeys.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={groupFilter === key}
                onClick={() => setGroupFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  groupFilter === key
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {t.stackFilters[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Clean 2-column architectural grid with hairline dividers */}
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800 md:grid-cols-2">
          {visibleCategories.map((category, index) => (
            <div
              key={category.id}
              className="print-break-inside-avoid flex flex-col justify-between bg-white p-6 dark:bg-slate-900"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
                  {locale === 'en' ? category.label : category.labelId}
                </h3>
                <span className="font-mono text-xs text-slate-400 tabular-nums dark:text-slate-500">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {category.items.join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
