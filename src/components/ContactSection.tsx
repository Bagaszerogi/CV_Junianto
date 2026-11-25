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
        className="no-print bg-slate-50 py-14 dark:bg-slate-950 md:py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
            {/* Left Info & Quick-Copy Executive Contact */}
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
                <EditableText
                  value={siteCopy.contactKicker}
                  canEdit={isAdminUser}
                  maxLength={80}
                  onSave={(val) => onSaveSiteCopyField('contactKicker', val)}
                />
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 text-balance dark:text-white">
                <EditableText
                  value={siteCopy.contactTitle}
                  canEdit={isAdminUser}
                  maxLength={120}
                  onSave={(val) => onSaveSiteCopyField('contactTitle', val)}
                />
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <EditableText
                  value={siteCopy.contactDesc}
                  canEdit={isAdminUser}
                  multiline
                  maxLength={400}
                  onSave={(val) => onSaveSiteCopyField('contactDesc', val)}
                />
              </p>

              <div className="mt-7 divide-y divide-slate-200/80 rounded-2xl border border-slate-200/90 bg-white/80 px-5 shadow-2xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between gap-3 py-3.5 text-sm">
                  <a
                    href={`mailto:${sanitizeEmailForHref(profile.email)}`}
                    className="flex min-w-0 items-center gap-3 text-slate-700 transition-colors hover:text-blue-700 dark:text-slate-200 dark:hover:text-blue-400"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <EditableText
                      value={profile.email}
                      canEdit={isAdminUser}
                      maxLength={140}
                      className="truncate font-medium"
                      onSave={(val) => onSaveProfilePatch({ email: val })}
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile.email, 'email')}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    {copiedField === 'email' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400">
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

                <div className="flex items-center justify-between gap-3 py-3.5 text-sm">
                  <a
                    href={phoneHref}
                    className="flex items-center gap-3 font-mono text-slate-700 transition-colors hover:text-blue-700 tabular-nums dark:text-slate-200 dark:hover:text-blue-400"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <EditableText
                      value={profile.phoneDisplay}
                      canEdit={isAdminUser}
                      maxLength={40}
                      onSave={(val) => onSaveProfilePatch({ phoneDisplay: val })}
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile.phoneDisplay, 'phone')}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    {copiedField === 'phone' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400">
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

                <div className="flex items-start gap-3 py-3.5 text-sm text-slate-600 dark:text-slate-400">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <EditableText
                    value={profile.address}
                    canEdit={isAdminUser}
                    maxLength={240}
                    onSave={(val) => onSaveProfilePatch({ address: val })}
                  />
                </div>
              </div>
            </div>

            {/* Right Interactive Message Composer */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-shadow hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
                <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  <EditableText
                    value={siteCopy.composerTitle}
                    canEdit={isAdminUser}
                    maxLength={120}
                    onSave={(val) => onSaveSiteCopyField('composerTitle', val)}
                  />
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {locale === 'en' ? 'Your Name' : 'Nama Anda'}
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder={locale === 'en' ? 'e.g. HR Manager' : 'mis. HR Manager'}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-company"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {locale === 'en' ? 'Hotel / Organization' : 'Hotel / Perusahaan'}
                    </label>
                    <input
                      id="contact-company"
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder={locale === 'en' ? 'e.g. Grand Hotel Jakarta' : 'mis. Hotel Nusantara'}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                  />
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href={buildMailtoUrl()}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Open Email Draft' : 'Buka Draft Email'}</span>
                  </a>

                  <a
                    href={buildWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
                  >
                    <span>{locale === 'en' ? 'Send via WhatsApp' : 'Kirim via WhatsApp'}</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="no-print border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <BrandLogo className="mt-0.5 h-9 w-9 shrink-0" />
            <div>
              <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                <EditableText
                  value={profile.name}
                  canEdit={isAdminUser}
                  maxLength={120}
                  onSave={(val) => onSaveProfilePatch({ name: val })}
                />
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            <a href="#profile" className="hover:text-blue-700 dark:hover:text-blue-400">
              {siteCopy.navProfile}
            </a>
            <a href="#experience" className="hover:text-blue-700 dark:hover:text-blue-400">
              {siteCopy.navExperience}
            </a>
            <a href="#projects" className="hover:text-blue-700 dark:hover:text-blue-400">
              {siteCopy.navProjects}
            </a>
            <a href="#tech-stack" className="hover:text-blue-700 dark:hover:text-blue-400">
              {siteCopy.navStack}
            </a>
          </nav>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{siteCopy.downloadPdf}</span>
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
