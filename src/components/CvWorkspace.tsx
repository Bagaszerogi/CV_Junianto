import { useEffect, useRef, useState } from 'react';
import { type User } from 'firebase/auth';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowUp, Database, Link2, Pencil, ShieldAlert, Sparkles } from 'lucide-react';
import { ADMIN_EMAIL_ALLOWLIST } from '../firebase';
import { Locale } from '../data/cvData';
import {
  CvProfileData,
  DEFAULT_PROFILE_DATA,
  DEFAULT_SITE_CONTENT,
  EducationData,
  saveProfileToFirestore,
  saveSiteContentToFirestore,
  SiteContentData,
  SiteCopyLocale,
  subscribeProfile,
  subscribeSiteContent,
} from '../utils/cvFirestoreApi';
import { ResolvedInviteSession } from '../utils/inviteApi';
import type { AuthModalTab } from './AdminAuthModal';
import { ContactSection } from './ContactSection';
import { EducationReferencesSection } from './EducationReferencesSection';
import { ExperienceSection } from './ExperienceSection';
import { HeroSection, ThemeMode } from './HeroSection';
import { InviteManagerModal } from './InviteManagerModal';
import { Navbar } from './Navbar';
import { ProfileEditModal, ProfileEditTab } from './ProfileEditModal';
import { ProjectsSection } from './ProjectsSection';
import { TechStackSection } from './TechStackSection';

gsap.registerPlugin(ScrollTrigger);

interface CvWorkspaceProps {
  locale: Locale;
  onLocaleChange: (next: Locale) => void;
  theme: ThemeMode;
  onThemeChange: (next: ThemeMode) => void;
  authReady: boolean;
  firebaseUser: User | null;
  isAdminUser: boolean;
  inviteSession: ResolvedInviteSession | null;
  onLogout: () => Promise<void>;
  onOpenAuth: (tab?: AuthModalTab) => void;
}

