import { useState } from 'react';
import { Printer, Menu, X } from 'lucide-react';
import { CV_PROFILE, Locale, UI_COPY } from '../data/cvData';

interface NavbarProps {
  locale: Locale;
  onPrint: () => void;
}

export function Navbar({ locale, onPrint }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = UI_COPY[locale];

  const navItems = [
    { href: '#profile', label: t.nav.profile },
    { href: '#experience', label: t.nav.experience },
    { href: '#projects', label: t.nav.projects },
    { href: '#tech-stack', label: t.nav.stack },
    { href: '#contact', label: t.nav.contact },
  ];

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-6">
        {/* Zone 1: Single text element Brand Title */}
        <a
          href="#profile"
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          {CV_PROFILE.brandShort}
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap shrink-0 py-1 text-slate-600 transition-colors duration-150 hover:text-slate-950 hover:underline hover:underline-offset-4 dark:text-slate-300 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.downloadPdf}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950 md:hidden"
        >
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
