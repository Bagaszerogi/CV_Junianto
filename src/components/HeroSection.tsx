import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  Check,
  Copy,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Printer,
  Trash2,
} from 'lucide-react';
import { Locale } from '../data/cvData';
import {
  compressPortraitImage,
  CvProfileData,
  MetricItem,
  SiteCopyLocale,
} from '../utils/cvFirestoreApi';
import { sanitizeEmailForHref, sanitizePortraitSrc, sanitizeWhatsAppHref } from '../utils/safeUrls';
import { EditableText } from './EditableText';
import { NetworkMeshCanvas } from './NetworkMeshCanvas';
import { ProfileEditTab } from './ProfileEditModal';

export type ThemeMode = 'light' | 'dark';

interface HeroSectionProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  profile: CvProfileData;
  siteCopy: SiteCopyLocale;
  isAdminUser: boolean;
  onSaveProfilePatch: (patch: Partial<CvProfileData>) => Promise<void>;
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
  onOpenProfileEdit: (tab?: ProfileEditTab) => void;
  onPrint: () => void;
}

function renderKineticName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let charIndex = 0;

  return words.map((word, wi) => {
    const isOutlined = wi === 1;
    const chars = Array.from(word).map((ch) => {
      const idx = charIndex++;
      return (
        <span
          key={`${wi}-${idx}`}
          className="hero-char"
          style={{ ['--i' as string]: idx }}
        >
          {ch}
        </span>
      );
    });

    return (
      <span key={`${wi}-${word}`}>
        <span
          className={`inline-block overflow-hidden align-top pb-[0.06em] ${
            isOutlined ? 'hero-word-outline' : ''
          }`}
        >
          {chars}
        </span>
        {wi < words.length - 1 ? ' ' : ''}
      </span>
    );
  });
}

