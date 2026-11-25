import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
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
import {
  addAdminEmailToFirestore,
  checkIsAdminUser,
  isRunningInIframe,
  listFirestoreAdminEmails,
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
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [coreAdminEmails, setCoreAdminEmails] = useState<string[]>([]);
  const [addedAdminEmails, setAddedAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminManageError, setAdminManageError] = useState<string | null>(null);
  const [isManagingAdmin, setIsManagingAdmin] = useState(false);

  const formatAuthError = useCallback(
    (err: unknown, mode: AuthModalTab): { message: string; badDomain: string | null; isPopupIssue: boolean } => {
      const msg = err instanceof Error ? err.message : String(err);
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

      if (msg.startsWith('AUTH_UNAUTHORIZED_EMAIL:')) {
        const email = msg.slice('AUTH_UNAUTHORIZED_EMAIL:'.length);
        return {
          message:
            locale === 'en'
              ? `Account (${email}) is not authorized as a CV admin. Please sign in with bagaszerogi@gmail.com, zerogi26@gmail.com, or it@hotelciputra.com.`
              : `Akun (${email}) tidak terdaftar sebagai admin CV. Silakan masuk dengan bagaszerogi@gmail.com, zerogi26@gmail.com, atau it@hotelciputra.com.`,
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
              ? 'Incorrect email or password, or the Email/Password account has not been created in Firebase Console → Authentication → Users yet.'
              : 'Email atau kata sandi salah, atau akun Email/Password belum dibuat di Firebase Console → Authentication → Users.',
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
      if (
        report.authState.signedIn &&
        (report.authState.adminDocSynced ||
          (report.authState.emailVerified && report.authState.inAllowlist))
      ) {
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

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setUnauthorizedHost(null);
    setPopupFailed(false);
    setNeedsVerification(false);
    setIsSubmitting(true);
    try {
      const result = await signInAdminWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
      if (result.needsVerification) {
        setNeedsVerification(true);
        setAuthInfo(
          locale === 'en'
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

  const handleAddAdminEmail = async (e: FormEvent) => {
    e.preventDefault();
    setAdminManageError(null);
    setIsManagingAdmin(true);
    try {
      await addAdminEmailToFirestore(newAdminEmail);
      setNewAdminEmail('');
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

  const handleRemoveAdminEmail = async (email: string) => {
    setAdminManageError(null);
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
  const canSeedNow = Boolean(
    auditReport?.authState.signedIn &&
      (auditReport.authState.adminDocSynced ||
        (auditReport.authState.emailVerified && auditReport.authState.inAllowlist))
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-auth-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="global-auth-title"
                className="font-display text-lg font-bold text-slate-950 dark:text-white"
              >
                {locale === 'en' ? 'Admin Sign In & Database' : 'Login Admin & Koneksi Database'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
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
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('google');
              setAuthError(null);
              setAuthInfo(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              authMethod === 'google'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
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
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              authMethod === 'email'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
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
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              authMethod === 'diagnostics'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {locale === 'en' ? 'DB & SSO Check' : 'Cek DB & SSO'}
          </button>
        </div>

        {authError && authMethod !== 'diagnostics' && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
          >
            {authError}
          </div>
        )}

        {unauthorizedHost && authMethod === 'google' && (
          <div className="mt-3 space-y-3 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">
              {locale === 'en'
                ? 'How to authorize this domain for Google SSO:'
                : 'Cara mengaktifkan Google SSO di domain ini (1x pengaturan):'}
            </p>
            <ol className="list-decimal space-y-1 pl-4 leading-relaxed">
              <li>
                {locale === 'en' ? 'Copy this domain:' : 'Salin domain aktif ini:'}{' '}
                <span className="inline-flex items-center gap-1.5 rounded bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  {unauthorizedHost}
                  <button
                    type="button"
                    onClick={() => void handleCopyDomain(unauthorizedHost)}
                    aria-label="Copy domain"
                    className="text-blue-700 hover:text-blue-900 dark:text-blue-400 cursor-pointer"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
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
            className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-200"
          >
            {authInfo}
          </div>
        )}

        {authMethod === 'diagnostics' ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isAuditing ? 'animate-spin' : ''}`} />
                <span>{locale === 'en' ? 'Re-test' : 'Uji Ulang'}</span>
              </button>
            </div>

            {isAuditing && !auditReport ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-8 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {locale === 'en'
                    ? 'Testing Firestore server connection...'
                    : 'Menguji koneksi server Cloud Firestore...'}
                </span>
              </div>
            ) : auditReport ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[11px] leading-relaxed dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {auditReport.overallConnected
                        ? locale === 'en'
                          ? 'Firestore Server Connected'
                          : 'Terhubung ke Server Firestore'
                        : locale === 'en'
                          ? 'Connection Issue Detected'
                          : 'Ada Gangguan Koneksi'}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {auditReport.totalLatencyMs} ms · {auditReport.checkedAt}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="font-medium">Project:</span>{' '}
                      <span className="font-mono">{auditReport.projectId}</span>
                    </div>
                    <div className="truncate">
                      <span className="font-medium">Database ID:</span>{' '}
                      <span className="font-mono">{auditReport.databaseId}</span>
                    </div>
                    <div>
                      <span className="font-medium">Host aktif:</span>{' '}
                      <span className="font-mono">{auditReport.hostname}</span>
                    </div>
                    <div>
                      <span className="font-medium">Auth User:</span>{' '}
                      {auditReport.authState.signedIn ? (
                        <span className="font-mono">
                          {auditReport.authState.email} (
                          {auditReport.authState.emailVerified ? 'verified' : 'unverified'}
                          {auditReport.authState.adminDocSynced ? ' · /admins synced' : ''})
                        </span>
                      ) : (
                        <span>{locale === 'en' ? 'Not signed in' : 'Belum login'}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {auditReport.collections.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {item.label}
                        </p>
                        <p className="truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
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
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            item.status === 'synced'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : item.status === 'empty-default'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {item.status === 'synced'
                            ? `${item.docCount} docs`
                            : item.status === 'empty-default'
                              ? 'Default (0 docs)'
                              : 'Error'}
                        </span>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {item.latencyMs} ms
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {canSeedNow && hasUnseededDefaults && (
                  <button
                    type="button"
                    disabled={isSeeding}
                    onClick={() => void handleSeedDefaults()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                  >
                    {isSeeding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    <span>
                      {locale === 'en'
                        ? 'Sync Initial Default CV Data to Firestore'
                        : 'Sinkronkan Semua Data Awal CV ke Firestore'}
                    </span>
                  </button>
                )}

                {seedMessage && (
                  <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-200">
                    {seedMessage}
                  </p>
                )}

                {canSeedNow && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {locale === 'en'
                          ? 'Firestore Admin Emails (Full Edit Access)'
                          : 'Daftar Email Admin di Firestore (Akses Edit Penuh)'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {locale === 'en'
                          ? 'Any email added here can sign in and edit all CV sections in Firestore.'
                          : 'Email apa pun yang ditambahkan ke Firestore di sini bisa login dan mengedit semua bagian CV.'}
                      </p>
                    </div>

                    <form onSubmit={(e) => void handleAddAdminEmail(e)} className="flex gap-2">
                      <input
                        type="email"
                        required
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="email@gmail.com"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="submit"
                        disabled={isManagingAdmin}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{locale === 'en' ? 'Add' : 'Tambah'}</span>
                      </button>
                    </form>

                    {adminManageError && (
                      <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                        {adminManageError}
                      </p>
                    )}

                    <div className="space-y-1.5">
                      {coreAdminEmails.map((em) => (
                        <div
                          key={em}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] dark:bg-slate-900"
                        >
                          <span className="truncate font-mono text-slate-700 dark:text-slate-200">
                            {em}
                          </span>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Core
                          </span>
                        </div>
                      ))}
                      {addedAdminEmails.map((em) => (
                        <div
                          key={em}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] dark:bg-slate-900"
                        >
                          <span className="truncate font-mono text-slate-700 dark:text-slate-200">
                            {em}
                          </span>
                          <button
                            type="button"
                            disabled={isManagingAdmin}
                            onClick={() => void handleRemoveAdminEmail(em)}
                            aria-label={`Hapus ${em}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60 cursor-pointer"
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
          <div className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              {locale === 'en' ? 'Email Verification Required' : 'Verifikasi Email Diperlukan'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSendVerification()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                <MailCheck className="h-3.5 w-3.5" />
                <span>{locale === 'en' ? 'Send Verification Email' : 'Kirim Email Verifikasi'}</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleReloadVerification()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{locale === 'en' ? 'Refresh Verification' : 'Cek Status Verifikasi'}</span>
              </button>
            </div>
          </div>
        ) : authMethod === 'google' ? (
          <div className="mt-5 space-y-3.5">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {locale === 'en'
                ? 'Choose your registered admin Google account when prompted to unlock full CV editing.'
                : 'Pilih akun Google admin terdaftar (bagaszerogi@gmail.com / zerogi26@gmail.com) untuk mengaktifkan mode edit penuh.'}
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleGoogleSignIn()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
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
                    popupFailed
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-slate-500 dark:text-slate-400'
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
          <form onSubmit={handleEmailSignIn} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="global-admin-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="global-admin-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => void handlePasswordReset()}
                  className="text-[11px] font-medium text-blue-700 hover:underline dark:text-blue-400 cursor-pointer"
                >
                  {locale === 'en' ? 'Forgot / Set Password?' : 'Lupa / Atur Sandi?'}
                </button>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="global-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                {locale === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
              >
                {isSubmitting
                  ? locale === 'en'
                    ? 'Signing in...'
                    : 'Sedang masuk...'
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
