import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Pencil, ShieldAlert, Sparkles } from 'lucide-react';
import { auth, ADMIN_EMAIL_ALLOWLIST } from './firebase';
import { checkIsAdminUser, signOutAdmin, syncAdminRecord } from './utils/projectApi';
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
} from './utils/cvFirestoreApi';
import { Locale } from './data/cvData';
import { Navbar } from './components/Navbar';
import { HeroSection, ThemeMode } from './components/HeroSection';
import { ExperienceSection } from './components/ExperienceSection';
import { ProjectsSection } from './components/ProjectsSection';
import { TechStackSection } from './components/TechStackSection';
import { EducationReferencesSection } from './components/EducationReferencesSection';
import { ContactSection } from './components/ContactSection';
import { AdminAuthModal } from './components/AdminAuthModal';
import { ProfileEditModal, ProfileEditTab } from './components/ProfileEditModal';

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('cv_theme');
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [profile, setProfile] = useState<CvProfileData>(DEFAULT_PROFILE_DATA);
  const [siteContent, setSiteContent] = useState<SiteContentData>(DEFAULT_SITE_CONTENT);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [profileEditModal, setProfileEditModal] = useState<{
    open: boolean;
    tab: ProfileEditTab;
  }>({ open: false, tab: 'identity' });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('cv_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const refreshAdminState = useCallback(async (user: User | null) => {
    if (user) {
      const adminStatus = await checkIsAdminUser(user);
      setIsAdminUser(adminStatus);
      if (adminStatus) {
        void syncAdminRecord(user);
      }
    } else {
      setIsAdminUser(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      await refreshAdminState(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [refreshAdminState]);

  useEffect(() => {
    if (!authReady) return;
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
  }, [authReady]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

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
      lenis.destroy();
    };
  }, []);

  const handlePrint = () => {
    window.print();
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
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenProfileEdit={() => openProfileEdit('identity')}
        onLogout={() => void signOutAdmin()}
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
                  ? '— Click any text on this CV to edit directly and sync to Firebase.'
                  : '— Klik teks mana saja di halaman ini untuk mengedit langsung & tersimpan ke Firebase.'}
              </span>
            </div>
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
              onClick={() => setIsAuthModalOpen(true)}
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
          onLocaleChange={setLocale}
          theme={theme}
          onThemeChange={setTheme}
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
          authReady={authReady}
          isAdminUser={isAdminUser}
          siteCopy={activeSiteCopy}
          onSaveSiteCopyField={handleSaveSiteCopyField}
        />
        <ProjectsSection
          locale={locale}
          authReady={authReady}
          isAdminUser={isAdminUser}
          siteCopy={activeSiteCopy}
          onSaveSiteCopyField={handleSaveSiteCopyField}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
        <TechStackSection
          locale={locale}
          authReady={authReady}
          isAdminUser={isAdminUser}
          siteCopy={activeSiteCopy}
          onSaveSiteCopyField={handleSaveSiteCopyField}
        />
        <EducationReferencesSection
          locale={locale}
          authReady={authReady}
          isAdminUser={isAdminUser}
          education={profile.education}
          siteCopy={activeSiteCopy}
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

      <AdminAuthModal
        isOpen={isAuthModalOpen}
        locale={locale}
        onClose={() => setIsAuthModalOpen(false)}
        onAdminVerified={() => void refreshAdminState(auth.currentUser)}
      />

      <ProfileEditModal
        isOpen={profileEditModal.open}
        initialTab={profileEditModal.tab}
        locale={locale}
        profile={profile}
        onClose={() => setProfileEditModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
