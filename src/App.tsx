import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { checkIsAdminUser, consumeGoogleRedirectResult, signOutAdmin, syncAdminRecord } from './utils/projectApi';
import {
  normalizeInviteCode,
  resolveInviteToken,
  ResolvedInviteSession,
} from './utils/inviteApi';
import { GateStatus, PrivateGateView } from './components/PrivateGateView';
import type { AuthModalTab } from './components/AdminAuthModal';
import type { ThemeMode } from './components/HeroSection';

const CvWorkspace = lazy(() => import('./components/CvWorkspace'));
const AdminAuthModal = lazy(() =>
  import('./components/AdminAuthModal').then((m) => ({ default: m.AdminAuthModal }))
);

function getInitialInviteFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return normalizeInviteCode(params.get('invite') || params.get('token') || '');
}

function hasAdminQueryParam(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('admin') === '1' || window.location.hash === '#admin';
}

export default function App() {
  const [locale, setLocale] = useState<'en' | 'id'>('en');
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

  const [inviteCode, setInviteCode] = useState<string>(() => getInitialInviteFromUrl());
  const [gateStatus, setGateStatus] = useState<GateStatus>(() =>
    getInitialInviteFromUrl() ? 'checking' : 'locked'
  );
  const [inviteSession, setInviteSession] = useState<ResolvedInviteSession | null>(null);

  const [authModalState, setAuthModalState] = useState<{
    open: boolean;
    tab: AuthModalTab;
    error: string | null;
  }>(() => ({
    open: hasAdminQueryParam(),
    tab: 'google',
    error: null,
  }));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('cv_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Secret keyboard shortcut Ctrl+Shift+A / Cmd+Shift+A for hidden admin login
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAuthModalState({ open: true, tab: 'google', error: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    void consumeGoogleRedirectResult().then(({ user, error }) => {
      if (user) {
        void refreshAdminState(user);
      } else if (error) {
        setAuthModalState({ open: true, tab: 'google', error });
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIsAdminUser(false);
        setAuthReady(true);
        return;
      }
      await refreshAdminState(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [refreshAdminState]);

  const handleSignOut = useCallback(async () => {
    setIsAdminUser(false);
    setFirebaseUser(null);
    await new Promise((resolve) => setTimeout(resolve, 80));
    await signOutAdmin();
  }, []);

  // Verify invite token against Firestore server whenever inviteCode changes and user isn't admin
  const verifyInvite = useCallback(async (rawCode: string) => {
    const clean = normalizeInviteCode(rawCode);
    setInviteCode(clean);
    if (!clean) {
      setInviteSession(null);
      setGateStatus('locked');
      return;
    }
    setGateStatus('checking');
    try {
      const session = await resolveInviteToken(clean);
      setInviteSession(session);
      setGateStatus('locked');
    } catch {
      setInviteSession(null);
      setGateStatus('denied');
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isAdminUser) return;
    if (!inviteCode) {
      setInviteSession(null);
      setGateStatus('locked');
      return;
    }
    void verifyInvite(inviteCode);
  }, [authReady, inviteCode, isAdminUser, verifyInvite]);

  // Reset tab title when returning to locked gate
  useEffect(() => {
    if (!isAdminUser && !inviteSession && typeof document !== 'undefined') {
      document.title = 'Private Portfolio — Invitation Required';
    }
  }, [inviteSession, isAdminUser]);

  const handleSubmitInviteCode = (rawInput: string) => {
    const clean = normalizeInviteCode(rawInput);
    if (!clean) return;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('invite', clean);
      url.searchParams.delete('admin');
      window.history.replaceState({}, '', url.toString());
    }
    void verifyInvite(clean);
  };

  const isUnlocked = Boolean(isAdminUser || inviteSession);

  return (
    <>
      {isUnlocked ? (
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              {locale === 'en' ? 'Loading document...' : 'Memuat dokumen...'}
            </div>
          }
        >
          <CvWorkspace
            locale={locale}
            onLocaleChange={setLocale}
            theme={theme}
            onThemeChange={setTheme}
            authReady={authReady}
            firebaseUser={firebaseUser}
            isAdminUser={isAdminUser}
            inviteSession={inviteSession}
            onLogout={handleSignOut}
            onOpenAuth={(tab = 'google') =>
              setAuthModalState({ open: true, tab, error: null })
            }
          />
        </Suspense>
      ) : (
        <PrivateGateView
          status={!authReady && inviteCode ? 'checking' : gateStatus}
          locale={locale}
          theme={theme}
          initialCode={inviteCode}
          onLocaleChange={setLocale}
          onThemeChange={setTheme}
          onSubmitCode={handleSubmitInviteCode}
          onSecretAdminTrigger={() =>
            setAuthModalState({ open: true, tab: 'google', error: null })
          }
        />
      )}

      {authModalState.open && (
        <Suspense fallback={null}>
          <AdminAuthModal
            isOpen={authModalState.open}
            locale={locale}
            initialTab={authModalState.tab}
            externalError={authModalState.error}
            onClose={() => setAuthModalState({ open: false, tab: 'google', error: null })}
            onAdminVerified={() => void refreshAdminState(auth.currentUser)}
          />
        </Suspense>
      )}
    </>
  );
}
