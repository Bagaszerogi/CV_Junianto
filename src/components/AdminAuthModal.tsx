import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  X,
} from 'lucide-react';
import { auth, FIREBASE_PUBLIC_META } from '../firebase';
import { Locale } from '../data/cvData';
import {
  DatabaseAuditReport,
  runFullDatabaseAudit,
  seedMissingDefaultsToFirestore,
} from '../utils/dbDiagnostics';
import { syncPublishedCvSnapshot } from '../utils/inviteApi';
import {
  addAdminAccessToFirestore,
  checkIsAdminUser,
  isRunningInIframe,
  listFirestoreAdminEmails,
  registerAdminWithEmail,
  removeAdminEmailFromFirestore,
  sendAdminPasswordReset,
  sendAdminVerificationEmail,
  signInAdminWithEmail,
  signInAdminWithGoogle,
  signInAdminWithGoogleRedirect,
  syncAdminRecord,
} from '../utils/projectApi';

export type AuthModalTab = 'google' | 'email' | 'diagnostics';

interface AdminAuthModalProps {
  isOpen: boolean;
  locale: Locale;
  initialTab?: AuthModalTab;
  externalError?: string | null;
  onClose: () => void;
  onAdminVerified?: () => void;
}

const FIREBASE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${FIREBASE_PUBLIC_META.projectId}/authentication/settings`;

export function AdminAuthModal({
  isOpen,
  locale,
  initialTab = 'google',
  externalError = null,
  onClose,
  onAdminVerified,
}: AdminAuthModalProps) {
  const [authMethod, setAuthMethod] = useState<AuthModalTab>(initialTab);
  const [emailMode, setEmailMode] = useState<'signin' | 'register'>('signin');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [unauthorizedHost, setUnauthorizedHost] = useState<string | null>(null);
  const [popupFailed, setPopupFailed] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [auditReport, setAuditReport] = useState<DatabaseAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncingGlobal, setIsSyncingGlobal] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [coreAdminEmails, setCoreAdminEmails] = useState<string[]>([]);
  const [addedAdminEmails, setAddedAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminManageError, setAdminManageError] = useState<string | null>(null);
  const [adminManageSuccess, setAdminManageSuccess] = useState<string | null>(null);
  const [isManagingAdmin, setIsManagingAdmin] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const formatAuthError = useCallback(
    (err: unknown, mode: AuthModalTab): { message: string; badDomain: string | null; isPopupIssue: boolean } => {
      const msg = err instanceof Error ? err.message : String(err);
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

      if (msg.startsWith('AUTH_UNAUTHORIZED_EMAIL:')) {
        const email = msg.slice('AUTH_UNAUTHORIZED_EMAIL:'.length);
        return {
          message:
            locale === 'en'
              ? `Account (${email}) is not registered in the Firestore admin list yet. Ask a core admin to add it under DB & SSO Check, or sign in with an authorized admin account.`
              : `Akun (${email}) belum terdaftar di daftar admin Firestore. Tambahkan email atau UID akun ini melalui menu Cek DB & SSO oleh admin utama.`,
          badDomain: null,
          isPopupIssue: false,
        };
      }
      if (msg.includes('auth/email-already-in-use')) {
        return {
          message:
            locale === 'en'
              ? 'This email already has an account. Switch to "Sign In" above or use Google SSO.'
              : 'Email ini sudah terdaftar. Pindah ke tab "Masuk" di atas atau gunakan Google SSO.',
          badDomain: null,
          isPopupIssue: false,
        };
      }
      if (msg.includes('auth/weak-password')) {
        return {
          message:
            locale === 'en'
              ? 'Password must be at least 6 characters.'
              : 'Kata sandi minimal 6 karakter.',
          badDomain: null,
          isPopupIssue: false,
        };
      }
      if (msg.includes('auth/unauthorized-domain')) {
        return {
          message:
            locale === 'en'
              ? `Domain "${hostname}" is not authorized in Firebase Auth yet.`
              : `Domain "${hostname}" belum didaftarkan di Authorized domains Firebase Auth.`,
          badDomain: hostname || 'cv-junianto.vercel.app',
          isPopupIssue: false,
        };
      }
      if (msg.includes('auth/popup-blocked')) {
        return {
          message:
            locale === 'en'
              ? 'Sign-in popup was blocked by your browser. Allow popups or use Redirect Google SSO below.'
              : 'Popup login diblokir browser. Izinkan popup atau gunakan tombol Redirect Google SSO di bawah.',
          badDomain: null,
          isPopupIssue: true,
        };
      }
      if (msg.includes('auth/popup-closed-by-user') || msg.includes('auth/cancelled-popup-request')) {
        return {
          message:
            locale === 'en'
              ? 'Google sign-in popup was closed before completing.'
              : 'Jendela login Google ditutup sebelum selesai.',
          badDomain: null,
          isPopupIssue: true,
        };
      }
      if (msg.includes('auth/operation-not-allowed')) {
        if (mode === 'google') {
          return {
            message:
              locale === 'en'
                ? 'Google Sign-In is not enabled in Firebase Console. Enable Google under Authentication → Sign-in method.'
                : 'Provider Google Sign-In belum diaktifkan di Firebase Console → Authentication → Sign-in method.',
            badDomain: null,
            isPopupIssue: false,
          };
        }
        return {
          message:
            locale === 'en'
              ? 'Email/Password sign-in is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method, or use Google SSO.'
              : 'Login Email/Password belum diaktifkan di Firebase Console. Aktifkan di Authentication → Sign-in method, atau gunakan Google SSO.',
          badDomain: null,
          isPopupIssue: false,
        };
      }
      if (
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/wrong-password') ||
        msg.includes('auth/user-not-found')
      ) {
        return {
          message:
            locale === 'en'
              ? 'Incorrect email or password, or the Email/Password account has not been created yet. Use "Create Account" below if this email was just added.'
              : 'Email atau kata sandi salah, atau akun belum dibuat. Gunakan mode "Daftar Sandi Baru" di atas jika email baru saja ditambahkan oleh admin.',
          badDomain: null,
          isPopupIssue: false,
        };
      }
      return { message: msg, badDomain: null, isPopupIssue: false };
    },
    [locale]
  );

  const runDiagnostics = useCallback(async () => {
    setIsAuditing(true);
    setSeedMessage(null);
    setAdminManageError(null);
    try {
      const report = await runFullDatabaseAudit();
      setAuditReport(report);
      if (report.isAuthorizedAdmin) {
        const list = await listFirestoreAdminEmails();
        setCoreAdminEmails(list.coreEmails);
        setAddedAdminEmails(list.addedEmails);
      } else {
        setCoreAdminEmails([]);
        setAddedAdminEmails([]);
      }
    } finally {
      setIsAuditing(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setAuthMethod(initialTab);
    setUnauthorizedHost(null);
    setPopupFailed(false);
    setSeedMessage(null);
    setAdminManageSuccess(null);

    if (externalError) {
      const parsed = formatAuthError(new Error(externalError), 'google');
      setAuthError(parsed.message);
      setUnauthorizedHost(parsed.badDomain);
      setPopupFailed(parsed.isPopupIssue);
    } else {
      setAuthError(null);
    }

    if (initialTab === 'diagnostics') {
      void runDiagnostics();
    }
  }, [externalError, formatAuthError, initialTab, isOpen, runDiagnostics]);

  useEffect(() => {
    if (isOpen && authMethod === 'diagnostics' && !auditReport && !isAuditing) {
      void runDiagnostics();
    }
  }, [auditReport, authMethod, isAuditing, isOpen, runDiagnostics]);

  if (!isOpen) return null;

  const handleCopyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleCopyUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setUnauthorizedHost(null);
    setPopupFailed(false);
    setNeedsVerification(false);
    setIsSubmitting(true);
    try {
      await signInAdminWithGoogle();
      onAdminVerified?.();
      onClose();
    } catch (err) {
      const parsed = formatAuthError(err, 'google');
      setAuthError(parsed.message);
      setUnauthorizedHost(parsed.badDomain);
      setPopupFailed(parsed.isPopupIssue);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setUnauthorizedHost(null);
    setIsSubmitting(true);
    try {
      await signInAdminWithGoogleRedirect();
    } catch (err) {
      const parsed = formatAuthError(err, 'google');
      setAuthError(parsed.message);
      setUnauthorizedHost(parsed.badDomain);
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setUnauthorizedHost(null);
    setPopupFailed(false);
    setNeedsVerification(false);
    setIsSubmitting(true);
    try {
      const result =
        emailMode === 'register'
          ? await registerAdminWithEmail(loginEmail, loginPassword)
          : await signInAdminWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
      if (result.needsVerification) {
        setNeedsVerification(true);
        setAuthInfo(
          emailMode === 'register'
            ? locale === 'en'
              ? 'Account created and verification email sent! Click the link in your inbox, then press Refresh Verification below.'
              : 'Akun dibuat & email verifikasi telah dikirim! Buka tautan di inbox Anda, lalu klik Cek Status Verifikasi.'
            : locale === 'en'
              ? 'Your admin email is signed in but not verified yet. Verify your email to unlock Firestore editing, or sign in via Google SSO.'
              : 'Email admin Anda berhasil masuk tetapi belum terverifikasi. Verifikasi email untuk membuka fitur edit database, atau masuk lewat Google SSO.'
        );
      } else {
        onAdminVerified?.();
        onClose();
      }
    } catch (err) {
      const parsed = formatAuthError(err, 'email');
      setAuthError(parsed.message);
      setUnauthorizedHost(parsed.badDomain);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendVerification = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setIsSubmitting(true);
    try {
      await sendAdminVerificationEmail();
      setAuthInfo(
        locale === 'en'
          ? 'Verification email sent! Open the link in your inbox, then click Refresh Verification.'
          : 'Email verifikasi terkirim! Klik tautan di inbox Anda, lalu tekan Cek Status Verifikasi.'
      );
    } catch (err) {
      setAuthError(formatAuthError(err, 'email').message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReloadVerification = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Session expired. Please sign in again.');
      await user.reload();
      const refreshed = auth.currentUser;
      const isAdmin = await checkIsAdminUser(refreshed);
      if (refreshed && isAdmin) {
        await refreshed.getIdToken(true);
        await syncAdminRecord(refreshed);
        setNeedsVerification(false);
        onAdminVerified?.();
        onClose();
      } else if (refreshed?.emailVerified) {
        setAuthError(
          locale === 'en'
            ? 'Email is verified, but this email is not listed in Firestore /admins yet. Copy the UID above and ask the main admin to authorize it.'
            : 'Email sudah terverifikasi, namun belum terdaftar di Firestore /admins. Salin UID di atas agar ditambahkan oleh admin utama.'
        );
      } else {
        setAuthError(
          locale === 'en'
            ? 'Email still shows as unverified. Please open the link in your inbox first.'
            : 'Email masih terbaca belum terverifikasi. Buka tautan verifikasi di inbox Anda terlebih dahulu.'
        );
      }
    } catch (err) {
      setAuthError(formatAuthError(err, 'email').message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setAuthError(null);
    setAuthInfo(null);
    if (!loginEmail.trim()) {
      setAuthError(
        locale === 'en'
          ? 'Enter your email address above first to receive a password reset link.'
          : 'Masukkan alamat email Anda terlebih dahulu untuk mengirim tautan reset sandi.'
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await sendAdminPasswordReset(loginEmail);
      setAuthInfo(
        locale === 'en'
          ? 'Password reset email sent. Check your inbox.'
          : 'Email reset kata sandi telah dikirim. Periksa kotak masuk Anda.'
      );
    } catch (err) {
      setAuthError(formatAuthError(err, 'email').message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    setSeedMessage(null);
    try {
      const { seededCount } = await seedMissingDefaultsToFirestore();
      setSeedMessage(
        seededCount > 0
          ? locale === 'en'
            ? `Synced ${seededCount} initial CV documents to Firestore.`
            : `Berhasil menyinkronkan ${seededCount} dokumen awal CV ke Cloud Firestore.`
          : locale === 'en'
            ? 'All CV collections are already synced in Firestore.'
            : 'Semua koleksi CV sudah tersinkronisasi di Cloud Firestore.'
      );
      await runDiagnostics();
      onAdminVerified?.();
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setSeedMessage(msg);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSyncGlobalNow = async () => {
    setIsSyncingGlobal(true);
    setSeedMessage(null);
    try {
      await syncPublishedCvSnapshot();
      setSeedMessage(
        locale === 'en'
          ? 'Global share snapshot updated. All active invite links now serve your latest CV.'
          : 'Snapshot global diperbarui. Semua link undangan aktif langsung menampilkan perubahan terbaru.'
      );
      await runDiagnostics();
      onAdminVerified?.();
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setSeedMessage(msg);
    } finally {
      setIsSyncingGlobal(false);
    }
  };

  const handleAddAdminEmail = async (e: FormEvent) => {
    e.preventDefault();
    setAdminManageError(null);
    setAdminManageSuccess(null);
    setIsManagingAdmin(true);
    try {
      const added = await addAdminAccessToFirestore(newAdminEmail);
      setNewAdminEmail('');
      const list = await listFirestoreAdminEmails();
      setCoreAdminEmails(list.coreEmails);
      setAddedAdminEmails(list.addedEmails);
      setAdminManageSuccess(
        added.kind === 'uid'
          ? locale === 'en'
            ? `UID "${added.value}" authorized in Firestore /admins.`
            : `UID "${added.value}" berhasil diotorisasi di Firestore /admins.`
          : locale === 'en'
            ? `Email "${added.value}" authorized in Firestore /admins.`
            : `Email "${added.value}" berhasil diotorisasi di Firestore /admins.`
      );
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setAdminManageError(msg);
    } finally {
      setIsManagingAdmin(false);
    }
  };

  const handleRemoveAdminEmail = async (email: string) => {
    setAdminManageError(null);
    setAdminManageSuccess(null);
    setIsManagingAdmin(true);
    try {
      await removeAdminEmailFromFirestore(email);
      const list = await listFirestoreAdminEmails();
      setCoreAdminEmails(list.coreEmails);
      setAddedAdminEmails(list.addedEmails);
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setAdminManageError(msg);
    } finally {
      setIsManagingAdmin(false);
    }
  };

  const inIframe = isRunningInIframe();
  const hasUnseededDefaults = Boolean(
    auditReport?.collections.some((c) => c.status === 'empty-default')
  );
  const canSeedNow = Boolean(auditReport?.isAuthorizedAdmin);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-auth-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#0a1024]/70 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-[var(--line)] bg-[var(--bg2)] p-6 text-[var(--ink)] shadow-2xl md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brass)_16%,transparent)] text-[var(--brass)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="global-auth-title"
                className="font-display text-lg font-bold text-[var(--ink)]"
              >
                {locale === 'en' ? 'Admin Sign In & Database' : 'Login Admin & Koneksi Database'}
              </h3>
              <p className="text-xs text-[var(--mute)]">
                {locale === 'en'
                  ? 'Sign in with Google SSO or Email to edit CV content & verify Firestore.'
                  : 'Masuk lewat Google SSO atau Email untuk edit CV & cek koneksi Firestore.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close login dialog"
            className="rounded-full p-1.5 text-[var(--mute)] hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--card)] p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('google');
              setAuthError(null);
              setAuthInfo(null);
            }}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              authMethod === 'google'
                ? 'bg-[var(--brass)] text-[#1a1405]'
                : 'text-[var(--mute)] hover:text-[var(--ink)]'
            }`}
          >
            Google SSO
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('email');
              setAuthError(null);
              setAuthInfo(null);
              setUnauthorizedHost(null);
            }}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              authMethod === 'email'
                ? 'bg-[var(--brass)] text-[#1a1405]'
                : 'text-[var(--mute)] hover:text-[var(--ink)]'
            }`}
          >
            Email & Password
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('diagnostics');
              setAuthError(null);
              setAuthInfo(null);
              void runDiagnostics();
            }}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              authMethod === 'diagnostics'
                ? 'bg-[var(--brass)] text-[#1a1405]'
                : 'text-[var(--mute)] hover:text-[var(--ink)]'
            }`}
          >
            {locale === 'en' ? 'DB & SSO Check' : 'Cek DB & SSO'}
          </button>
        </div>

        {authError && authMethod !== 'diagnostics' && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-red-700 dark:text-red-200"
          >
            {authError}
          </div>
        )}

        {unauthorizedHost && authMethod === 'google' && (
          <div className="mt-3 space-y-3 rounded-2xl border border-[var(--brass)]/40 bg-[color-mix(in_srgb,var(--brass)_12%,var(--bg))] p-4 text-xs text-[var(--ink)]">
            <p className="font-semibold text-[var(--brass)]">
              {locale === 'en'
                ? 'How to authorize this domain for Google SSO:'
                : 'Cara mengaktifkan Google SSO di domain ini (1x pengaturan):'}
            </p>
            <ol className="list-decimal space-y-1 pl-4 leading-relaxed text-[var(--mute)]">
              <li>
                {locale === 'en' ? 'Copy this domain:' : 'Salin domain aktif ini:'}{' '}
                <span className="inline-flex items-center gap-1.5 rounded bg-[var(--bg2)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--ink)]">
                  {unauthorizedHost}
                  <button
                    type="button"
                    onClick={() => void handleCopyDomain(unauthorizedHost)}
                    aria-label="Copy domain"
                    className="text-[var(--brass)] hover:opacity-80 cursor-pointer"
                  >
                    {copiedHost ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </span>
              </li>
              <li>
                {locale === 'en'
                  ? 'Open Firebase Console → Authentication → Settings → Authorized domains → Add domain.'
                  : 'Buka Firebase Console → Authentication → Settings → Authorized domains → klik Add domain lalu tempel domain di atas.'}
              </li>
              <li>
                {locale === 'en'
                  ? 'Make sure Google is enabled under Sign-in method, then retry Google SSO.'
                  : 'Pastikan provider Google aktif di Sign-in method, lalu klik tombol Masuk dengan Google SSO lagi.'}
              </li>
            </ol>
            <a
              href={FIREBASE_AUTH_SETTINGS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brass)] px-3.5 py-2 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)]"
            >
              <span>
                {locale === 'en'
                  ? 'Open Firebase Authorized Domains'
                  : 'Buka Firebase Authorized Domains'}
              </span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        )}

        {authInfo && authMethod !== 'diagnostics' && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-[var(--brass)]/35 bg-[color-mix(in_srgb,var(--brass)_12%,var(--bg))] px-3.5 py-2.5 text-xs font-medium leading-relaxed text-[var(--ink)]"
          >
            {authInfo}
          </div>
        )}

        {authMethod === 'diagnostics' ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ink)]">
                <Database className="h-4 w-4 text-[var(--brass)]" aria-hidden="true" />
                <span>
                  {locale === 'en'
                    ? 'Live Cloud Firestore & SSO Status'
                    : 'Status Langsung Cloud Firestore & SSO'}
                </span>
              </div>
              <button
                type="button"
                disabled={isAuditing}
                onClick={() => void runDiagnostics()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--brass)] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isAuditing ? 'animate-spin' : ''}`} />
                <span>{locale === 'en' ? 'Re-test' : 'Uji Ulang'}</span>
              </button>
            </div>

            {isAuditing && !auditReport ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--line)] py-8 text-xs text-[var(--mute)]">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--brass)]" />
                <span>
                  {locale === 'en'
                    ? 'Testing Firestore server connection...'
                    : 'Menguji koneksi server Cloud Firestore...'}
                </span>
              </div>
            ) : auditReport ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-[11px] leading-relaxed">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--ink)]">
                      {!auditReport.overallConnected
                        ? locale === 'en'
                          ? 'Connection Issue Detected'
                          : 'Ada Gangguan Koneksi'
                        : auditReport.authRequired
                          ? locale === 'en'
                            ? 'Firestore Online · Protected Mode'
                            : 'Firestore Online · Database Terlindungi'
                          : locale === 'en'
                            ? 'Firestore Connected & Admin Authorized'
                            : 'Terhubung & Admin Terotorisasi'}
                    </span>
                    <span className="font-mono text-[var(--mute)]">
                      {auditReport.totalLatencyMs} ms · {auditReport.checkedAt}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[var(--mute)]">
                    <div>
                      <span className="font-medium text-[var(--ink)]">Project:</span>{' '}
                      <span className="font-mono">{auditReport.projectId}</span>
                    </div>
                    <div className="truncate">
                      <span className="font-medium text-[var(--ink)]">Database ID:</span>{' '}
                      <span className="font-mono">{auditReport.databaseId}</span>
                    </div>
                    <div>
                      <span className="font-medium text-[var(--ink)]">Host aktif:</span>{' '}
                      <span className="font-mono">{auditReport.hostname}</span>
                    </div>
                    <div>
                      <span className="font-medium text-[var(--ink)]">Auth User:</span>{' '}
                      {auditReport.authState.signedIn ? (
                        <span className="font-mono">
                          {auditReport.authState.email} (
                          {auditReport.authState.emailVerified ? 'verified' : 'unverified'}
                          {auditReport.authState.adminDocSynced ? ' · /admins synced' : ''})
                        </span>
                      ) : (
                        <span>
                          {locale === 'en'
                            ? 'Not signed in (sign in to unlock read/write)'
                            : 'Belum login (login dulu untuk akses penuh)'}
                        </span>
                      )}
                    </div>
                    {auditReport.authState.uid && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[var(--ink)]">UID:</span>{' '}
                        <span className="truncate font-mono text-[10px]">
                          {auditReport.authState.uid}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyUid(auditReport.authState.uid!)}
                          aria-label="Copy UID"
                          className="text-[var(--brass)] hover:opacity-80 cursor-pointer"
                        >
                          {copiedUid ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {auditReport.authRequired && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2.5">
                      <button
                        type="button"
                        onClick={() => setAuthMethod('google')}
                        className="rounded-full bg-[var(--brass)] px-3.5 py-1.5 text-[11px] font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] cursor-pointer"
                      >
                        {locale === 'en' ? 'Sign in with Google SSO' : 'Login via Google SSO'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMethod('email')}
                        className="rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
                      >
                        Email & Password
                      </button>
                    </div>
                  )}
                </div>

                <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
                  {auditReport.collections.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--ink)]">
                          {item.label}
                        </p>
                        <p className="truncate font-mono text-[10px] text-[var(--mute)]">
                          {item.path}
                        </p>
                        {item.error && (
                          <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">
                            {item.error}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            item.status === 'synced'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : item.status === 'empty-default'
                                ? 'bg-[color-mix(in_srgb,var(--brass)_18%,transparent)] text-[var(--brass)]'
                                : item.status === 'auth-required'
                                  ? 'bg-[var(--card)] text-[var(--mute)]'
                                  : 'bg-red-500/15 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {item.status === 'auth-required' && (
                            <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                          )}
                          <span>
                            {item.status === 'synced'
                              ? `${item.docCount} docs`
                              : item.status === 'empty-default'
                                ? 'Default (0 docs)'
                                : item.status === 'auth-required'
                                  ? locale === 'en'
                                    ? 'Protected'
                                    : 'Terkunci (Login)'
                                  : 'Error'}
                          </span>
                        </span>
                        <p className="mt-0.5 font-mono text-[10px] text-[var(--mute)]">
                          {item.latencyMs} ms
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {canSeedNow && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSyncingGlobal}
                      onClick={() => void handleSyncGlobalNow()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--brass)]/40 bg-[color-mix(in_srgb,var(--brass)_14%,var(--bg))] px-3.5 py-2 text-xs font-semibold text-[var(--brass)] hover:bg-[var(--brass)] hover:text-[#1a1405] disabled:opacity-50 cursor-pointer"
                    >
                      {isSyncingGlobal ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {locale === 'en' ? 'Sync Global Snapshot' : 'Sinkron Global Sekarang'}
                      </span>
                    </button>

                    {hasUnseededDefaults && (
                      <button
                        type="button"
                        disabled={isSeeding}
                        onClick={() => void handleSeedDefaults()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--brass)] px-3.5 py-2 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
                      >
                        {isSeeding ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {locale === 'en' ? 'Seed Initial Defaults' : 'Isi Data Awal ke Firestore'}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {seedMessage && (
                  <p className="rounded-xl border border-[var(--brass)]/35 bg-[color-mix(in_srgb,var(--brass)_12%,var(--bg))] px-3 py-2 text-xs font-medium text-[var(--ink)]">
                    {seedMessage}
                  </p>
                )}

                {canSeedNow && (
                  <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
                    <div>
                      <p className="text-xs font-semibold text-[var(--ink)]">
                        {locale === 'en'
                          ? 'Authorized Admin Accounts (Email or Firebase UID)'
                          : 'Daftar Akses Admin Firestore (Email atau UID Firebase)'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--mute)]">
                        {locale === 'en'
                          ? 'Any authorized account here can sign in, edit all CV sections, and publish global updates.'
                          : 'Akun (email atau Firebase UID) yang ditambahkan di sini otomatis mendapat izin edit & simpan perubahan global.'}
                      </p>
                    </div>

                    <form onSubmit={(e) => void handleAddAdminEmail(e)} className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder={
                          locale === 'en' ? 'email@gmail.com or Firebase UID' : 'email@gmail.com atau UID Firebase'
                        }
                        className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3.5 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--mute)] focus:border-[var(--brass)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isManagingAdmin}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--brass)] px-3.5 py-1.5 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{locale === 'en' ? 'Authorize' : 'Tambah'}</span>
                      </button>
                    </form>

                    {adminManageSuccess && (
                      <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        {adminManageSuccess}
                      </p>
                    )}

                    {adminManageError && (
                      <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                        {adminManageError}
                      </p>
                    )}

                    <div className="space-y-1.5">
                      {coreAdminEmails.map((em) => (
                        <div
                          key={em}
                          className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg2)] px-3 py-1.5 text-[11px]"
                        >
                          <span className="truncate font-mono text-[var(--ink)]">
                            {em}
                          </span>
                          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--brass)_18%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brass)]">
                            Core
                          </span>
                        </div>
                      ))}
                      {addedAdminEmails.map((em) => (
                        <div
                          key={em}
                          className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg2)] px-3 py-1.5 text-[11px]"
                        >
                          <span className="truncate font-mono text-[var(--ink)]">
                            {em}
                          </span>
                          <button
                            type="button"
                            disabled={isManagingAdmin}
                            onClick={() => void handleRemoveAdminEmail(em)}
                            aria-label={`Hapus ${em}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-500/15 dark:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                            <span>{locale === 'en' ? 'Remove' : 'Hapus'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : needsVerification ? (
          <div className="mt-5 space-y-3 rounded-2xl border border-[var(--brass)]/40 bg-[color-mix(in_srgb,var(--brass)_12%,var(--bg))] p-4">
            <p className="text-xs font-semibold text-[var(--brass)]">
              {locale === 'en' ? 'Email Verification Required' : 'Verifikasi Email Diperlukan'}
            </p>
            <p className="text-[11px] leading-relaxed text-[var(--ink)]">
              {locale === 'en'
                ? 'For security, Email/Password sign-in requires a verified email, OR you can sign in instantly with Google SSO using the same Gmail account.'
                : 'Untuk keamanan Firestore, akun Email/Password memerlukan email terverifikasi — atau klik "Masuk Instan Google SSO" di bawah dengan akun Gmail yang sama.'}
            </p>
            {auth.currentUser?.uid && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-[10px] text-[var(--ink)]">
                <span className="truncate font-mono">UID: {auth.currentUser.uid}</span>
                <button
                  type="button"
                  onClick={() => void handleCopyUid(auth.currentUser!.uid)}
                  className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--brass)] cursor-pointer"
                >
                  {copiedUid ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedUid ? 'Disalin' : 'Salin UID'}</span>
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleGoogleSignIn()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brass)] px-3.5 py-2 text-xs font-semibold text-[#1a1405] hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
              >
                <span>{locale === 'en' ? 'Instant Google SSO' : 'Masuk Instan Google SSO'}</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSendVerification()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brass)] disabled:opacity-50 cursor-pointer"
              >
                <MailCheck className="h-3.5 w-3.5 text-[var(--brass)]" />
                <span>{locale === 'en' ? 'Send Verification Email' : 'Kirim Email Verifikasi'}</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleReloadVerification()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brass)] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[var(--brass)]" />
                <span>{locale === 'en' ? 'Refresh Verification' : 'Cek Status Verifikasi'}</span>
              </button>
            </div>
          </div>
        ) : authMethod === 'google' ? (
          <div className="mt-5 space-y-3.5">
            <p className="text-xs leading-relaxed text-[var(--mute)]">
              {locale === 'en'
                ? 'Choose your registered admin Google account when prompted to unlock full CV editing.'
                : 'Pilih akun Google admin terdaftar (bagaszerogi@gmail.com / zerogi26@gmail.com / email yang ditambahkan) untuk mengaktifkan mode edit penuh.'}
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleGoogleSignIn()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-[#1a1405] transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
            >
              <span>
                {isSubmitting
                  ? locale === 'en'
                    ? 'Signing in...'
                    : 'Sedang masuk...'
                  : locale === 'en'
                    ? 'Continue with Google'
                    : 'Masuk dengan Google SSO'}
              </span>
            </button>

            {!inIframe && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleGoogleRedirect()}
                  className={`text-xs font-medium hover:underline cursor-pointer ${
                    popupFailed ? 'text-[var(--brass)]' : 'text-[var(--mute)]'
                  }`}
                >
                  {locale === 'en'
                    ? 'Popup blocked on mobile? Sign in with Google Redirect'
                    : 'Popup diblokir di HP/browser? Masuk via Redirect Google'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
            {/* Sub-toggle: Sign In vs Register password for newly added admin emails */}
            <div className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg)] p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmailMode('signin');
                  setAuthError(null);
                  setAuthInfo(null);
                }}
                className={`flex-1 rounded-full py-1.5 font-semibold transition-colors cursor-pointer ${
                  emailMode === 'signin'
                    ? 'bg-[var(--card)] text-[var(--ink)]'
                    : 'text-[var(--mute)] hover:text-[var(--ink)]'
                }`}
              >
                {locale === 'en' ? 'Sign In' : 'Masuk'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailMode('register');
                  setAuthError(null);
                  setAuthInfo(null);
                }}
                className={`flex-1 rounded-full py-1.5 font-semibold transition-colors cursor-pointer ${
                  emailMode === 'register'
                    ? 'bg-[var(--card)] text-[var(--ink)]'
                    : 'text-[var(--mute)] hover:text-[var(--ink)]'
                }`}
              >
                {locale === 'en' ? 'Create Account' : 'Daftar Sandi Baru'}
              </button>
            </div>

            {emailMode === 'register' && (
              <p className="text-[11px] leading-relaxed text-[var(--mute)]">
                {locale === 'en'
                  ? 'For team emails added to Firestore /admins that do not have a password yet. We will send a verification link after sign-up.'
                  : 'Untuk email yang baru didaftarkan di Firestore /admins namun belum punya kata sandi. Tautan verifikasi akan dikirim ke email Anda.'}
              </p>
            )}

            <div>
              <label
                htmlFor="global-admin-email"
                className="block text-xs font-semibold text-[var(--mute)]"
              >
                Email
              </label>
              <input
                id="global-admin-email"
                type="email"
                required
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="zerogi26@gmail.com"
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--mute)]/70 focus:border-[var(--brass)] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="global-admin-password"
                  className="block text-xs font-semibold text-[var(--mute)]"
                >
                  Password
                </label>
                {emailMode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    className="text-[11px] font-medium text-[var(--brass)] hover:underline cursor-pointer"
                  >
                    {locale === 'en' ? 'Forgot / Set Password?' : 'Lupa / Atur Sandi?'}
                  </button>
                )}
              </div>
              <div className="relative mt-1.5">
                <input
                  id="global-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={emailMode === 'register' ? 'new-password' : 'current-password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 pr-10 text-sm text-[var(--ink)] placeholder:text-[var(--mute)]/70 focus:border-[var(--brass)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
              >
                {locale === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[#1a1405] transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? locale === 'en'
                    ? 'Submitting...'
                    : 'Memproses...'
                  : emailMode === 'register'
                    ? locale === 'en'
                      ? 'Create Account'
                      : 'Daftar & Kirim Verifikasi'
                    : locale === 'en'
                      ? 'Sign In'
                      : 'Masuk'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
