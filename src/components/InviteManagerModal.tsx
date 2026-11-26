import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Shield,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { Locale } from '../data/cvData';
import {
  createInviteLink,
  deleteInviteLink,
  InviteRecord,
  listAdminInvites,
  rotateShareVaultKey,
  syncPublishedCvSnapshot,
  toggleInviteActive,
  updateInviteExpiry,
} from '../utils/inviteApi';
import { formatReadableFirestoreError } from '../firebase';

interface InviteManagerModalProps {
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { value: '7', en: '7 days', id: '7 hari' },
  { value: '14', en: '14 days (Recommended)', id: '14 hari (Disarankan)' },
  { value: '30', en: '30 days', id: '30 hari' },
  { value: '90', en: '90 days', id: '90 hari' },
  { value: 'none', en: 'No expiration', id: 'Tanpa batas waktu' },
];

export function InviteManagerModal({
  isOpen,
  locale,
  onClose,
}: InviteManagerModalProps) {
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [vaultKey, setVaultKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const [label, setLabel] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [expiryChoice, setExpiryChoice] = useState('14');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedEmailToken, setCopiedEmailToken] = useState<string | null>(null);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://cv-junianto.vercel.app';

  const loadInvites = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await listAdminInvites();
      setInvites(data.invites);
      setVaultKey(data.vaultKey);
    } catch (err) {
      setErrorMsg(formatReadableFirestoreError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg(null);
    setErrorMsg(null);
    setConfirmRotate(false);
    void loadInvites();
  }, [isOpen, loadInvites]);

  if (!isOpen) return null;

  const parseMsg = (err: unknown): string => formatReadableFirestoreError(err);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setIsCreating(true);
    try {
      const days = expiryChoice === 'none' ? null : Number(expiryChoice);
      const created = await createInviteLink({
        label,
        customCode: customCode.trim() || undefined,
        expiresInDays: days,
      });
      setLabel('');
      setCustomCode('');
      setStatusMsg(
        locale === 'en'
          ? `Invitation link created: ${origin}/?invite=${created.token}`
          : `Link undangan berhasil dibuat: ${origin}/?invite=${created.token}`
      );
      await loadInvites();
    } catch (err) {
      setErrorMsg(parseMsg(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (item: InviteRecord) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await toggleInviteActive(item.token, !item.active);
      setInvites((prev) =>
        prev.map((x) => (x.token === item.token ? { ...x, active: !item.active } : x))
      );
    } catch (err) {
      setErrorMsg(parseMsg(err));
    }
  };

  const handleExtend14Days = async (item: InviteRecord) => {
    setErrorMsg(null);
    try {
      await updateInviteExpiry(item.token, 14);
      await loadInvites();
      setStatusMsg(
        locale === 'en'
          ? `Extended "${item.label}" by 14 days.`
          : `Masa berlaku "${item.label}" diperpanjang 14 hari.`
      );
    } catch (err) {
      setErrorMsg(parseMsg(err));
    }
  };

  const handleDelete = async (token: string) => {
    setErrorMsg(null);
    try {
      await deleteInviteLink(token);
      setInvites((prev) => prev.filter((x) => x.token !== token));
    } catch (err) {
      setErrorMsg(parseMsg(err));
    }
  };

  const handleManualSync = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setIsSyncing(true);
    try {
      await syncPublishedCvSnapshot();
      setStatusMsg(
        locale === 'en'
          ? 'Latest CV text, profile, and project photos synced to all active invite links.'
          : 'Data CV terbaru, profil, dan foto proyek berhasil disinkronkan ke semua link undangan aktif.'
      );
    } catch (err) {
      setErrorMsg(parseMsg(err));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRotateKey = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setIsRotating(true);
    try {
      const newKey = await rotateShareVaultKey();
      setVaultKey(newKey);
      setConfirmRotate(false);
      await loadInvites();
      setStatusMsg(
        locale === 'en'
          ? 'Security vault key rotated. Previous leaked cache keys are now blocked; all active invite links continue working seamlessly.'
          : 'Kunci keamanan vault berhasil diputar ulang. Link undangan aktif tetap berjalan dengan kunci baru.'
      );
    } catch (err) {
      setErrorMsg(parseMsg(err));
    } finally {
      setIsRotating(false);
    }
  };

  const copyInviteUrl = async (token: string) => {
    const url = `${origin}/?invite=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Ignore
    }
  };

  const copyEmailBlurb = async (item: InviteRecord) => {
    const url = `${origin}/?invite=${item.token}`;
    const text =
      locale === 'en'
        ? `Please review my Curriculum Vitae & Hospitality IT Portfolio via this private link:\n${url}`
        : `Berikut tautan privat untuk melihat Curriculum Vitae & Portofolio IT Perhotelan saya:\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedEmailToken(item.token);
      setTimeout(() => setCopiedEmailToken(null), 2000);
    } catch {
      // Ignore
    }
  };

  const previewSlug = customCode.trim()
    ? customCode
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-{2,}/g, '-')
        .slice(0, 64)
    : 'hrd-xxxxxxxxxxxx';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-manager-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#0a1024]/70 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-[var(--line)] bg-[var(--bg2)] p-6 text-[var(--ink)] shadow-2xl md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brass)_16%,transparent)] text-[var(--brass)]">
              <Link2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="invite-manager-title"
                className="font-display text-lg font-bold text-[var(--ink)]"
              >
                {locale === 'en'
                  ? 'Private Invitation Links Manager'
                  : 'Kelola Link Undangan Privat (HRD / Email)'}
              </h3>
              <p className="text-xs text-[var(--mute)]">
                {locale === 'en'
                  ? 'Public visitors without an active invite token cannot read CV data.'
                  : 'Pengunjung umum tanpa link undangan aktif tidak dapat mengakses data CV di database.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close invitation manager"
            className="rounded-full p-1.5 text-[var(--mute)] hover:bg-[var(--card)] hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMsg && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-700 dark:text-red-200"
          >
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-200"
          >
            {statusMsg}
          </div>
        )}

        {/* Create New Invite Form */}
        <form
          onSubmit={handleCreate}
          className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 sm:p-5"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--brass)]">
            {locale === 'en' ? 'Create New Invitation Link' : 'Buat Link Undangan Baru'}
          </p>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="invite-label"
                className="block text-xs font-semibold text-[var(--mute)]"
              >
                {locale === 'en' ? 'Recipient / Purpose *' : 'Tujuan / Nama HRD *'}
              </label>
              <input
                id="invite-label"
                type="text"
                required
                maxLength={120}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={locale === 'en' ? 'e.g. HRD Hotel Indonesia' : 'mis. HRD Hotel Mulia'}
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--mute)]/70 focus:border-[var(--brass)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="invite-expiry"
                className="block text-xs font-semibold text-[var(--mute)]"
              >
                {locale === 'en' ? 'Expiration' : 'Batas Waktu Berlaku'}
              </label>
              <select
                id="invite-expiry"
                value={expiryChoice}
                onChange={(e) => setExpiryChoice(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt[locale]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="invite-custom-code"
              className="block text-xs font-semibold text-[var(--mute)]"
            >
              {locale === 'en'
                ? 'Custom Link Code (Optional — leave blank for auto)'
                : 'Kode Link Khusus (Opsional — kosongkan untuk acak otomatis)'}
            </label>
            <input
              id="invite-custom-code"
              type="text"
              maxLength={64}
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="kunci-hrd-2026"
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder:text-[var(--mute)]/70 focus:border-[var(--brass)] focus:outline-none"
            />
            <p className="mt-1.5 truncate font-mono text-[11px] text-[var(--mute)]">
              Preview: {origin}/?invite={previewSlug}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void handleManualSync()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brass)] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[var(--brass)] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {locale === 'en' ? 'Sync Latest CV Now' : 'Sinkronkan Isi CV Sekarang'}
              </span>
            </button>

            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brass)] px-4 py-2 text-xs font-semibold text-[#1a1405] transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)] disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>
                {isCreating
                  ? locale === 'en'
                    ? 'Creating...'
                    : 'Membuat...'
                  : locale === 'en'
                    ? 'Create Invite Link'
                    : 'Buat Link Undangan'}
              </span>
            </button>
          </div>
        </form>

        {/* Active / Inactive Links List */}
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
              {locale === 'en'
                ? `Generated Links (${invites.length})`
                : `Daftar Link Undangan (${invites.length})`}
            </h4>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void loadInvites()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brass)] hover:underline cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{locale === 'en' ? 'Refresh' : 'Muat Ulang'}</span>
            </button>
          </div>

          {isLoading && invites.length === 0 ? (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[var(--line)] py-8 text-xs text-[var(--mute)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--brass)]" />
              <span>{locale === 'en' ? 'Loading invite links...' : 'Memuat daftar undangan...'}</span>
            </div>
          ) : invites.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-5 py-8 text-center text-xs text-[var(--mute)]">
              {locale === 'en'
                ? 'No invite links yet. Create one above to share your CV privately via email.'
                : 'Belum ada link undangan. Buat 1 link di atas untuk ditempel di email lamaran Anda.'}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {invites.map((item) => {
                const isExpired =
                  item.expiresAtMs !== null && item.expiresAtMs <= Date.now();
                const fullUrl = `${origin}/?invite=${item.token}`;

                return (
                  <div
                    key={item.token}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-bold text-[var(--ink)]">
                            {item.label}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              !item.active
                                ? 'bg-[var(--card)] text-[var(--mute)]'
                                : isExpired
                                  ? 'bg-[color-mix(in_srgb,var(--brass)_20%,transparent)] text-[var(--brass)]'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                            }`}
                          >
                            {!item.active
                              ? locale === 'en'
                                ? 'Disabled'
                                : 'Nonaktif'
                              : isExpired
                                ? locale === 'en'
                                  ? 'Expired'
                                  : 'Kedaluwarsa'
                                : locale === 'en'
                                  ? 'Active'
                                  : 'Aktif'}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-[var(--brass)]">
                          {fullUrl}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--mute)]">
                          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>
                            {item.expiresAtMs
                              ? `${locale === 'en' ? 'Expires' : 'Berlaku hingga'}: ${new Date(
                                  item.expiresAtMs
                                ).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}`
                              : locale === 'en'
                                ? 'No automatic expiration'
                                : 'Tanpa batas kedaluwarsa'}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void copyInviteUrl(item.token)}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
                        >
                          {copiedToken === item.token ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-[var(--brass)]" />
                          )}
                          <span>
                            {copiedToken === item.token
                              ? locale === 'en'
                                ? 'Copied'
                                : 'Disalin'
                              : locale === 'en'
                                ? 'Copy URL'
                                : 'Salin Link'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void copyEmailBlurb(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
                        >
                          {copiedEmailToken === item.token ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Mail className="h-3.5 w-3.5 text-[var(--brass)]" />
                          )}
                          <span>
                            {copiedEmailToken === item.token
                              ? locale === 'en'
                                ? 'Copied'
                                : 'Disalin'
                              : locale === 'en'
                                ? 'Email Text'
                                : 'Teks Email'}
                          </span>
                        </button>

                        <a
                          href={`/?invite=${item.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Preview ${item.label}`}
                          className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg2)] p-1.5 text-[var(--ink)] hover:border-[var(--brass)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggle(item)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                            item.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--mute)]'
                          }`}
                        >
                          {item.active ? (
                            <ToggleRight className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span>
                            {item.active
                              ? locale === 'en'
                                ? 'Disable Link'
                                : 'Nonaktifkan'
                              : locale === 'en'
                                ? 'Re-enable'
                                : 'Aktifkan Lagi'}
                          </span>
                        </button>

                        {isExpired && (
                          <button
                            type="button"
                            onClick={() => void handleExtend14Days(item)}
                            className="text-xs font-semibold text-[var(--brass)] hover:underline cursor-pointer"
                          >
                            {locale === 'en' ? '+ Extend 14 Days' : '+ Perpanjang 14 Hari'}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDelete(item.token)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline dark:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{locale === 'en' ? 'Delete' : 'Hapus'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Security Key Rotation Footer */}
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brass)]" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-[var(--ink)]">
                  {locale === 'en' ? 'Vault Security Key' : 'Kunci Keamanan Snapshot CV'}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--mute)]">
                  {vaultKey
                    ? `${vaultKey.slice(0, 6)}••••••••••••••••${vaultKey.slice(-4)}`
                    : 'Not initialized'}
                </p>
              </div>
            </div>

            {!confirmRotate ? (
              <button
                type="button"
                onClick={() => setConfirmRotate(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brass)] cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5 text-[var(--brass)]" aria-hidden="true" />
                <span>
                  {locale === 'en' ? 'Rotate Vault Key' : 'Putar Kunci Keamanan'}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRotate(false)}
                  className="rounded-full border border-[var(--line)] bg-[var(--bg2)] px-3 py-1.5 text-xs font-semibold text-[var(--mute)] cursor-pointer"
                >
                  {locale === 'en' ? 'Cancel' : 'Batal'}
                </button>
                <button
                  type="button"
                  disabled={isRotating}
                  onClick={() => void handleRotateKey()}
                  className="rounded-full bg-[var(--brass)] px-3.5 py-1.5 text-xs font-semibold text-[#1a1405] disabled:opacity-50 cursor-pointer"
                >
                  {isRotating
                    ? locale === 'en'
                      ? 'Rotating...'
                      : 'Memutar...'
                    : locale === 'en'
                      ? 'Confirm Rotate'
                      : 'Konfirmasi Putar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
