import { useEffect, useRef, useState } from 'react';
import { type User } from 'firebase/auth';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  Database,
  Link2,
  Loader2,
  Pencil,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Locale } from '../data/cvData';
import { formatReadableFirestoreError } from '../firebase';
import {
  CvProfileData,
  DEFAULT_PROFILE_DATA,
  DEFAULT_SITE_CONTENT,
  EducationData,
  saveProfileToFirestore,
  saveSiteContentToFirestore,
  SiteContentData,
  SiteCopyLocale,
  subscribePortraitMedia,
  subscribeProfile,
  subscribeSiteContent,
} from '../utils/cvFirestoreApi';
import {
  DEFAULT_PORTRAIT_SRC,
  isDataImageUrl,
  MEDIA_PORTRAIT_TOKEN,
} from '../utils/safeUrls';
import {
  ensureCvIndex,
  GlobalSyncState,
  ResolvedInviteSession,
  subscribeGlobalSyncStatus,
  syncPublishedCvSnapshot,
} from '../utils/inviteApi';
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
  const [globalSync, setGlobalSync] = useState<GlobalSyncState>({
    status: 'idle',
    lastSyncedAt: null,
    error: null,
  });
  const [masterReadError, setMasterReadError] = useState<string | null>(null);
  const [portraitMediaUrl, setPortraitMediaUrl] = useState<string | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const profileRef = useRef<CvProfileData>(profile);
  const portraitMediaRef = useRef<string | null>(portraitMediaUrl);
  const siteContentRef = useRef<SiteContentData>(siteContent);
  const profileQueueRef = useRef<Promise<void>>(Promise.resolve());
  const siteContentQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    portraitMediaRef.current = portraitMediaUrl;
  }, [portraitMediaUrl]);

  useEffect(() => {
    siteContentRef.current = siteContent;
  }, [siteContent]);

  useEffect(() => {
    return subscribeGlobalSyncStatus(setGlobalSync);
  }, []);

  // Sync invited snapshot when not in admin edit mode
  useEffect(() => {
    if (!isAdminUser && inviteSession) {
      profileRef.current = inviteSession.profile;
      siteContentRef.current = inviteSession.siteContent;
      setProfile(inviteSession.profile);
      setSiteContent(inviteSession.siteContent);
    }
  }, [inviteSession, isAdminUser]);

  // Live master subscriptions ONLY when signed in as verified Admin
  useEffect(() => {
    if (!authReady || !isAdminUser || !firebaseUser) {
      setMasterReadError(null);
      portraitMediaRef.current = null;
      setPortraitMediaUrl(null);
      return;
    }

    void ensureCvIndex().catch(() => undefined);

    const unsubProfile = subscribeProfile(
      (data) => {
        setMasterReadError(null);
        profileRef.current = data;
        setProfile(data);
      },
      (err) => {
        setMasterReadError(formatReadableFirestoreError(err));
      }
    );
    const unsubPortraitMedia = subscribePortraitMedia(
      (dataUrl) => {
        portraitMediaRef.current = dataUrl;
        setPortraitMediaUrl(dataUrl);
      },
      (err) => {
        setMasterReadError(formatReadableFirestoreError(err));
      }
    );
    const unsubSiteContent = subscribeSiteContent(
      (data) => {
        setMasterReadError(null);
        siteContentRef.current = data;
        setSiteContent(data);
      },
      (err) => {
        setMasterReadError(formatReadableFirestoreError(err));
      }
    );
    return () => {
      unsubProfile();
      unsubPortraitMedia();
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
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.5,
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
        lenis.scrollTo(dest as HTMLElement, { offset: -72 });
      }
    };
    document.addEventListener('click', handleAnchorClick);

    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>('[data-animate="section"]');
      sections.forEach((section) => {
        gsap.fromTo(
          section,
          { opacity: 0.94, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            scrollTrigger: {
              trigger: section,
              start: 'top 90%',
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

  const enqueueProfileWrite = (
    buildNext: (latest: CvProfileData) => CvProfileData
  ): Promise<void> => {
    const run = profileQueueRef.current.catch(() => undefined).then(async () => {
      const latest = profileRef.current;
      const latestMedia = portraitMediaRef.current;
      const nextProfile = buildNext(latest);
      const uploadedDataUrl = isDataImageUrl(nextProfile.portraitDataUrl)
        ? nextProfile.portraitDataUrl
        : null;

      if (uploadedDataUrl) {
        portraitMediaRef.current = uploadedDataUrl;
        setPortraitMediaUrl(uploadedDataUrl);
      } else if (
        nextProfile.portraitDataUrl === '' ||
        nextProfile.portraitDataUrl === DEFAULT_PORTRAIT_SRC
      ) {
        portraitMediaRef.current = null;
        setPortraitMediaUrl(null);
      }

      profileRef.current = { ...nextProfile, fromFirestore: latest.fromFirestore };
      setProfile(profileRef.current);
      try {
        await saveProfileToFirestore(nextProfile, Boolean(latest.fromFirestore));
        const persistedPortrait = uploadedDataUrl
          ? MEDIA_PORTRAIT_TOKEN
          : nextProfile.portraitDataUrl;
        profileRef.current = {
          ...nextProfile,
          portraitDataUrl: persistedPortrait,
          fromFirestore: true,
        };
        setProfile(profileRef.current);
      } catch (err) {
        portraitMediaRef.current = latestMedia;
        setPortraitMediaUrl(latestMedia);
        profileRef.current = latest;
        setProfile(latest);
        throw err;
      }
    });
    profileQueueRef.current = run.catch(() => undefined);
    return run;
  };

  const enqueueSiteContentWrite = (
    buildNext: (latest: SiteContentData) => SiteContentData
  ): Promise<void> => {
    const run = siteContentQueueRef.current.catch(() => undefined).then(async () => {
      const latest = siteContentRef.current;
      const nextSiteContent = buildNext(latest);
      siteContentRef.current = { ...nextSiteContent, fromFirestore: latest.fromFirestore };
      setSiteContent(siteContentRef.current);
      try {
        await saveSiteContentToFirestore(nextSiteContent, Boolean(latest.fromFirestore));
        siteContentRef.current = { ...nextSiteContent, fromFirestore: true };
        setSiteContent(siteContentRef.current);
      } catch (err) {
        siteContentRef.current = latest;
        setSiteContent(latest);
        throw err;
      }
    });
    siteContentQueueRef.current = run.catch(() => undefined);
    return run;
  };

  const handleSaveProfilePatch = (patch: Partial<CvProfileData>) => {
    return enqueueProfileWrite((latest) => {
      let nextWhatsappHref = patch.whatsappHref;
      if (patch.phoneDisplay !== undefined && patch.whatsappHref === undefined) {
        const digits = patch.phoneDisplay.replace(/\D/g, '');
        if (digits.length >= 6) {
          const waDigits = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
          nextWhatsappHref = `https://wa.me/${waDigits}`;
        }
      }
      return {
        ...latest,
        ...patch,
        ...(nextWhatsappHref ? { whatsappHref: nextWhatsappHref } : {}),
      };
    });
  };

  const handleSaveEducationField = (patch: Partial<EducationData>) => {
    return enqueueProfileWrite((latest) => ({
      ...latest,
      education: {
        ...latest.education,
        ...patch,
      },
    }));
  };

  const handleSaveSiteCopyField = (field: keyof SiteCopyLocale, value: string) => {
    return enqueueSiteContentWrite((latest) => ({
      ...latest,
      [locale]: {
        ...latest[locale],
        [field]: value,
      },
    }));
  };

  const handleSyncCurrentRoleToProfile = async (params: {
    company: string;
    role: string;
    scaleContext?: string;
  }) => {
    await handleSaveProfilePatch({
      currentCompany: params.company,
      currentRole: params.role,
    });
    if (params.scaleContext && params.scaleContext.trim()) {
      await enqueueSiteContentWrite((latest) => ({
        ...latest,
        [locale]: {
          ...latest[locale],
          heroPropertyScale: params.scaleContext!.trim().slice(0, 140),
        },
      }));
    }
  };

  const activeSiteCopy = siteContent[locale];
  const needsEmailVerifyBanner = Boolean(firebaseUser && !isAdminUser);
  const resolvedPortraitUrl =
    profile.portraitDataUrl === MEDIA_PORTRAIT_TOKEN
      ? (portraitMediaUrl ?? '')
      : profile.portraitDataUrl;

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)] print:min-h-0 print:bg-white print:text-slate-950">
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
        <div className="no-print border-b border-[var(--line)] bg-[var(--bg2)] px-4 py-2.5 text-xs text-[var(--ink)] sm:px-6">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--brass)]" aria-hidden="true" />
              <span className="font-semibold">
                {locale === 'en' ? 'Auto-Save Edit Mode Active' : 'Mode Edit Auto-Save Aktif'}
              </span>
              <span className="text-[var(--mute)]">
                {locale === 'en'
                  ? '— Edit any text or photo and changes save automatically.'
                  : '— Ubah teks atau foto mana saja, langsung tersimpan & terupdate global otomatis.'}
              </span>
              {globalSync.status === 'syncing' && (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--brass)]">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Syncing globally...' : 'Menyinkronkan global...'}</span>
                </span>
              )}
              {globalSync.status === 'synced' && (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Synced Globally' : 'Tersinkron Global'}</span>
                </span>
              )}
              {globalSync.status === 'error' && (
                <button
                  type="button"
                  onClick={() => void syncPublishedCvSnapshot().catch(() => undefined)}
                  className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline dark:text-red-400 cursor-pointer"
                >
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Retry Global Sync' : 'Sinkron Global Ulang'}</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
              >
                <Link2 className="h-3 w-3 text-[var(--brass)]" aria-hidden="true" />
                <span>{locale === 'en' ? 'Invite Links' : 'Link Undangan'}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('diagnostics')}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
              >
                <Database className="h-3 w-3 text-[var(--brass)]" aria-hidden="true" />
                <span>{locale === 'en' ? 'DB & SSO Check' : 'Cek DB & SSO'}</span>
              </button>
              <button
                type="button"
                onClick={() => openProfileEdit('identity')}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--brass)] px-3 py-1 text-[11px] font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] cursor-pointer"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                <span>{locale === 'en' ? 'Profile & Photo Editor' : 'Editor Profil & Foto'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdminUser && masterReadError && (
        <div className="no-print border-b border-red-500/35 bg-red-500/10 px-4 py-2.5 text-xs text-red-700 dark:text-red-300 sm:px-6">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{masterReadError}</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth('diagnostics')}
              className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-[11px] font-semibold hover:bg-red-500/25 cursor-pointer"
            >
              {locale === 'en' ? 'Open DB & SSO Check' : 'Buka Cek DB & SSO'}
            </button>
          </div>
        </div>
      )}

      {needsEmailVerifyBanner && (
        <div className="no-print border-b border-[var(--brass)]/35 bg-[color-mix(in_srgb,var(--brass)_12%,var(--bg2))] px-4 py-2.5 text-xs text-[var(--ink)] sm:px-6">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--brass)]" aria-hidden="true" />
              <span className="break-words">
                {!firebaseUser?.emailVerified
                  ? locale === 'en'
                    ? `Signed in as ${firebaseUser?.email}. Verify your email to unlock Firestore editing.`
                    : `Masuk sebagai ${firebaseUser?.email}. Verifikasi email Anda untuk membuka izin edit & simpan global.`
                  : locale === 'en'
                    ? `Signed in as ${firebaseUser?.email}. Waiting for admin authorization in Firestore /admins.`
                    : `Masuk sebagai ${firebaseUser?.email}. Pastikan email atau UID akun sudah didaftarkan admin utama.`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth(!firebaseUser?.emailVerified ? 'email' : 'diagnostics')}
              className="rounded-full bg-[var(--brass)] px-3.5 py-1 text-[11px] font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] cursor-pointer"
            >
              {!firebaseUser?.emailVerified
                ? locale === 'en'
                  ? 'Verify Email Now'
                  : 'Verifikasi Email Sekarang'
                : locale === 'en'
                  ? 'Check Admin Status'
                  : 'Cek Status Admin'}
            </button>
          </div>
        </div>
      )}

      <main className="overflow-x-clip print:mx-auto print:max-w-full">
        <HeroSection
          locale={locale}
          onLocaleChange={onLocaleChange}
          theme={theme}
          onThemeChange={onThemeChange}
          profile={profile}
          resolvedPortraitUrl={resolvedPortraitUrl}
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
          onSyncCurrentRoleToProfile={handleSyncCurrentRoleToProfile}
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
        resolvedPortraitUrl={resolvedPortraitUrl}
        onSaveProfile={handleSaveProfilePatch}
        onClose={() => setProfileEditModal((prev) => ({ ...prev, open: false }))}
      />

      <InviteManagerModal
        isOpen={inviteModalOpen}
        locale={locale}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* Always-floating Back to Top Button (bottom-right brass FAB) */}
      <button
        type="button"
        onClick={handleBackToTop}
        aria-label={locale === 'en' ? 'Back to top' : 'Kembali ke atas'}
        title={locale === 'en' ? 'Back to top' : 'Kembali ke atas'}
        className="no-print fixed right-5 bottom-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--brass)] bg-[var(--bg2)] text-[var(--ink)] shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--brass)] hover:text-[#1a1405] cursor-pointer"
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
