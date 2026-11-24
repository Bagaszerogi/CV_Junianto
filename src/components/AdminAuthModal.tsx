import { FormEvent, useState } from 'react';
import { Eye, EyeOff, MailCheck, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { auth } from '../firebase';
import { Locale } from '../data/cvData';
import {
  checkIsAdminUser,
  sendAdminPasswordReset,
  sendAdminVerificationEmail,
  signInAdminWithEmail,
  signInAdminWithGoogle,
  syncAdminRecord,
} from '../utils/projectApi';

interface AdminAuthModalProps {
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onAdminVerified?: () => void;
}

export function AdminAuthModal({
  isOpen,
  locale,
  onClose,
  onAdminVerified,
}: AdminAuthModalProps) {
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const formatAuthError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

    if (msg.startsWith('AUTH_UNAUTHORIZED_EMAIL:')) {
      const email = msg.slice('AUTH_UNAUTHORIZED_EMAIL:'.length);
      return locale === 'en'
        ? `Account (${email}) is not authorized as a CV admin. Please sign in with a registered admin account.`
        : `Akun (${email}) tidak terdaftar sebagai admin CV. Silakan masuk dengan akun admin yang terdaftar.`;
    }
    if (msg.includes('auth/unauthorized-domain')) {
      return locale === 'en'
        ? `Domain "${hostname}" is not authorized in Firebase Auth. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
        : `Domain "${hostname}" belum didaftarkan di Firebase Auth. Tambahkan di Firebase Console → Authentication → Settings → Authorized domains.`;
    }
    if (msg.includes('auth/popup-blocked')) {
      return locale === 'en'
        ? 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
        : 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.';
    }
    if (msg.includes('auth/popup-closed-by-user') || msg.includes('auth/cancelled-popup-request')) {
      return locale === 'en'
        ? 'Google sign-in window was closed before completing.'
        : 'Jendela login Google ditutup sebelum selesai.';
    }
    if (msg.includes('auth/operation-not-allowed')) {
      return locale === 'en'
        ? 'Email/Password sign-in is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method, or use Google Sign-In.'
        : 'Login Email/Password belum diaktifkan di Firebase Console. Aktifkan di Authentication → Sign-in method, atau gunakan Google Sign-In.';
    }
    if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
      return locale === 'en'
        ? 'Incorrect email or password, or the Email/Password account has not been created in Firebase Console → Authentication → Users yet.'
        : 'Email atau kata sandi salah, atau akun Email/Password belum dibuat di Firebase Console → Authentication → Users.';
    }
    return msg;
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setNeedsVerification(false);
    setIsSubmitting(true);
    try {
      await signInAdminWithGoogle();
      onAdminVerified?.();
      onClose();
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setNeedsVerification(false);
    setIsSubmitting(true);
    try {
      const result = await signInAdminWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
      if (result.needsVerification) {
        setNeedsVerification(true);
        setAuthInfo(
          locale === 'en'
            ? 'Your admin email is signed in but not verified yet. Verify your email to unlock Firestore editing, or sign in via Google Sign-In.'
            : 'Email admin Anda berhasil masuk tetapi belum terverifikasi. Verifikasi email untuk membuka fitur edit database, atau masuk lewat Google Sign-In.'
        );
      } else {
        onAdminVerified?.();
        onClose();
      }
    } catch (err) {
      setAuthError(formatAuthError(err));
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
      setAuthError(formatAuthError(err));
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
      setAuthError(formatAuthError(err));
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
      setAuthError(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-auth-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-7">
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
                {locale === 'en' ? 'Admin Sign In' : 'Login Admin CV'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {locale === 'en'
                  ? 'Sign in to edit all CV text, photos, experience, and projects.'
                  : 'Masuk untuk mengedit semua teks CV, foto, pengalaman, dan proyek.'}
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
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              authMethod === 'email'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            Email & Password
          </button>
        </div>

        {authError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
          >
            {authError}
          </div>
        )}

        {authInfo && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-200"
          >
            {authInfo}
          </div>
        )}

        {needsVerification ? (
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
          <div className="mt-5 space-y-4">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {locale === 'en'
                ? 'Choose your registered admin Google account when prompted to unlock full CV editing.'
                : 'Pilih akun Google admin Anda yang terdaftar saat jendela Google muncul untuk mengaktifkan mode edit penuh.'}
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
                placeholder="name@example.com"
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