export default function CvWorkspace({
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
  authReady,
  firebaseUser,
  isAdminUser,
  inviteSession,
  onLogout,
  onOpenAuth,
}: CvWorkspaceProps) {
  const [profile, setProfile] = useState<CvProfileData>(
    () => inviteSession?.profile ?? DEFAULT_PROFILE_DATA
  );
  const [siteContent, setSiteContent] = useState<SiteContentData>(
    () => inviteSession?.siteContent ?? DEFAULT_SITE_CONTENT
  );
  const [profileEditModal, setProfileEditModal] = useState<{
    open: boolean;
    tab: ProfileEditTab;
  }>({ open: false, tab: 'identity' });
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);

  // Sync invited snapshot when not in admin edit mode
  useEffect(() => {
    if (!isAdminUser && inviteSession) {
      setProfile(inviteSession.profile);
      setSiteContent(inviteSession.siteContent);
    }
  }, [inviteSession, isAdminUser]);

  // Live master subscriptions ONLY when signed in as verified Admin
  useEffect(() => {
    if (!authReady || !isAdminUser || !firebaseUser) return;

    const unsubProfile = subscribeProfile(
      (data) => setProfile(data),
      () => {
        // Keep current/default profile on read failure
      }
    );
    const unsubSiteContent = subscribeSiteContent(
      (data) => setSiteContent(data),
      () => {
        // Keep current/default copy on read failure
      }
    );
    return () => {
      unsubProfile();
      unsubSiteContent();
    };
  }, [authReady, firebaseUser, isAdminUser]);

  // Update browser tab title only once unlocked
  useEffect(() => {
    if (typeof document !== 'undefined' && profile.name) {
      document.title = `${profile.name} — Curriculum Vitae`;
    }
  }, [profile.name]);

  // Smooth scrolling + subtle scroll reveal animations
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const hash = anchor.getAttribute('href');
      if (!hash || hash === '#') return;
      const dest = document.querySelector(hash);
      if (dest) {
        e.preventDefault();
        lenis.scrollTo(dest as HTMLElement, { offset: -64 });
      }
    };
    document.addEventListener('click', handleAnchorClick);

    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>('[data-animate="section"]');
      sections.forEach((section) => {
        gsap.fromTo(
          section,
          { opacity: 0.92, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            scrollTrigger: {
              trigger: section,
              start: 'top 88%',
              once: true,
            },
          }
        );
      });
    });

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      ctx.revert();
      gsap.ticker.remove(tickerCallback);
      lenisRef.current = null;
      lenis.destroy();
    };
  }, []);

  const handlePrint = () => {
    gsap.set('[data-animate="section"]', { clearProps: 'transform,opacity' });
    window.print();
  };

  const handleBackToTop = () => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { duration: 0.8 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openProfileEdit = (tab: ProfileEditTab = 'identity') => {
    setProfileEditModal({ open: true, tab });
  };

  const handleSaveProfilePatch = async (patch: Partial<CvProfileData>) => {
    const nextProfile: CvProfileData = {
      ...profile,
      ...patch,
    };
    await saveProfileToFirestore(nextProfile, Boolean(profile.fromFirestore));
  };

  const handleSaveEducationField = async (patch: Partial<EducationData>) => {
    const nextProfile: CvProfileData = {
      ...profile,
      education: {
        ...profile.education,
        ...patch,
      },
    };
    await saveProfileToFirestore(nextProfile, Boolean(profile.fromFirestore));
  };

  const handleSaveSiteCopyField = async (field: keyof SiteCopyLocale, value: string) => {
    const nextSiteContent: SiteContentData = {
      ...siteContent,
      [locale]: {
        ...siteContent[locale],
        [field]: value,
      },
    };
    await saveSiteContentToFirestore(nextSiteContent, Boolean(siteContent.fromFirestore));
  };

  const activeSiteCopy = siteContent[locale];
  const needsEmailVerifyBanner = Boolean(
    firebaseUser &&
      !isAdminUser &&
      !firebaseUser.emailVerified &&
      ADMIN_EMAIL_ALLOWLIST.has((firebaseUser.email ?? '').trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:min-h-0 print:bg-white print:text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <Navbar
        locale={locale}
        brandShort={profile.brandShort}
        siteCopy={activeSiteCopy}
        firebaseUser={firebaseUser}
        isAdminUser={isAdminUser}
        onSaveBrandShort={(val) => handleSaveProfilePatch({ brandShort: val })}
        onSaveSiteCopyField={handleSaveSiteCopyField}
        onOpenProfileEdit={() => openProfileEdit('identity')}
        onOpenInvites={() => setInviteModalOpen(true)}
        onLogout={() => void onLogout()}
        onPrint={handlePrint}
      />

      {isAdminUser && (
        <div className="no-print border-b border-blue-200 bg-blue-50/90 px-6 py-2 text-xs text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/60 dark:text-blue-100">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span className="font-semibold">
                {locale === 'en' ? 'Full Edit Mode Active' : 'Mode Edit Penuh Aktif'}
              </span>
              <span className="text-blue-800/80 dark:text-blue-300">
                {locale === 'en'
                  ? '— Click any text to edit & auto-sync to your private invite links.'
                  : '— Klik teks mana saja untuk mengedit & otomatis tersinkron ke link undangan.'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 cursor-pointer"
              >
                <Link2 className="h-3 w-3" aria-hidden="true" />
                <span>{locale === 'en' ? 'Invite Links' : 'Link Undangan'}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('diagnostics')}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 cursor-pointer"
              >
                <Database className="h-3 w-3" aria-hidden="true" />
                <span>{locale === 'en' ? 'DB & SSO Check' : 'Cek DB & SSO'}</span>
              </button>
              <button
                type="button"
                onClick={() => openProfileEdit('identity')}
                className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                <span>{locale === 'en' ? 'Profile & Photo Editor' : 'Editor Profil & Foto'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {needsEmailVerifyBanner && (
        <div className="no-print border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-100">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <span>
                {locale === 'en'
                  ? `Signed in as ${firebaseUser?.email}, waiting for email verification to unlock editing.`
                  : `Masuk sebagai ${firebaseUser?.email}, menunggu verifikasi email untuk membuka fitur edit.`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth('email')}
              className="rounded-md bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 cursor-pointer"
            >
              {locale === 'en' ? 'Verify Email Now' : 'Verifikasi Email Sekarang'}
            </button>
          </div>
        </div>
      )}

      <main className="print:mx-auto print:max-w-full">
        <HeroSection
          locale={locale}
          onLocaleChange={onLocaleChange}
          theme={theme}
          onThemeChange={onThemeChange}
          profile={profile}
          siteCopy={activeSiteCopy}
          isAdminUser={isAdminUser}
          onSaveProfilePatch={handleSaveProfilePatch}
          onSaveSiteCopyField={handleSaveSiteCopyField}
          onOpenProfileEdit={openProfileEdit}
          onPrint={handlePrint}
        />
        <ExperienceSection
          locale={locale}
          authReady={authReady && Boolean(firebaseUser)}
          isAdminUser={isAdminUser}
          siteCopy={activeSiteCopy}
          invitedItems={!isAdminUser ? inviteSession?.experiences : undefined}
          onSaveSiteCopyField={handleSaveSiteCopyField}
        />
        <ProjectsSection
          locale={locale}
          authReady={authReady && Boolean(firebaseUser)}
          isAdminUser={isAdminUser}
          siteCopy={activeSiteCopy}
          invitedProjects={!isAdminUser ? inviteSession?.projects : undefined}
          onSaveSiteCopyField={handleSaveSiteCopyField}
          onOpenAuth={() => onOpenAuth('google')}
        />
        <TechStackSection
          locale={locale}
          authReady={authReady && Boolean(firebaseUser)}
          isAdminUser={isAdminUser}
          siteCopy={activeSiteCopy}
          invitedItems={!isAdminUser ? inviteSession?.techStacks : undefined}
          onSaveSiteCopyField={handleSaveSiteCopyField}
        />
        <EducationReferencesSection
          locale={locale}
          authReady={authReady && Boolean(firebaseUser)}
          isAdminUser={isAdminUser}
          education={profile.education}
          siteCopy={activeSiteCopy}
          invitedReferences={!isAdminUser ? inviteSession?.references : undefined}
          onSaveEducationField={handleSaveEducationField}
          onSaveSiteCopyField={handleSaveSiteCopyField}
          onEditEducation={() => openProfileEdit('education')}
        />
        <ContactSection
          locale={locale}
          profile={profile}
          siteCopy={activeSiteCopy}
          isAdminUser={isAdminUser}
          onSaveProfilePatch={handleSaveProfilePatch}
          onSaveSiteCopyField={handleSaveSiteCopyField}
          onPrint={handlePrint}
        />
      </main>

      <ProfileEditModal
        isOpen={profileEditModal.open}
        initialTab={profileEditModal.tab}
        locale={locale}
        profile={profile}
        onClose={() => setProfileEditModal((prev) => ({ ...prev, open: false }))}
      />

      <InviteManagerModal
        isOpen={inviteModalOpen}
        locale={locale}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* Always-floating Back to Top Button (bottom-right) */}
      <button
        type="button"
        onClick={handleBackToTop}
        aria-label={locale === 'en' ? 'Back to top' : 'Kembali ke atas'}
        title={locale === 'en' ? 'Back to top' : 'Kembali ke atas'}
        className="no-print fixed right-5 bottom-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-800 shadow-lg backdrop-blur-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-600 hover:bg-blue-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:bg-blue-600 cursor-pointer"
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
