import { useState } from 'react';
import { ArrowUpRight, Mail, MapPin, Phone, Printer } from 'lucide-react';
import { Locale, UI_COPY } from '../data/cvData';
import { CvProfileData } from '../utils/cvFirestoreApi';

interface ContactSectionProps {
  locale: Locale;
  profile: CvProfileData;
  onPrint: () => void;
}

export function ContactSection({ locale, profile, onPrint }: ContactSectionProps) {
  const [senderName, setSenderName] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');

  const t = UI_COPY[locale].sections;

  const digits = profile.phoneDisplay.replace(/\D/g, '');
  const phoneHref = digits.startsWith('0')
    ? `tel:+62${digits.slice(1)}`
    : digits
      ? `tel:+${digits}`
      : '#';

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
    return `mailto:${profile.email}?subject=${subject}&body=${encodeURIComponent(
      bodyLines.join('\n')
    )}`;
  };

  const buildWhatsAppUrl = () => {
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
    return `${profile.whatsappHref}?text=${encodeURIComponent(text)}`;
  };

  return (
    <>
      <section id="contact" className="no-print bg-slate-50 py-14 dark:bg-slate-950 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Left Info */}
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
                {t.contactKicker}
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 text-balance dark:text-white">
                {t.contactTitle}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {t.contactDesc}
              </p>

              <div className="mt-8 space-y-4 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-3 text-slate-700 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400"
                >
                  <Mail className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <span>{profile.email}</span>
                </a>
                <a
                  href={phoneHref}
                  className="flex items-center gap-3 font-mono text-slate-700 transition-colors hover:text-blue-700 tabular-nums dark:text-slate-300 dark:hover:text-blue-400"
                >
                  <Phone className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <span>{profile.phoneDisplay}</span>
                </a>
                <div className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <span>{profile.address}</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Message Composer */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:p-8">
                <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  {locale === 'en' ? 'Quick Message Composer' : 'Kirim Pesan Cepat'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {locale === 'en'
                    ? 'Compose your inquiry and open directly in your email client or WhatsApp.'
                    : 'Tulis pesan Anda dan kirim langsung melalui aplikasi Email atau WhatsApp.'}
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
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
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
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
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
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
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

      <footer className="no-print border-t border-slate-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} {profile.name} · {locale === 'en' ? profile.titleEn : profile.titleId}
          </p>

          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'en' ? 'Print A4 Resume' : 'Cetak CV Ukuran A4'}</span>
          </button>
        </div>
      </footer>
    </>
  );
}
