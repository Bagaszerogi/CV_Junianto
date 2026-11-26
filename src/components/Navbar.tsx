import { useEffect, useRef, useState } from 'react';
import { type User } from 'firebase/auth';
import { ChevronDown, Link2, LogOut, Menu, Pencil, Printer, X } from 'lucide-react';
import { Locale } from '../data/cvData';
import { SiteCopyLocale } from '../utils/cvFirestoreApi';
import { EditableText } from './EditableText';
import { BrandLogo } from './BrandLogo';

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
    <header className="no-print sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-6 px-[clamp(20px,5vw,48px)]">
        {/* Zone 1: Brass/Navy Brand Monogram + Short Name */}
        <a
          href="#profile"
          className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-[var(--ink)] whitespace-nowrap shrink-0"
        >
          <BrandLogo className="h-8 w-8 shrink-0" />
          <span className="inline-flex items-baseline">
            <EditableText
              value={brandShort}
              canEdit={isAdminUser}
              maxLength={60}
              onSave={onSaveBrandShort}
            />
            <span className="not-italic text-[var(--brass)]" aria-hidden="true">
              .
            </span>
          </span>
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="nav-link-editorial whitespace-nowrap shrink-0"
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

        {/* Zone 3: Single Primary Top-Right Action (Print PDF or Admin Menu) */}
        <div className="flex items-center gap-2.5 shrink-0" ref={menuRef}>
          {!firebaseUser ? (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2 text-xs font-semibold text-[#1a1405] transition-colors duration-200 hover:bg-[var(--ink)] hover:text-[var(--bg)] whitespace-nowrap shrink-0 cursor-pointer"
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
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2 text-xs font-semibold text-[#1a1405] transition-colors duration-200 hover:bg-[var(--ink)] hover:text-[var(--bg)] whitespace-nowrap shrink-0 cursor-pointer"
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
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg2)] py-1.5 shadow-xl">
                  <div className="border-b border-[var(--line)] px-4 py-2.5">
                    <p className="truncate text-xs font-semibold text-[var(--ink)]">
                      {firebaseUser.email}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--mute)]">
                      {isAdminUser
                        ? locale === 'en'
                          ? 'Admin Access Active'
                          : 'Akses Admin Aktif'
                        : locale === 'en'
                          ? 'Verification Pending'
                          : 'Menunggu Verifikasi'}
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
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-[var(--brass)] hover:bg-[var(--card)] cursor-pointer"
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
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-[var(--ink)] hover:bg-[var(--card)] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5 text-[var(--mute)]" aria-hidden="true" />
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
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-[var(--ink)] hover:bg-[var(--card)] cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-[var(--mute)]" aria-hidden="true" />
                    <span>{siteCopy.downloadPdf}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2.5 border-t border-[var(--line)] px-4 py-2.5 text-left text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400 cursor-pointer"
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition-colors hover:border-[var(--brass)] md:hidden cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-[var(--line)] bg-[var(--bg2)] px-6 py-4 md:hidden"
        >
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm font-medium text-[var(--mute)] hover:text-[var(--ink)]"
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
