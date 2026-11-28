import { useState } from 'react';
import { ArrowUpRight, Check, Copy, Mail, MapPin, Phone, Printer } from 'lucide-react';
import { Locale } from '../data/cvData';
import { CvProfileData, SiteCopyLocale } from '../utils/cvFirestoreApi';
import { sanitizeEmailForHref, sanitizeWhatsAppHref } from '../utils/safeUrls';
import { BrandLogo } from './BrandLogo';
import { EditableText } from './EditableText';

interface ContactSectionProps {
  locale: Locale;
  profile: CvProfileData;
  siteCopy: SiteCopyLocale;
  isAdminUser: boolean;
  onSaveProfilePatch: (patch: Partial<CvProfileData>) => Promise<void>;
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
  onPrint: () => void;
}

export function ContactSection({
  locale,
  profile,
  siteCopy,
  isAdminUser,
  onSaveProfilePatch,
  onSaveSiteCopyField,
  onPrint,
}: ContactSectionProps) {
  const [senderName, setSenderName] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);

  const digits = profile.phoneDisplay.replace(/\D/g, '');
  const phoneHref = digits.startsWith('0')
    ? `tel:+62${digits.slice(1)}`
    : digits
      ? `tel:+${digits}`
      : '#';

  const handleCopy = async (value: string, field: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const buildMailtoUrl = () => {
    const subject = encodeURIComponent(
      company
        ? `Hospitality IT Inquiry — ${company}`
        : `Hospitality IT Opportunity — ${profile.name}`
    );
    const bodyLines = [
      senderName ? `From: ${senderName}` : '',
      company ? `Organization: ${company}` : '',
      '',
      message ||
        (locale === 'en'
          ? `Hello ${profile.brandShort}, we would like to discuss a hospitality IT opportunity with you.`
          : `Halo ${profile.brandShort}, kami ingin mendiskusikan peluang kerja di bidang IT perhotelan bersama Anda.`),
    ].filter(Boolean);
    const safeEmail = sanitizeEmailForHref(profile.email);
    return `mailto:${safeEmail}?subject=${subject}&body=${encodeURIComponent(
      bodyLines.join('\n')
    )}`;
  };

  const buildWhatsAppUrl = () => {
    const baseWa = sanitizeWhatsAppHref(profile.whatsappHref);
    if (baseWa === '#') return '#';
    const text = [
      senderName ? `Halo ${profile.brandShort}, saya ${senderName}` : `Halo ${profile.brandShort}`,
      company ? `dari ${company}.` : '.',
      message ||
        (locale === 'en'
          ? 'We viewed your CV and would like to connect regarding a hospitality IT role.'
          : 'Kami telah melihat CV Anda dan ingin berdiskusi mengenai posisi IT perhotelan.'),
    ]
      .join(' ')
      .replace(' .', '.');
    return `${baseWa}?text=${encodeURIComponent(text)}`;
  };

  return (
    <>
      <section
        id="contact"
        data-animate="section"
        className="no-print overflow-x-clip bg-[var(--bg)] py-16 md:py-24"
      >
        <div className="mx-auto max-w-[1120px] px-[clamp(20px,5vw,48px)]">
          {/* Centered Editorial Call-To-Action Header */}
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex max-w-full flex-wrap items-center justify-center gap-3 text-xs font-semibold tracking-wider text-[var(--brass)] uppercase">
              <span className="inline-block h-px w-6 bg-[var(--brass)]" aria-hidden="true" />
              <EditableText
                value={siteCopy.contactKicker}
                canEdit={isAdminUser}
                maxLength={80}
                onSave={(val) => onSaveSiteCopyField('contactKicker', val)}
              />
              <span className="inline-block h-px w-6 bg-[var(--brass)]" aria-hidden="true" />
            </p>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,5.4vw,4.1rem)] font-bold leading-[1.03] tracking-tight text-[var(--ink)] text-balance">
              <EditableText
                value={siteCopy.contactTitle}
                canEdit={isAdminUser}
                maxLength={120}
                onSave={(val) => onSaveSiteCopyField('contactTitle', val)}
              />
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--mute)] sm:text-base">
              <EditableText
                value={siteCopy.contactDesc}
                canEdit={isAdminUser}
                multiline
                maxLength={400}
                onSave={(val) => onSaveSiteCopyField('contactDesc', val)}
              />
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-[var(--brass)] px-5 py-3 text-center text-sm font-semibold text-[#1a1405] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--ink)] hover:text-[var(--bg)] sm:px-6"
              >
                <span className="[overflow-wrap:anywhere]">WhatsApp {profile.phoneDisplay}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
              <a
                href={buildMailtoUrl()}
                className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card)] px-5 py-3 text-center text-sm font-semibold text-[var(--ink)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brass)] sm:px-6"
              >
                <Mail className="h-4 w-4 shrink-0 text-[var(--brass)]" aria-hidden="true" />
                <span>{locale === 'en' ? 'Send Email' : 'Kirim Email'}</span>
              </a>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            {/* Left Quick-Copy Contact Card */}
            <div className="min-w-0 lg:col-span-5">
              <div className="divide-y divide-[var(--line)] rounded-[22px] border border-[var(--line)] bg-[var(--card)] px-5 sm:px-6">
                <div className="flex items-center justify-between gap-3 py-4 text-sm">
                  <a
                    href={`mailto:${sanitizeEmailForHref(profile.email)}`}
                    className="flex min-w-0 flex-1 items-center gap-3 text-[var(--ink)] transition-colors hover:text-[var(--brass)]"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-[var(--brass)]" aria-hidden="true" />
                    <EditableText
                      value={profile.email}
                      canEdit={isAdminUser}
                      maxLength={140}
                      className="min-w-0 flex-1 break-all font-medium"
                      onSave={(val) => onSaveProfilePatch({ email: val })}
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile.email, 'email')}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--mute)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--ink)] cursor-pointer"
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

                <div className="flex items-center justify-between gap-3 py-4 text-sm">
                  <a
                    href={phoneHref}
                    className="flex min-w-0 flex-1 items-center gap-3 font-mono text-[var(--ink)] transition-colors hover:text-[var(--brass)] tabular-nums"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-[var(--brass)]" aria-hidden="true" />
                    <EditableText
                      value={profile.phoneDisplay}
                      canEdit={isAdminUser}
                      maxLength={40}
                      className="min-w-0 [overflow-wrap:anywhere]"
                      onSave={(val) => onSaveProfilePatch({ phoneDisplay: val })}
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile.phoneDisplay, 'phone')}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--mute)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--ink)] cursor-pointer"
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

                <div className="flex min-w-0 items-start gap-3 py-4 text-sm text-[var(--mute)]">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brass)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <EditableText
                      value={profile.address}
                      canEdit={isAdminUser}
                      maxLength={240}
                      onSave={(val) => onSaveProfilePatch({ address: val })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Interactive Message Composer */}
            <div className="min-w-0 lg:col-span-7">
              <div className="rounded-[22px] border border-[var(--line)] bg-[var(--bg2)] p-6 md:p-8">
                <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                  <EditableText
                    value={siteCopy.composerTitle}
                    canEdit={isAdminUser}
                    maxLength={120}
                    onSave={(val) => onSaveSiteCopyField('composerTitle', val)}
                  />
                </h3>
                <p className="mt-1 text-xs text-[var(--mute)]">
                  <EditableText
                    value={siteCopy.composerDesc}
                    canEdit={isAdminUser}
                    maxLength={300}
                    onSave={(val) => onSaveSiteCopyField('composerDesc', val)}
                  />
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-semibold text-[var(--mute)]"
                    >
                      {locale === 'en' ? 'Your Name' : 'Nama Anda'}
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder={locale === 'en' ? 'e.g. HR Manager' : 'mis. HR Manager'}
                      className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--mute)]/70 focus:border-[var(--brass)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-company"
                      className="block text-xs font-semibold text-[var(--mute)]"
                    >
                      {locale === 'en' ? 'Hotel / Organization' : 'Hotel / Perusahaan'}
                    </label>
                    <input
                      id="contact-company"
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder={locale === 'en' ? 'e.g. Grand Hotel Jakarta' : 'mis. Hotel Nusantara'}
                      className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--mute)]/70 focus:border-[var(--brass)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-semibold text-[var(--mute)]"
                  >
                    {locale === 'en' ? 'Message' : 'Pesan'}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      locale === 'en'
                        ? 'Share role details, interview schedule, or infrastructure consultation...'
                        : 'Sampaikan detail posisi, jadwal wawancara, atau kebutuhan konsultasi IT...'
                    }
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--mute)]/70 focus:border-[var(--brass)] focus:outline-none"
                  />
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href={buildMailtoUrl()}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-[#1a1405] transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)] whitespace-nowrap shrink-0"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Open Email Draft' : 'Buka Draft Email'}</span>
                  </a>

                  <a
                    href={buildWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brass)] whitespace-nowrap shrink-0"
                  >
                    <span>{locale === 'en' ? 'Send via WhatsApp' : 'Kirim via WhatsApp'}</span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--brass)]" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="no-print overflow-x-clip border-t border-[var(--line)] bg-[var(--bg)] py-10">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-[clamp(20px,5vw,48px)] md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <BrandLogo className="mt-0.5 h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <p className="font-display text-sm font-bold text-[var(--ink)]">
                © 2026{' '}
                <EditableText
                  value={profile.name}
                  canEdit={isAdminUser}
                  maxLength={120}
                  onSave={(val) => onSaveProfilePatch({ name: val })}
                />
              </p>
              <p className="mt-1 text-xs text-[var(--mute)]">
                <EditableText
                  value={siteCopy.footerNote}
                  canEdit={isAdminUser}
                  maxLength={240}
                  onSave={(val) => onSaveSiteCopyField('footerNote', val)}
                />
                {' · '}
                <EditableText
                  value={profile.address}
                  canEdit={isAdminUser}
                  maxLength={240}
                  onSave={(val) => onSaveProfilePatch({ address: val })}
                />
              </p>
            </div>
          </div>

          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-[var(--mute)]"
          >
            <a href="#profile" className="hover:text-[var(--brass)]">
              {siteCopy.navProfile}
            </a>
            <a href="#experience" className="hover:text-[var(--brass)]">
              {siteCopy.navExperience}
            </a>
            <a href="#projects" className="hover:text-[var(--brass)]">
              {siteCopy.navProjects}
            </a>
            <a href="#tech-stack" className="hover:text-[var(--brass)]">
              {siteCopy.navStack}
            </a>
          </nav>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brass)] cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-[var(--brass)]" aria-hidden="true" />
              <span>{siteCopy.downloadPdf}</span>
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
