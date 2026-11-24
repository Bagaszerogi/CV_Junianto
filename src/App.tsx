import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { auth } from './firebase';
import { checkIsAdminUser, signOutAdmin } from './utils/projectApi';
import {
  CvProfileData,
  DEFAULT_PROFILE_DATA,
  subscribeProfile,
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const adminStatus = await checkIsAdminUser(user);
        setIsAdminUser(adminStatus);
      } else {
        setIsAdminUser(false);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const unsubscribe = subscribeProfile(
      (data) => setProfile(data),
      () => {
        // Keep current/default profile on read failure
      }
    );
    return () => unsubscribe();
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:min-h-0 print:bg-white print:text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <Navbar
        locale={locale}
        brandShort={profile.brandShort}
        firebaseUser={firebaseUser}
        isAdminUser={isAdminUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenProfileEdit={() => openProfileEdit('identity')}
        onLogout={() => void signOutAdmin()}
        onPrint={handlePrint}
      />

      <main className="print:mx-auto print:max-w-full">
        <HeroSection
          locale={locale}
          onLocaleChange={setLocale}
          theme={theme}
          onThemeChange={setTheme}
          profile={profile}
          isAdminUser={isAdminUser}
          onOpenProfileEdit={openProfileEdit}
          onPrint={handlePrint}
        />
        <ExperienceSection
          locale={locale}
          authReady={authReady}
          isAdminUser={isAdminUser}
        />
        <ProjectsSection
          locale={locale}
          authReady={authReady}
          isAdminUser={isAdminUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
        <TechStackSection
          locale={locale}
          authReady={authReady}
          isAdminUser={isAdminUser}
        />
        <EducationReferencesSection
          locale={locale}
          authReady={authReady}
          isAdminUser={isAdminUser}
          education={profile.education}
          onEditEducation={() => openProfileEdit('education')}
        />
        <ContactSection
          locale={locale}
          profile={profile}
          onPrint={handlePrint}
        />
      </main>

      <AdminAuthModal
        isOpen={isAuthModalOpen}
        locale={locale}
        onClose={() => setIsAuthModalOpen(false)}
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