export function HeroSection({
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
  profile,
  siteCopy,
  isAdminUser,
  onSaveProfilePatch,
  onSaveSiteCopyField,
  onOpenProfileEdit,
  onPrint,
}: HeroSectionProps) {
  const [imgError, setImgError] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgError(false);
  }, [profile.portraitDataUrl]);

  // Subtle ambient float + pointer parallax on the arched portrait frame
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let ox = 0;
    let oy = 0;

    const onPointerMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const tick = (t: number) => {
      const px = mx / Math.max(1, window.innerWidth) - 0.5;
      const py = my / Math.max(1, window.innerHeight) - 0.5;
      ox += (px * -16 - ox) * 0.06;
      oy += (py * -12 - oy) * 0.06;
      const floatY = Math.sin(t * 0.0012) * 5;
      el.style.transform = `translate3d(${ox.toFixed(1)}px, ${(oy + floatY).toFixed(1)}px, 0)`;
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      if (el) el.style.transform = '';
    };
  }, []);

  const handleCopy = async (text: string, field: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const handleQuickPhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAdminUser) return;
    setPhotoError(null);
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressPortraitImage(file);
      await onSaveProfilePatch({ portraitDataUrl: compressed });
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setPhotoError(msg);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!isAdminUser) return;
    setPhotoError(null);
    setIsRemovingPhoto(true);
    try {
      await onSaveProfilePatch({ portraitDataUrl: '' });
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setPhotoError(msg);
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  const handleSaveMetricField = async (
    idx: number,
    field: 'value' | 'label' | 'detail',
    nextVal: string
  ) => {
    const nextMetrics: MetricItem[] = profile.metrics.map((m, i) => {
      if (i !== idx) return m;
      if (field === 'value') {
        return locale === 'en' ? { ...m, value: nextVal } : { ...m, valueId: nextVal };
      }
      if (field === 'label') {
        return locale === 'en' ? { ...m, label: nextVal } : { ...m, labelId: nextVal };
      }
      return locale === 'en' ? { ...m, detail: nextVal } : { ...m, detailId: nextVal };
    });
    await onSaveProfilePatch({ metrics: nextMetrics });
  };

  const digits = profile.phoneDisplay.replace(/\D/g, '');
  const phoneHref = digits.startsWith('0')
    ? `tel:+62${digits.slice(1)}`
    : digits
      ? `tel:+${digits}`
      : '#';

  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const safePortrait = sanitizePortraitSrc(profile.portraitDataUrl, '');
  const showPhoto = Boolean(safePortrait) && !imgError;

  return (
    <section
      id="profile"
      className="print-section relative overflow-hidden border-b border-[var(--line)] bg-[var(--bg)]"
    >
      <NetworkMeshCanvas theme={theme} />

      <div className="relative z-10 mx-auto max-w-[1120px] px-[clamp(20px,5vw,48px)] py-12 print:px-0 print:py-0 md:py-16">
        {/* Top Toolbar: Brass Kicker Line + Theme & Language Switches */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-wider text-[var(--brass)] uppercase">
            <span className="inline-block h-px w-8 bg-[var(--brass)] print:hidden" aria-hidden="true" />
            <EditableText
              value={locale === 'en' ? profile.kickerEn : profile.kickerId}
              canEdit={isAdminUser}
              maxLength={160}
              onSave={(val) =>
                onSaveProfilePatch(locale === 'en' ? { kickerEn: val } : { kickerId: val })
              }
            />
          </p>

          <div className="no-print flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)] text-base text-[var(--ink)] transition-all duration-500 hover:rotate-180 hover:border-[var(--brass)] cursor-pointer"
            >
              ◐
            </button>

            <div
              role="group"
              aria-label="Language switch"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--card)] p-1"
            >
              <button
                type="button"
                onClick={() => onLocaleChange('id')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  locale === 'id'
                    ? 'bg-[var(--brass)] text-[#1a1405]'
                    : 'text-[var(--mute)] hover:text-[var(--ink)]'
                }`}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => onLocaleChange('en')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  locale === 'en'
                    ? 'bg-[var(--brass)] text-[#1a1405]'
                    : 'text-[var(--mute)] hover:text-[var(--ink)]'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Hero Editorial Grid */}
        <div className="mt-8 grid grid-cols-1 gap-10 print:mt-3 print:grid-cols-12 print:gap-5 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Kinetic Display Name, Title, Summary, Magnetic Actions */}
          <div className="flex flex-col justify-between print:col-span-7 lg:col-span-7">
            <div>
              <h1 className="font-display text-[clamp(2.5rem,6.6vw,5.1rem)] font-bold leading-[0.98] tracking-[-0.025em] text-[var(--ink)] text-balance print:text-2xl">
                {isAdminUser ? (
                  <EditableText
                    value={profile.name}
                    canEdit={isAdminUser}
                    maxLength={120}
                    onSave={(val) => onSaveProfilePatch({ name: val })}
                  />
                ) : (
                  renderKineticName(profile.name)
                )}
              </h1>

              <p className="mt-4 text-lg font-semibold text-[var(--brass)] print:mt-1 print:text-sm sm:text-xl">
                <EditableText
                  value={locale === 'en' ? profile.titleEn : profile.titleId}
                  canEdit={isAdminUser}
                  maxLength={140}
                  onSave={(val) =>
                    onSaveProfilePatch(locale === 'en' ? { titleEn: val } : { titleId: val })
                  }
                />
              </p>

              <p className="mt-6 max-w-[48ch] text-base leading-relaxed text-[var(--mute)] print:mt-3 print:text-xs print:leading-snug sm:text-[1.08rem]">
                <EditableText
                  value={locale === 'en' ? profile.summaryEn : profile.summaryId}
                  canEdit={isAdminUser}
                  multiline
                  maxLength={1500}
                  onSave={(val) =>
                    onSaveProfilePatch(locale === 'en' ? { summaryEn: val } : { summaryId: val })
                  }
                />
              </p>
            </div>

            {/* Rounded Pill CTAs */}
            <div className="no-print mt-8 flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-6 py-3 text-sm font-semibold text-[#1a1405] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--ink)] hover:text-[var(--bg)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <EditableText
                  value={siteCopy.downloadPdf}
                  canEdit={isAdminUser}
                  maxLength={80}
                  onSave={(val) => onSaveSiteCopyField('downloadPdf', val)}
                />
              </button>

              <a
                href={`mailto:${sanitizeEmailForHref(profile.email)}?subject=${encodeURIComponent(`Hospitality IT Opportunity — ${profile.name}`)}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card)] px-6 py-3 text-sm font-semibold text-[var(--ink)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brass)] whitespace-nowrap shrink-0"
              >
                <Mail className="h-4 w-4 text-[var(--brass)]" aria-hidden="true" />
                <EditableText
                  value={siteCopy.heroSendEmail}
                  canEdit={isAdminUser}
                  maxLength={50}
                  onSave={(val) => onSaveSiteCopyField('heroSendEmail', val)}
                />
              </a>

              <a
                href={sanitizeWhatsAppHref(profile.whatsappHref)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-transparent px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brass)] whitespace-nowrap shrink-0"
              >
                <span>WhatsApp</span>
                <ArrowUpRight className="h-4 w-4 text-[var(--brass)]" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => handleCopy(profile.email, 'email')}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-transparent px-4 py-3 text-sm font-medium text-[var(--mute)] transition-colors hover:border-[var(--brass)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedField === 'email' ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    <span className="text-[var(--ink)]">{locale === 'en' ? 'Copied' : 'Disalin'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Copy Email' : 'Salin Email'}</span>
                  </>
                )}
              </button>

              {isAdminUser && (
                <button
                  type="button"
                  onClick={() => onOpenProfileEdit('identity')}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--brass)]/50 bg-[var(--brass)]/12 px-4 py-3 text-sm font-semibold text-[var(--brass)] transition-colors hover:bg-[var(--brass)]/20 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{locale === 'en' ? 'Edit All Profile Fields' : 'Editor Lengkap Profil'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Arched Brass Portrait Frame + Executive Dossier Card */}
          <div className="print:col-span-5 lg:col-span-5">
            <div className="print-dossier-card rounded-[24px] border border-[var(--line)] bg-[var(--bg2)]/88 p-6 backdrop-blur-sm print:rounded-lg print:border-slate-300 print:bg-slate-50 print:p-4 sm:p-7">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start print:flex-row print:items-start print:gap-3">
                {/* Arched Portrait Frame */}
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div
                    ref={frameRef}
                    className="group/photo relative aspect-[4/5] w-32 shrink-0 rounded-t-full rounded-b-[22px] border border-[var(--brass)] bg-[var(--card)] p-2 shadow-sm print:h-24 print:w-20 print:rounded-xl print:border-slate-300 print:p-0.5 sm:w-36"
                  >
                    <div className="relative h-full w-full overflow-hidden rounded-t-full rounded-b-[16px] print:rounded-xl">
                      {showPhoto ? (
                        <img
                          src={safePortrait}
                          alt={`${profile.name} portrait`}
                          referrerPolicy="no-referrer"
                          onError={() => setImgError(true)}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="grid h-full w-full place-items-center bg-gradient-to-br from-[var(--bg2)] to-[var(--bg)] font-display text-3xl font-bold text-[var(--brass)]"
                        >
                          {initials || 'JB'}
                        </div>
                      )}

                      {isAdminUser && (
                        <button
                          type="button"
                          disabled={isUploadingPhoto}
                          onClick={() => photoInputRef.current?.click()}
                          aria-label="Change portrait photo"
                          className="no-print absolute inset-0 flex flex-col items-center justify-center bg-[#0a1024]/65 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover/photo:opacity-100 cursor-pointer"
                        >
                          <Camera className="mb-1 h-4 w-4 text-[var(--brass)]" aria-hidden="true" />
                          <span>{isUploadingPhoto ? '...' : locale === 'en' ? 'Photo' : 'Ganti'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isAdminUser && (
                    <div className="no-print flex flex-wrap items-center justify-center gap-1.5">
                      <button
                        type="button"
                        disabled={isUploadingPhoto || isRemovingPhoto}
                        onClick={() => photoInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brass)] cursor-pointer"
                      >
                        <Camera className="h-3 w-3 text-[var(--brass)]" aria-hidden="true" />
                        <span>
                          {isUploadingPhoto
                            ? '...'
                            : locale === 'en'
                              ? 'Change'
                              : 'Ganti'}
                        </span>
                      </button>

                      {Boolean(safePortrait) && (
                        <button
                          type="button"
                          disabled={isUploadingPhoto || isRemovingPhoto}
                          onClick={() => void handleRemovePhoto()}
                          title={locale === 'en' ? 'Remove photo (use JB monogram)' : 'Hapus foto (pakai monogram JB)'}
                          className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                          <span>{isRemovingPhoto ? '...' : locale === 'en' ? 'Remove' : 'Hapus'}</span>
                        </button>
                      )}

                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleQuickPhotoUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {/* Role & Property Context */}
                <div className="min-w-0 flex-1 text-center sm:text-left print:text-left">
                  {photoError && (
                    <p className="mb-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                      {photoError}
                    </p>
                  )}

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--brass)_16%,transparent)] px-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--brass)] uppercase print:hidden">
                    <span className="brass-pulse h-1.5 w-1.5 rounded-full bg-[var(--brass)]" aria-hidden="true" />
                    <EditableText
                      value={siteCopy.heroActiveBadge}
                      canEdit={isAdminUser}
                      maxLength={60}
                      onSave={(val) => onSaveSiteCopyField('heroActiveBadge', val)}
                    />
                  </span>

                  <p className="mt-3 font-display text-lg font-bold tracking-tight text-[var(--ink)] print:mt-0 print:text-sm">
                    <EditableText
                      value={profile.currentCompany}
                      canEdit={isAdminUser}
                      maxLength={140}
                      onSave={(val) => onSaveProfilePatch({ currentCompany: val })}
                    />
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--ice)] print:text-xs">
                    <EditableText
                      value={profile.currentRole}
                      canEdit={isAdminUser}
                      maxLength={140}
                      onSave={(val) => onSaveProfilePatch({ currentRole: val })}
                    />
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--mute)] print:text-[10px]">
                    <EditableText
                      value={siteCopy.heroPropertyScale}
                      canEdit={isAdminUser}
                      maxLength={140}
                      onSave={(val) => onSaveSiteCopyField('heroPropertyScale', val)}
                    />
                  </p>
                </div>
              </div>

              {/* Clean hairline-divided contact details */}
              <div className="mt-6 divide-y divide-[var(--line)] border-t border-[var(--line)] text-sm print:mt-3 print:divide-slate-200 print:border-slate-200 print:text-xs">
                <div className="flex items-center justify-between gap-3 py-3 print:py-1.5">
                  <a
                    href={phoneHref}
                    className="flex min-w-0 items-center gap-3 text-[var(--ink)] transition-colors hover:text-[var(--brass)] print:text-slate-800"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-[var(--brass)] print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                    <EditableText
                      value={profile.phoneDisplay}
                      canEdit={isAdminUser}
                      maxLength={40}
                      className="font-mono tabular-nums"
                      onSave={(val) => onSaveProfilePatch({ phoneDisplay: val })}
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile.phoneDisplay, 'phone')}
                    aria-label="Copy phone number"
                    className="no-print inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--mute)] transition-colors hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    {copiedField === 'phone' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-[var(--ink)]">
                          {locale === 'en' ? 'Copied' : 'Disalin'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{locale === 'en' ? 'Copy' : 'Salin'}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 py-3 print:py-1.5">
                  <a
                    href={`mailto:${sanitizeEmailForHref(profile.email)}`}
                    className="flex min-w-0 items-center gap-3 text-[var(--ink)] transition-colors hover:text-[var(--brass)] print:text-slate-800"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-[var(--brass)] print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                    <EditableText
                      value={profile.email}
                      canEdit={isAdminUser}
                      maxLength={140}
                      className="truncate"
                      onSave={(val) => onSaveProfilePatch({ email: val })}
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile.email, 'email')}
                    aria-label="Copy email address"
                    className="no-print inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--mute)] transition-colors hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    {copiedField === 'email' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-[var(--ink)]">
                          {locale === 'en' ? 'Copied' : 'Disalin'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{locale === 'en' ? 'Copy' : 'Salin'}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-start gap-3 pt-3 print:pt-1.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brass)] print:h-3.5 print:w-3.5 print:text-slate-500" aria-hidden="true" />
                  <span className="leading-snug text-[var(--mute)] print:text-slate-700">
                    <EditableText
                      value={profile.address}
                      canEdit={isAdminUser}
                      maxLength={240}
                      onSave={(val) => onSaveProfilePatch({ address: val })}
                    />
                  </span>
                </div>
              </div>

              <div className="no-print mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--mute)]">
                <EditableText
                  value={siteCopy.heroDossierFooter}
                  canEdit={isAdminUser}
                  maxLength={100}
                  onSave={(val) => onSaveSiteCopyField('heroDossierFooter', val)}
                />
                <span className="font-mono text-[11px] text-[var(--brass)]">EN / ID</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hairline-Divided Quantitative Brass Metrics Strip */}
        <div className="mt-12 grid grid-cols-1 border-y border-[var(--line)] print:mt-4 print:grid-cols-4 print:border-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          {profile.metrics.map((metric, idx) => (
            <div
              key={idx}
              className="border-b border-[var(--line)] py-5 pr-4 last:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0 lg:border-b-0 print:border-slate-200 print:px-3 print:py-2"
            >
              <p className="font-display text-3xl font-bold tracking-tight text-[var(--brass)] tabular-nums print:text-base sm:text-4xl">
                <EditableText
                  value={locale === 'en' ? metric.value : metric.valueId}
                  canEdit={isAdminUser}
                  maxLength={40}
                  onSave={(val) => handleSaveMetricField(idx, 'value', val)}
                />
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[var(--ink)] print:mt-0.5 print:text-[11px]">
                <EditableText
                  value={locale === 'en' ? metric.label : metric.labelId}
                  canEdit={isAdminUser}
                  maxLength={80}
                  onSave={(val) => handleSaveMetricField(idx, 'label', val)}
                />
              </p>
              <p className="mt-0.5 text-xs text-[var(--mute)] print:text-[10px]">
                <EditableText
                  value={locale === 'en' ? metric.detail : metric.detailId}
                  canEdit={isAdminUser}
                  maxLength={120}
                  onSave={(val) => handleSaveMetricField(idx, 'detail', val)}
                />
              </p>
            </div>
          ))}
        </div>

        {/* Scroll Indicator Wheel */}
        <div className="no-print mt-8 flex justify-center">
          <div
            aria-hidden="true"
            className="scroll-wheel relative h-9 w-[22px] rounded-xl border-[1.5px] border-[var(--mute)] opacity-70"
          />
        </div>
      </div>
    </section>
  );
}
