import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ExperienceStatus, Locale, UI_COPY } from '../data/cvData';
import { SiteCopyLocale } from '../utils/cvFirestoreApi';
import { EditableText } from './EditableText';
import { ExperienceTimelineSkeleton } from './Skeletons';
import {
  createExperienceInFirestore,
  deleteExperienceFromFirestore,
  FirestoreExperienceItem,
  saveExperienceToFirestore,
  subscribeExperiences,
} from '../utils/experienceApi';

interface ExperienceSectionProps {
  locale: Locale;
  authReady: boolean;
  isAdminUser: boolean;
  siteCopy: SiteCopyLocale;
  invitedItems?: FirestoreExperienceItem[];
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
}

type RoleFilter = 'all' | 'leadership' | 'operations';

export function ExperienceSection({
  locale,
  authReady,
  isAdminUser,
  siteCopy,
  invitedItems,
  onSaveSiteCopyField,
}: ExperienceSectionProps) {
  const [experiences, setExperiences] = useState<FirestoreExperienceItem[]>(invitedItems ?? []);
  const [isLoading, setIsLoading] = useState(!invitedItems);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const prefersReducedMotion = useReducedMotion();

  // Admin Edit / Add modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FirestoreExperienceItem | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState<ExperienceStatus>('active');
  const [category, setCategory] = useState<'leadership' | 'operations'>('leadership');
  const [period, setPeriod] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [scaleContext, setScaleContext] = useState('');
  const [scaleContextId, setScaleContextId] = useState('');
  const [bulletsText, setBulletsText] = useState('');
  const [bulletsIdText, setBulletsIdText] = useState('');
  const [systemsText, setSystemsText] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const t = UI_COPY[locale].sections;

  useEffect(() => {
    if (!isAdminUser && invitedItems) {
      setExperiences(invitedItems);
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    if (!authReady || !isAdminUser) return;
    setIsLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeExperiences(
      (items) => {
        setExperiences(items);
        setIsLoading(false);
      },
      (err) => {
        let message = err.message;
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          if (parsed?.error) message = parsed.error;
        } catch {
          // Keep message
        }
        setLoadError(message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, invitedItems, isAdminUser]);

  const filteredExperiences = experiences.filter((item) =>
    filter === 'all' ? true : item.category === filter
  );

  const toggleDetails = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openAddModal = () => {
    setEditingItem(null);
    setCompany('');
    setRole('');
    setRoleId('');
    setStatus('active');
    setCategory('leadership');
    setPeriod('');
    setPeriodId('');
    setScaleContext('');
    setScaleContextId('');
    setBulletsText('');
    setBulletsIdText('');
    setSystemsText('');
    setSortOrder(0);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: FirestoreExperienceItem) => {
    setEditingItem(item);
    setCompany(item.company);
    setRole(item.role);
    setRoleId(item.roleId);
    setStatus(item.status);
    setCategory(item.category);
    setPeriod(item.period);
    setPeriodId(item.periodId);
    setScaleContext(item.scaleContext);
    setScaleContextId(item.scaleContextId);
    setBulletsText(item.bullets.join('\n'));
    setBulletsIdText(item.bulletsId.join('\n'));
    setSystemsText(item.systems.join(', '));
    setSortOrder(item.sortOrder);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormError(null);
  };

  const handleSaveExperience = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const bullets = bulletsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const bulletsId = bulletsIdText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const systems = systemsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!company.trim() || !role.trim() || !period.trim() || bullets.length === 0) {
      setFormError(
        locale === 'en'
          ? 'Company, Role, Period, and at least one detail bullet are required.'
          : 'Nama perusahaan, jabatan, periode, dan minimal satu keterangan wajib diisi.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        company: company.trim(),
        role: role.trim(),
        roleId: (roleId || role).trim(),
        status,
        category,
        period: period.trim(),
        periodId: (periodId || period).trim(),
        scaleContext: scaleContext.trim(),
        scaleContextId: (scaleContextId || scaleContext).trim(),
        bullets,
        bulletsId: bulletsId.length > 0 ? bulletsId : bullets,
        systems,
        sortOrder: Number(sortOrder) || 0,
      };

      if (editingItem) {
        await saveExperienceToFirestore(
          { id: editingItem.id, ...payload },
          editingItem.fromFirestore
        );
      } else {
        await createExperienceInFirestore(payload);
      }
      closeModal();
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickToggleStatus = async (item: FirestoreExperienceItem) => {
    const nextStatus: ExperienceStatus = item.status === 'active' ? 'completed' : 'active';
    try {
      await saveExperienceToFirestore(
        {
          ...item,
          status: nextStatus,
        },
        item.fromFirestore
      );
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setLoadError(msg);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    try {
      await deleteExperienceFromFirestore(id);
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // Keep msg
      }
      setLoadError(msg);
    }
  };

  return (
    <section
      id="experience"
      data-animate="section"
      className="print-section border-b border-slate-200 bg-slate-50 py-14 print:bg-white print:py-5 dark:border-slate-800 dark:bg-slate-950 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-6 print:px-0">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 print:text-[10px] dark:text-blue-400">
              <EditableText
                value={siteCopy.experienceKicker}
                canEdit={isAdminUser}
                maxLength={80}
                onSave={(val) => onSaveSiteCopyField('experienceKicker', val)}
              />
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 print:mt-0.5 print:text-lg dark:text-white">
              <EditableText
                value={siteCopy.experienceTitle}
                canEdit={isAdminUser}
                maxLength={120}
                onSave={(val) => onSaveSiteCopyField('experienceTitle', val)}
              />
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 print:hidden dark:text-slate-300">
              <EditableText
                value={siteCopy.experienceDesc}
                canEdit={isAdminUser}
                multiline
                maxLength={400}
                onSave={(val) => onSaveSiteCopyField('experienceDesc', val)}
              />
            </p>
          </div>

          <div className="no-print flex flex-wrap items-center gap-3 self-start">
            {isAdminUser && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{locale === 'en' ? 'Add Role' : 'Tambah Pengalaman'}</span>
              </button>
            )}

            {/* Interactive Filter Tabs */}
            <div
              role="tablist"
              aria-label="Filter work experience"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-200/75 p-1 dark:bg-slate-800"
            >
              {(['all', 'leadership', 'operations'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    filter === key
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {t.filters[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
          >
            {loadError}
          </div>
        )}

        {isLoading ? (
          <ExperienceTimelineSkeleton count={3} />
        ) : (
          /* Hairline-separated editorial timeline */
          <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white print:mt-3 print:rounded-lg print:border-slate-300 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            <AnimatePresence initial={false} mode="popLayout">
              {filteredExperiences.map((exp, idx) => {
                const bullets = locale === 'en' ? exp.bullets : exp.bulletsId;
                const isCollapsed = Boolean(collapsedIds[exp.id]);
                const statusText =
                  exp.status === 'active'
                    ? locale === 'en'
                      ? 'Current Role'
                      : 'Aktif Saat Ini'
                    : locale === 'en'
                      ? 'Completed'
                      : 'Selesai';

                return (
                  <motion.article
                    key={exp.id}
                    layout={!prefersReducedMotion}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="print-break-inside-avoid grid grid-cols-1 gap-6 p-6 print:grid-cols-12 print:gap-4 print:p-3.5 md:grid-cols-12 md:gap-8 md:p-8"
                  >
                    {/* Left Meta Column */}
                    <div className="print:col-span-4 md:col-span-4">
                      <p className="font-mono text-xs font-medium text-slate-500 tabular-nums print:text-[10px] dark:text-slate-400">
                        {String(idx + 1).padStart(2, '0')}.{' '}
                        <EditableText
                          value={locale === 'en' ? exp.period : exp.periodId}
                          canEdit={isAdminUser}
                          maxLength={60}
                          onSave={(val) =>
                            saveExperienceToFirestore(
                              {
                                ...exp,
                                ...(locale === 'en' ? { period: val } : { periodId: val }),
                              },
                              exp.fromFirestore
                            )
                          }
                        />
                        <span aria-hidden="true"> · </span>
                        <span
                          className={
                            exp.status === 'active'
                              ? 'font-sans font-semibold text-emerald-700 dark:text-emerald-400'
                              : 'font-sans text-slate-500 dark:text-slate-400'
                          }
                        >
                          {statusText}
                        </span>
                      </p>
                      <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-950 print:mt-1 print:text-sm dark:text-white">
                        <EditableText
                          value={exp.company}
                          canEdit={isAdminUser}
                          maxLength={140}
                          onSave={(val) =>
                            saveExperienceToFirestore({ ...exp, company: val }, exp.fromFirestore)
                          }
                        />
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-blue-700 print:text-xs dark:text-blue-400">
                        <EditableText
                          value={locale === 'en' ? exp.role : exp.roleId}
                          canEdit={isAdminUser}
                          maxLength={140}
                          onSave={(val) =>
                            saveExperienceToFirestore(
                              {
                                ...exp,
                                ...(locale === 'en' ? { role: val } : { roleId: val }),
                              },
                              exp.fromFirestore
                            )
                          }
                        />
                      </p>
                      {(exp.scaleContext || exp.scaleContextId || isAdminUser) && (
                        <p className="mt-3 text-xs text-slate-500 print:mt-1 print:text-[10px] dark:text-slate-400">
                          <EditableText
                            value={
                              (locale === 'en' ? exp.scaleContext : exp.scaleContextId) ||
                              'Add location / property scale'
                            }
                            canEdit={isAdminUser}
                            maxLength={200}
                            onSave={(val) =>
                              saveExperienceToFirestore(
                                {
                                  ...exp,
                                  ...(locale === 'en'
                                    ? { scaleContext: val }
                                    : { scaleContextId: val }),
                                },
                                exp.fromFirestore
                              )
                            }
                          />
                        </p>
                      )}

                      <div className="no-print mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleDetails(exp.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                        >
                          {isCollapsed ? (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{locale === 'en' ? 'Show Details' : 'Lihat Detail'}</span>
                            </>
                          ) : (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{locale === 'en' ? 'Hide Details' : 'Ringkas'}</span>
                            </>
                          )}
                        </button>

                        {isAdminUser && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <button
                              type="button"
                              onClick={() => openEditModal(exp)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                              <span>{locale === 'en' ? 'Edit' : 'Ubah'}</span>
                            </button>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <button
                              type="button"
                              onClick={() => void handleQuickToggleStatus(exp)}
                              className="text-xs font-semibold text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                            >
                              {exp.status === 'active'
                                ? locale === 'en'
                                  ? 'Mark Completed'
                                  : 'Set Selesai'
                                : locale === 'en'
                                  ? 'Mark Active'
                                  : 'Set Aktif'}
                            </button>
                            {exp.fromFirestore && (
                              <>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteExperience(exp.id)}
                                  aria-label={`Delete ${exp.role}`}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 transition-colors hover:text-red-700 dark:text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                                  <span>{locale === 'en' ? 'Delete' : 'Hapus'}</span>
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right Achievements Column */}
                    <div className="print:col-span-8 md:col-span-8">
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.16 }}
                        className={isCollapsed ? 'hidden print:block' : ''}
                      >
                        <ul className="space-y-3 text-sm leading-relaxed text-slate-700 print:space-y-1 print:text-[11px] print:leading-snug dark:text-slate-300">
                          {bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-3 print:gap-2">
                              <span
                                aria-hidden="true"
                                className="mt-2 h-px w-3 shrink-0 bg-slate-400 print:mt-1.5 print:w-2 dark:bg-slate-600"
                              />
                              <EditableText
                                value={bullet}
                                canEdit={isAdminUser}
                                multiline
                                maxLength={500}
                                className="flex-1"
                                onSave={(val) => {
                                  const nextBullets = [...exp.bullets];
                                  const nextBulletsId = [...exp.bulletsId];
                                  if (locale === 'en') nextBullets[bIdx] = val;
                                  else nextBulletsId[bIdx] = val;
                                  return saveExperienceToFirestore(
                                    { ...exp, bullets: nextBullets, bulletsId: nextBulletsId },
                                    exp.fromFirestore
                                  );
                                }}
                              />
                            </li>
                          ))}
                        </ul>

                        {/* Unboxed systems list separated with typographic middle dots */}
                        {exp.systems.length > 0 && (
                          <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500 print:mt-2 print:pt-1.5 print:text-[10px] dark:border-slate-800 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {locale === 'en' ? 'Core Systems:' : 'Sistem Utama:'}
                            </span>{' '}
                            {exp.systems.join(' · ')}
                          </div>
                        )}
                      </motion.div>
                      {isCollapsed && (
                        <p className="text-sm text-slate-500 print:hidden dark:text-slate-400">
                          {bullets[0]}
                        </p>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Admin Edit / Add Work Experience Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exp-modal-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="exp-modal-title"
                  className="font-display text-xl font-bold text-slate-950 dark:text-white"
                >
                  {editingItem
                    ? locale === 'en'
                      ? 'Edit Work Experience & Status'
                      : 'Ubah Pengalaman Kerja & Status'
                    : locale === 'en'
                      ? 'Add Work Experience'
                      : 'Tambah Pengalaman Kerja'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {locale === 'en'
                    ? 'Updates are saved directly to Cloud Firestore and reflected immediately.'
                    : 'Perubahan disimpan langsung ke Cloud Firestore dan langsung tampil di CV.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExperience} className="mt-6 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="exp-company" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Company / Hotel *' : 'Perusahaan / Hotel *'}
                  </label>
                  <input
                    id="exp-company"
                    type="text"
                    required
                    maxLength={140}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="exp-status" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Role Status *' : 'Status Pekerjaan *'}
                  </label>
                  <select
                    id="exp-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ExperienceStatus)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="active">{locale === 'en' ? 'Active / Current Role' : 'Aktif Saat Ini'}</option>
                    <option value="completed">{locale === 'en' ? 'Completed' : 'Selesai'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="exp-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Role Title (EN) *' : 'Jabatan (EN) *'}
                  </label>
                  <input
                    id="exp-role"
                    type="text"
                    required
                    maxLength={140}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="exp-role-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Role Title (ID)' : 'Jabatan (ID)'}
                  </label>
                  <input
                    id="exp-role-id"
                    type="text"
                    maxLength={140}
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="exp-period" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Period (EN) *' : 'Periode (EN) *'}
                  </label>
                  <input
                    id="exp-period"
                    type="text"
                    required
                    maxLength={60}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="Jul 2026 – Present"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="exp-period-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Period (ID)' : 'Periode (ID)'}
                  </label>
                  <input
                    id="exp-period-id"
                    type="text"
                    maxLength={60}
                    value={periodId}
                    onChange={(e) => setPeriodId(e.target.value)}
                    placeholder="Jul 2026 – Sekarang"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="exp-category" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Category' : 'Kategori'}
                  </label>
                  <select
                    id="exp-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'leadership' | 'operations')}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="leadership">{locale === 'en' ? 'Leadership' : 'Kepemimpinan'}</option>
                    <option value="operations">IT Officer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="exp-scale" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Scale / Context (EN)' : 'Konteks / Skala (EN)'}
                  </label>
                  <input
                    id="exp-scale"
                    type="text"
                    maxLength={200}
                    value={scaleContext}
                    onChange={(e) => setScaleContext(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="exp-scale-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Scale / Context (ID)' : 'Konteks / Skala (ID)'}
                  </label>
                  <input
                    id="exp-scale-id"
                    type="text"
                    maxLength={200}
                    value={scaleContextId}
                    onChange={(e) => setScaleContextId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="exp-bullets" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'Role Details / Achievements (EN — 1 per line) *' : 'Keterangan Detail / Pencapaian (EN — 1 per baris) *'}
                </label>
                <textarea
                  id="exp-bullets"
                  rows={4}
                  required
                  value={bulletsText}
                  onChange={(e) => setBulletsText(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="exp-bullets-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en' ? 'Role Details / Achievements (ID — 1 per line)' : 'Keterangan Detail / Pencapaian (ID — 1 per baris)'}
                </label>
                <textarea
                  id="exp-bullets-id"
                  rows={4}
                  value={bulletsIdText}
                  onChange={(e) => setBulletsIdText(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="exp-systems" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Core Systems (comma-separated)' : 'Sistem Utama (pisahkan dengan koma)'}
                  </label>
                  <input
                    id="exp-systems"
                    type="text"
                    value={systemsText}
                    onChange={(e) => setSystemsText(e.target.value)}
                    placeholder="Protel PMS, VMware vSphere, Fortigate"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="exp-order" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Display Order' : 'Urutan Tampil'}
                  </label>
                  <input
                    id="exp-order"
                    type="number"
                    min={0}
                    max={1000}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {locale === 'en' ? 'Cancel' : 'Batal'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
                >
                  {isSaving
                    ? locale === 'en'
                      ? 'Saving...'
                      : 'Menyimpan...'
                    : locale === 'en'
                      ? 'Save to Firestore'
                      : 'Simpan ke Firestore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
