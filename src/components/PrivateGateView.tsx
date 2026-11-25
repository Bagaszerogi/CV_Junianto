import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound, Moon, ShieldCheck, Sun } from 'lucide-react';
import { PrivateSealLogo } from './BrandLogo';
import { ThemeMode } from './HeroSection';

export type GateStatus = 'checking' | 'locked' | 'denied';

interface PrivateGateViewProps {
  status: GateStatus;
  locale: 'en' | 'id';
  theme: ThemeMode;
  initialCode?: string;
  onLocaleChange: (next: 'en' | 'id') => void;
  onThemeChange: (next: ThemeMode) => void;
  onSubmitCode: (code: string) => void;
  onSecretAdminTrigger: () => void;
}

export function PrivateGateView({
  status,
  locale,
  theme,
  initialCode = '',
  onLocaleChange,
  onThemeChange,
  onSubmitCode,
  onSecretAdminTrigger,
}: PrivateGateViewProps) {
  const [codeInput, setCodeInput] = useState(initialCode);
  const [tapCount, setTapCount] = useState(0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    onSubmitCode(codeInput);
  };

  const handleEmblemTap = () => {
    const next = tapCount + 1;
    if (next >= 3) {
      setTapCount(0);
      onSecretAdminTrigger();
    } else {
      setTapCount(next);
      window.setTimeout(() => setTapCount(0), 1200);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-slate-50 px-6 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Minimal Top Bar */}
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleEmblemTap}
            aria-label="Document security seal"
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-opacity hover:opacity-90 cursor-default"
          >
            <PrivateSealLogo className="h-9 w-9" />
          </button>
          <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {locale === 'en' ? 'Private Portfolio' : 'Portofolio Privat'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Theme switch"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => onThemeChange('light')}
              aria-label="Light mode"
              className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              aria-label="Dark mode"
              className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div
            role="group"
            aria-label="Language switch"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => onLocaleChange('id')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                locale === 'id'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => onLocaleChange('en')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                locale === 'en'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Main Architectural Invitation Card */}
      <main className="mx-auto my-auto flex w-full max-w-xl flex-col py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-10">
          {status === 'checking' ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-5 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {locale === 'en'
                  ? 'Verifying your invitation link with the server...'
                  : 'Sedang memverifikasi tautan undangan dengan server...'}
              </p>
            </div>
          ) : (
            <>
              <p className="font-mono text-[11px] font-semibold tracking-wider text-blue-700 uppercase dark:text-blue-400">
                {status === 'denied'
                  ? locale === 'en'
                    ? 'ACCESS UNAVAILABLE'
                    : 'AKSES TIDAK TERSEDIA'
                  : locale === 'en'
                    ? 'INVITATION REQUIRED · NOINDEX'
                    : 'KHUSUS UNDANGAN · PRIVAT'}
              </p>

              <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-950 text-balance dark:text-white sm:text-3xl">
                {status === 'denied'
                  ? locale === 'en'
                    ? 'Invitation Link Inactive or Expired'
                    : 'Tautan Undangan Tidak Aktif atau Kedaluwarsa'
                  : locale === 'en'
                    ? 'Private Curriculum Vitae'
                    : 'Curriculum Vitae Privat'}
              </h1>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {status === 'denied'
                  ? locale === 'en'
                    ? 'The invitation link you opened is invalid, expired, or has been deactivated. Check the link from your email or enter a valid invitation code below.'
                    : 'Tautan undangan yang Anda buka sudah tidak berlaku, kedaluwarsa, atau telah dinonaktifkan. Periksa kembali tautan dari email atau masukkan kode undangan aktif di bawah.'
                  : locale === 'en'
                    ? 'This executive CV and portfolio is kept private from public browsing. Please open the unique invitation link sent to your email or enter your invitation code below.'
                    : 'Dokumen CV dan portofolio ini disembunyikan dari publik dan mesin pencari. Silakan buka langsung tautan khusus yang dikirimkan melalui email, atau masukkan kode undangan di bawah.'}
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-3">
                <label
                  htmlFor="invite-code-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {locale === 'en' ? 'Invitation Code or URL' : 'Kode atau Tautan Undangan'}
                </label>
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <div className="relative flex-1">
                    <KeyRound
                      className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="invite-code-input"
                      type="text"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder={
                        locale === 'en'
                          ? 'Enter invitation code (e.g. kunci-hrd-2026)'
                          : 'Masukkan kode undangan (mis. kunci-hrd-2026)'
                      }
                      className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2.5 pr-3.5 pl-10 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>{locale === 'en' ? 'Open CV' : 'Buka CV'}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </form>

              <div className="mt-7 flex items-start gap-3 border-t border-slate-100 pt-5 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                <span>
                  {locale === 'en'
                    ? 'Protected at database level: personal contact details, career history, and project archives remain locked unless verified by an active invitation token.'
                    : 'Dilindungi langsung di tingkat database: data kontak pribadi, riwayat karier, dan portofolio hanya terbuka untuk tautan undangan aktif.'}
                </span>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="mx-auto flex w-full max-w-4xl items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span>
          {locale === 'en'
            ? 'Direct Email Invitation Access Only'
            : 'Akses Eksklusif Melalui Undangan Email'}
        </span>
        <span className="font-mono">noindex · private</span>
      </footer>
    </div>
  );
}
