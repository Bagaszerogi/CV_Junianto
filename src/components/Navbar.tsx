import { useEffect, useRef, useState } from 'react';
import { type User } from 'firebase/auth';
import { ChevronDown, Link2, LogOut, Menu, Pencil, Printer, X } from 'lucide-react';
import { Locale } from '../data/cvData';
import { SiteCopyLocale } from '../utils/cvFirestoreApi';
import { EditableText } from './EditableText';

interface NavbarProps {
  locale: Locale;
  brandShort: string;
  siteCopy: SiteCopyLocale;
  firebaseUser: User | null;
  isAdminUser: boolean;
  onSaveBrandShort: (nextValue: string) => Promise<void>;
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
  onOpenProfileEdit: () => void;
  onOpenInvites: () => void;
  onLogout: () => void;
  onPrint: () => void;
}

export function Navbar({
  locale,
  brandShort,
  siteCopy,
  firebaseUser,
  isAdminUser,
  onSaveBrandShort,
  onSaveSiteCopyField,
  onOpenProfileEdit,
  onOpenInvites,
  onLogout,
  onPrint,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems: { href: string; field: keyof SiteCopyLocale; label: string }[] = [
    { href: '#profile', field: 'navProfile', label: siteCopy.navProfile },
    { href: '#experience', field: 'navExperience', label: siteCopy.navExperience },
    { href: '#projects', field: 'navProjects', label: siteCopy.navProjects },
    { href: '#tech-stack', field: 'navStack', label: siteCopy.navStack },
    { href: '#contact', field: 'navContact', label: siteCopy.navContact },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-6">
        {/* Zone 1: Single text element Brand Title */}
        <a
          href="#profile"
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          <EditableText
            value={brandShort}
            canEdit={isAdminUser}
            maxLength={60}
            onSave={onSaveBrandShort}
          />
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
              <EditableText
                value={item.label}
                canEdit={isAdminUser}
                maxLength={40}
                onSave={(val) => onSaveSiteCopyField(item.field, val)}
              />
            </a>
          ))}
        </nav>

        {/* Zone 3: Top-right Print PDF (invited viewer) or Admin Menu */}
        <div className="flex items-center gap-3 shrink-0" ref={menuRef}>
          {!firebaseUser ? (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'en' ? 'Print / PDF' : 'Cetak PDF'}</span>
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>
                  {isAdminUser
                    ? locale === 'en'
                      ? 'Edit Mode'
                      : 'Mode Edit'
                    : locale === 'en'
                      ? 'Account'
                      : 'Akun'}
                </span>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                      {firebaseUser.email}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {isAdminUser
                        ? locale === 'en'
                          ? 'Admin Access Active'
                          : 'Akses Admin Aktif'
                        : locale === 'en'
                          ? 'Read-only Account'
                          : 'Akun Hanya Baca'}
                    </p>
                  </div>

                  {isAdminUser && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenInvites();
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-blue-700 hover:bg-blue-50/70 dark:text-blue-400 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {locale === 'en' ? 'Manage Invite Links' : 'Kelola Link Undangan'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenProfileEdit();
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>
                          {locale === 'en'
                            ? 'Edit Profile, Photo & Contact'
                            : 'Ubah Profil, Foto & Kontak'}
                        </span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onPrint();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    <span>{siteCopy.downloadPdf}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:border-slate-800 dark:text-red-400 dark:hover:bg-red-950/50 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Sign Out' : 'Keluar'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

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
