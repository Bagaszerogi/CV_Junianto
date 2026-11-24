import { FormEvent, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { Locale } from '../data/cvData';
import { signInAdminWithEmail, signInAdminWithGoogle } from '../utils/projectApi';

interface AdminAuthModalProps {
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
}

export function AdminAuthModal({ isOpen, locale, onClose }: AdminAuthModalProps) {
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await signInAdminWithGoogle();
      onClose();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Google sign-in failed.'
            : 'Login Google gagal.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await signInAdminWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/operation-not-allowed')) {
        setAuthError(
          locale === 'en'
            ? 'Email/Password sign-in is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method, or use Google Sign-In.'
            : 'Login Email/Password belum diaktifkan di Firebase Console. Aktifkan di Authentication → Sign-in method, atau gunakan Login Google.'
        );
      } else {
        setAuthError(msg);
      }
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
                  ? 'Edit profile, photo, experience, skills, and projects.'
                  : 'Ubah profil, foto, pengalaman, keahlian, dan proyek.'}
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
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              authMethod === 'google'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            Google Sign-In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('email');
              setAuthError(null);
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
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
          >
            {authError}
          </div>
        )}

        {authMethod === 'google' ? (
          <div className="mt-5 space-y-4">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {locale === 'en'
                ? 'Sign in with your authorized admin Google account to unlock full CV editing.'
                : 'Masuk dengan akun Google admin yang terdaftar untuk mengaktifkan mode edit penuh.'}
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
                    : 'Lanjutkan dengan Google'}
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
              <label
                htmlFor="global-admin-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <input
                id="global-admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
              />
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
