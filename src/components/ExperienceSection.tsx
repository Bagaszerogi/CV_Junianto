import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { CareerStage, ExperienceStatus, Locale, UI_COPY } from '../data/cvData';
import { SiteCopyLocale } from '../utils/cvFirestoreApi';
import { EditableText } from './EditableText';
import { ExperienceTimelineSkeleton } from './Skeletons';
import {
  createExperienceInFirestore,
  deleteExperienceFromFirestore,
  FirestoreExperienceItem,
  normalizeExperienceStages,
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

  // Admin Edit / Add Company modal state
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

  // Career Stage (Promotion / Progression) modal state
  const [stageModalTarget, setStageModalTarget] = useState<{
    exp: FirestoreExperienceItem;
    editingStage?: CareerStage;
  } | null>(null);
  const [stageRole, setStageRole] = useState('');
  const [stageRoleId, setStageRoleId] = useState('');
  const [stagePeriod, setStagePeriod] = useState('');
  const [stagePeriodId, setStagePeriodId] = useState('');
  const [stageStatus, setStageStatus] = useState<ExperienceStatus>('active');
  const [stageBulletsText, setStageBulletsText] = useState('');
  const [stageBulletsIdText, setStageBulletsIdText] = useState('');
  const [markPrevCompleted, setMarkPrevCompleted] = useState(true);
  const [stageError, setStageError] = useState<string | null>(null);
  const [isSavingStage, setIsSavingStage] = useState(false);

  // Inline quick "+ Tambah Keterangan Kerja" composer keyed by `${exp.id}:${stage.id}`
  const [addingBulletKey, setAddingBulletKey] = useState<string | null>(null);
  const [newBulletText, setNewBulletText] = useState('');
  const [isSavingBullet, setIsSavingBullet] = useState(false);

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

  const extractError = (err: unknown): string => {
    let msg = err instanceof Error ? err.message : String(err);
    try {
      const parsed = JSON.parse(msg) as { error?: string };
      if (parsed?.error) msg = parsed.error;
    } catch {
      // Keep raw msg
    }
    return msg;
  };

  const persistStages = async (exp: FirestoreExperienceItem, nextStages: CareerStage[]) => {
    const primary = nextStages[0];
    const hasActive = nextStages.some((s) => s.status === 'active');
    await saveExperienceToFirestore(
      {
        ...exp,
        role: primary.role,
        roleId: primary.roleId,
        status: hasActive ? 'active' : 'completed',
        period: primary.period,
        periodId: primary.periodId,
        bullets: primary.bullets,
        bulletsId: primary.bulletsId,
        careerStages: nextStages,
      },
      exp.fromFirestore
    );
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
    setSortOrder(experiences.length);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: FirestoreExperienceItem) => {
    const stages = normalizeExperienceStages(item);
    const primary = stages[0];
    setEditingItem(item);
    setCompany(item.company);
    setRole(primary.role);
    setRoleId(primary.roleId);
    setStatus(primary.status);
    setCategory(item.category);
    setPeriod(primary.period);
    setPeriodId(primary.periodId);
    setScaleContext(item.scaleContext);
    setScaleContextId(item.scaleContextId);
    setBulletsText(primary.bullets.join('\n'));
    setBulletsIdText(primary.bulletsId.join('\n'));
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
      const existingStages = editingItem ? normalizeExperienceStages(editingItem) : [];
      const firstStage: CareerStage = {
        id: existingStages[0]?.id ?? `stage_${Date.now().toString(36)}`,
        role: role.trim(),
        roleId: (roleId || role).trim(),
        status,
        period: period.trim(),
        periodId: (periodId || period).trim(),
        bullets,
        bulletsId: bulletsId.length > 0 ? bulletsId : bullets,
      };
      const nextStages =
        existingStages.length > 1 ? [firstStage, ...existingStages.slice(1)] : [firstStage];

      const derivedStatus: ExperienceStatus = nextStages.some((s) => s.status === 'active')
        ? 'active'
        : 'completed';

      const payload = {
        company: company.trim(),
        role: firstStage.role,
        roleId: firstStage.roleId,
        status: derivedStatus,
        category,
        period: firstStage.period,
        periodId: firstStage.periodId,
        scaleContext: scaleContext.trim(),
        scaleContextId: (scaleContextId || scaleContext).trim(),
        bullets: firstStage.bullets,
        bulletsId: firstStage.bulletsId,
        systems,
        sortOrder: Number(sortOrder) || 0,
        careerStages: nextStages,
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
      setFormError(extractError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Career progression modal handlers
  const openAddStageModal = (exp: FirestoreExperienceItem) => {
    setStageModalTarget({ exp });
    setStageRole('');
    setStageRoleId('');
    setStagePeriod('');
    setStagePeriodId('');
    setStageStatus('active');
    setStageBulletsText('');
    setStageBulletsIdText('');
    setMarkPrevCompleted(true);
    setStageError(null);
  };

  const openEditStageModal = (exp: FirestoreExperienceItem, stage: CareerStage) => {
    setStageModalTarget({ exp, editingStage: stage });
    setStageRole(stage.role);
    setStageRoleId(stage.roleId);
    setStagePeriod(stage.period);
    setStagePeriodId(stage.periodId);
    setStageStatus(stage.status);
    setStageBulletsText(stage.bullets.join('\n'));
    setStageBulletsIdText(stage.bulletsId.join('\n'));
    setMarkPrevCompleted(false);
    setStageError(null);
  };

  const handleSaveStage = async (e: FormEvent) => {
    e.preventDefault();
    if (!stageModalTarget) return;
    setStageError(null);

    const bullets = stageBulletsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const bulletsId = stageBulletsIdText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!stageRole.trim() || !stagePeriod.trim() || bullets.length === 0) {
      setStageError(
        locale === 'en'
          ? 'Role title, period, and at least one work description bullet are required.'
          : 'Jabatan, periode, dan minimal satu keterangan kerja wajib diisi.'
      );
      return;
    }

    setIsSavingStage(true);
    try {
      const { exp, editingStage } = stageModalTarget;
      const currentStages = normalizeExperienceStages(exp);

      const newOrUpdated: CareerStage = {
        id: editingStage?.id ?? `stage_${Date.now().toString(36)}`,
        role: stageRole.trim(),
        roleId: (stageRoleId || stageRole).trim(),
        status: stageStatus,
        period: stagePeriod.trim(),
        periodId: (stagePeriodId || stagePeriod).trim(),
        bullets,
        bulletsId: bulletsId.length > 0 ? bulletsId : bullets,
      };

      let nextStages: CareerStage[];
      if (editingStage) {
        nextStages = currentStages.map((s) => (s.id === editingStage.id ? newOrUpdated : s));
      } else {
        const previousStages = markPrevCompleted
          ? currentStages.map((s) => ({ ...s, status: 'completed' as ExperienceStatus }))
          : currentStages;
        nextStages = [newOrUpdated, ...previousStages].slice(0, 8);
      }

      await persistStages(exp, nextStages);
      setStageModalTarget(null);
    } catch (err) {
      setStageError(extractError(err));
    } finally {
      setIsSavingStage(false);
    }
  };

  const handleDeleteStage = async (exp: FirestoreExperienceItem, stageId: string) => {
    const stages = normalizeExperienceStages(exp);
    if (stages.length <= 1) return;
    const nextStages = stages.filter((s) => s.id !== stageId);
    try {
      await persistStages(exp, nextStages);
    } catch (err) {
      setLoadError(extractError(err));
    }
  };

  const handleToggleStageStatus = async (exp: FirestoreExperienceItem, stageId: string) => {
    const stages = normalizeExperienceStages(exp);
    const nextStages = stages.map((s) =>
      s.id === stageId
        ? { ...s, status: (s.status === 'active' ? 'completed' : 'active') as ExperienceStatus }
        : s
    );
    try {
      await persistStages(exp, nextStages);
    } catch (err) {
      setLoadError(extractError(err));
    }
  };

  const handleAddInlineBullet = async (
    e: FormEvent,
    exp: FirestoreExperienceItem,
    stageId: string
  ) => {
    e.preventDefault();
    const cleaned = newBulletText.trim().slice(0, 500);
    if (!cleaned) return;
    setIsSavingBullet(true);
    try {
      const stages = normalizeExperienceStages(exp);
      const nextStages = stages.map((s) => {
        if (s.id !== stageId) return s;
        return {
          ...s,
          bullets: [...s.bullets, cleaned].slice(0, 15),
          bulletsId: [...s.bulletsId, cleaned].slice(0, 15),
        };
      });
      await persistStages(exp, nextStages);
      setNewBulletText('');
      setAddingBulletKey(null);
    } catch (err) {
      setLoadError(extractError(err));
    } finally {
      setIsSavingBullet(false);
    }
  };

  const handleRemoveBullet = async (
    exp: FirestoreExperienceItem,
    stageId: string,
    bulletIndex: number
  ) => {
    const stages = normalizeExperienceStages(exp);
    const nextStages = stages.map((s) => {
      if (s.id !== stageId || s.bullets.length <= 1) return s;
      return {
        ...s,
        bullets: s.bullets.filter((_, idx) => idx !== bulletIndex),
        bulletsId: s.bulletsId.filter((_, idx) => idx !== bulletIndex),
      };
    });
    try {
      await persistStages(exp, nextStages);
    } catch (err) {
      setLoadError(extractError(err));
    }
  };

  const handleDeleteExperience = async (id: string) => {
    try {
      await deleteExperienceFromFirestore(id);
    } catch (err) {
      setLoadError(extractError(err));
    }
  };

  return (
    <section
      id="experience"
      data-animate="section"
      className="print-section border-b border-slate-200 bg-slate-50 py-14 print:bg-white print:py-3 dark:border-slate-800 dark:bg-slate-950 md:py-20"
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
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 print:mt-0.5 print:text-base dark:text-white">
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
                <span>{locale === 'en' ? 'Add Company / Role' : 'Tambah Perusahaan / Pengalaman'}</span>
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
          <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white print:mt-2.5 print:rounded-lg print:border-slate-300 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            <AnimatePresence initial={false} mode="popLayout">
              {filteredExperiences.map((exp, idx) => {
                const stages = normalizeExperienceStages(exp);
                const isCollapsed = Boolean(collapsedIds[exp.id]);
                const hasActiveStage = stages.some((s) => s.status === 'active');

                return (
                  <motion.article
                    key={exp.id}
                    layout={!prefersReducedMotion}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="grid grid-cols-1 gap-6 p-6 print:grid-cols-12 print:gap-4 print:p-3 md:grid-cols-12 md:gap-8 md:p-8"
                  >
                    {/* Left Column: LinkedIn-style Company Identity & Controls */}
                    <div className="print:col-span-4 md:col-span-4">
                      <div className="flex items-start gap-3.5 print:gap-2.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 print:h-8 print:w-8 print:rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <Building2 className="h-5 w-5 print:h-4 print:w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] font-medium text-slate-500 tabular-nums print:text-[9.5px] dark:text-slate-400">
                            {String(idx + 1).padStart(2, '0')}
                            {stages.length > 1 && (
                              <>
                                {' · '}
                                <span className="font-sans font-semibold text-blue-700 dark:text-blue-400">
                                  {stages.length}{' '}
                                  {locale === 'en' ? 'Career Stages' : 'Jenjang Karir'}
                                </span>
                              </>
                            )}
                            {' · '}
                            <span
                              className={
                                hasActiveStage
                                  ? 'font-sans font-semibold text-emerald-700 dark:text-emerald-400'
                                  : 'font-sans text-slate-500 dark:text-slate-400'
                              }
                            >
                              {hasActiveStage
                                ? locale === 'en'
                                  ? 'Active'
                                  : 'Aktif'
                                : locale === 'en'
                                  ? 'Completed'
                                  : 'Selesai'}
                            </span>
                          </p>

                          <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-slate-950 print:mt-0.5 print:text-sm dark:text-white">
                            <EditableText
                              value={exp.company}
                              canEdit={isAdminUser}
                              maxLength={140}
                              onSave={(val) =>
                                saveExperienceToFirestore({ ...exp, company: val }, exp.fromFirestore)
                              }
                            />
                          </h3>

                          {(exp.scaleContext || exp.scaleContextId || isAdminUser) && (
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 print:mt-0.5 print:text-[10px] dark:text-slate-400">
                              <EditableText
                                value={
                                  (locale === 'en' ? exp.scaleContext : exp.scaleContextId) ||
                                  (locale === 'en'
                                    ? 'Add location / property scale'
                                    : 'Tambah lokasi / skala properti')
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
                        </div>
                      </div>

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
                              <span>{locale === 'en' ? 'Collapse' : 'Ringkas'}</span>
                            </>
                          )}
                        </button>

                        {isAdminUser && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <button
                              type="button"
                              onClick={() => openEditModal(exp)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                              <span>{locale === 'en' ? 'Edit Company' : 'Ubah Info'}</span>
                            </button>

                            {exp.fromFirestore && (
                              <>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteExperience(exp.id)}
                                  aria-label={`Delete ${exp.company}`}
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

                      {isAdminUser && (
                        <div className="no-print mt-3">
                          <button
                            type="button"
                            onClick={() => openAddStageModal(exp)}
                            disabled={stages.length >= 8}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50 cursor-pointer"
                          >
                            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {locale === 'en'
                                ? '+ Add Career Stage / Promotion'
                                : '+ Tambah Jenjang Karir'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right Column: LinkedIn-style Connected Career Progression Stages */}
                    <div className="print:col-span-8 md:col-span-8">
                      <div className="relative">
                        {stages.map((stage, sIdx) => {
                          const stageBullets = locale === 'en' ? stage.bullets : stage.bulletsId;
                          const isLastStage = sIdx === stages.length - 1;
                          const bulletComposeKey = `${exp.id}:${stage.id}`;
                          const isAddingBulletHere = addingBulletKey === bulletComposeKey;

                          return (
                            <div
                              key={stage.id}
                              className={`print-break-inside-avoid relative pl-7 print:pl-5 ${
                                !isLastStage ? 'pb-7 print:pb-3' : ''
                              }`}
                            >
                              {/* Vertical timeline connector line connecting continuous career progression */}
                              {!isLastStage && (
                                <span
                                  aria-hidden="true"
                                  className="absolute top-3 bottom-0 left-[7px] w-px bg-slate-200 print:left-[5px] print:bg-slate-300 dark:bg-slate-700"
                                />
                              )}

                              {/* Stage milestone dot */}
                              <span
                                aria-hidden="true"
                                className={`absolute top-1.5 left-0 h-3.5 w-3.5 rounded-full border-2 print:h-2.5 print:w-2.5 ${
                                  stage.status === 'active'
                                    ? 'border-emerald-200 bg-emerald-600 dark:border-emerald-900 dark:bg-emerald-400'
                                    : 'border-slate-200 bg-slate-400 dark:border-slate-700 dark:bg-slate-500'
                                }`}
                              />

                              {/* Stage Header: Role Title + Period + Status */}
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-display text-base font-bold text-blue-700 print:text-xs dark:text-blue-400">
                                    <EditableText
                                      value={locale === 'en' ? stage.role : stage.roleId}
                                      canEdit={isAdminUser}
                                      maxLength={140}
                                      onSave={(val) => {
                                        const updated = stages.map((item) =>
                                          item.id === stage.id
                                            ? {
                                                ...item,
                                                ...(locale === 'en'
                                                  ? { role: val }
                                                  : { roleId: val }),
                                              }
                                            : item
                                        );
                                        return persistStages(exp, updated);
                                      }}
                                    />
                                  </h4>

                                  <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums print:text-[10px] dark:text-slate-400">
                                    <EditableText
                                      value={locale === 'en' ? stage.period : stage.periodId}
                                      canEdit={isAdminUser}
                                      maxLength={60}
                                      onSave={(val) => {
                                        const updated = stages.map((item) =>
                                          item.id === stage.id
                                            ? {
                                                ...item,
                                                ...(locale === 'en'
                                                  ? { period: val }
                                                  : { periodId: val }),
                                              }
                                            : item
                                        );
                                        return persistStages(exp, updated);
                                      }}
                                    />
                                    <span aria-hidden="true"> · </span>
                                    <span
                                      className={
                                        stage.status === 'active'
                                          ? 'font-sans font-semibold text-emerald-700 dark:text-emerald-400'
                                          : 'font-sans text-slate-500 dark:text-slate-400'
                                      }
                                    >
                                      {stage.status === 'active'
                                        ? locale === 'en'
                                          ? 'Current Role'
                                          : 'Aktif Saat Ini'
                                        : locale === 'en'
                                          ? 'Completed'
                                          : 'Selesai'}
                                    </span>
                                  </p>
                                </div>

                                {isAdminUser && (
                                  <div className="no-print flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditStageModal(exp, stage)}
                                      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <Pencil className="h-3 w-3" aria-hidden="true" />
                                      <span>{locale === 'en' ? 'Edit' : 'Ubah'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleToggleStageStatus(exp, stage.id)}
                                      className="rounded px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      {stage.status === 'active'
                                        ? locale === 'en'
                                          ? 'Set Completed'
                                          : 'Set Selesai'
                                        : locale === 'en'
                                          ? 'Set Active'
                                          : 'Set Aktif'}
                                    </button>
                                    {stages.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteStage(exp, stage.id)}
                                        aria-label={`Delete role stage ${stage.role}`}
                                        className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 cursor-pointer"
                                      >
                                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Work Description Bullets */}
                              <div className={isCollapsed ? 'hidden print:block' : ''}>
                                <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-700 print:mt-1 print:space-y-1 print:text-[10.5px] print:leading-snug dark:text-slate-300">
                                  {stageBullets.map((bullet, bIdx) => (
                                    <li key={bIdx} className="group/bullet flex items-start gap-2.5 print:gap-2">
                                      <span
                                        aria-hidden="true"
                                        className="mt-2.5 h-px w-2.5 shrink-0 bg-slate-400 print:mt-1.5 print:w-2 dark:bg-slate-600"
                                      />
                                      <EditableText
                                        value={bullet}
                                        canEdit={isAdminUser}
                                        multiline
                                        maxLength={500}
                                        className="flex-1"
                                        onSave={(val) => {
                                          const updated = stages.map((item) => {
                                            if (item.id !== stage.id) return item;
                                            const nextB = [...item.bullets];
                                            const nextBId = [...item.bulletsId];
                                            if (locale === 'en') nextB[bIdx] = val;
                                            else nextBId[bIdx] = val;
                                            return { ...item, bullets: nextB, bulletsId: nextBId };
                                          });
                                          return persistStages(exp, updated);
                                        }}
                                      />
                                      {isAdminUser && stageBullets.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => void handleRemoveBullet(exp, stage.id, bIdx)}
                                          aria-label="Remove bullet"
                                          className="no-print mt-1 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover/bullet:opacity-100 dark:hover:bg-red-950/50 cursor-pointer"
                                        >
                                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                      )}
                                    </li>
                                  ))}
                                </ul>

                                {/* Inline quick "+ Tambah Keterangan Kerja" control for Admin */}
                                {isAdminUser && stageBullets.length < 15 && (
                                  <div className="no-print mt-3">
                                    {isAddingBulletHere ? (
                                      <form
                                        onSubmit={(e) => void handleAddInlineBullet(e, exp, stage.id)}
                                        className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/70 dark:bg-blue-950/30"
                                      >
                                        <textarea
                                          rows={2}
                                          autoFocus
                                          maxLength={500}
                                          value={newBulletText}
                                          onChange={(e) => setNewBulletText(e.target.value)}
                                          placeholder={
                                            locale === 'en'
                                              ? 'Describe additional responsibility or key achievement...'
                                              : 'Tulis tanggung jawab atau pencapaian kerja tambahan...'
                                          }
                                          className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        />
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setAddingBulletKey(null);
                                              setNewBulletText('');
                                            }}
                                            className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
                                          >
                                            {locale === 'en' ? 'Cancel' : 'Batal'}
                                          </button>
                                          <button
                                            type="submit"
                                            disabled={isSavingBullet || !newBulletText.trim()}
                                            className="rounded-md bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 cursor-pointer"
                                          >
                                            {isSavingBullet
                                              ? locale === 'en'
                                                ? 'Saving...'
                                                : 'Menyimpan...'
                                              : locale === 'en'
                                                ? 'Add Detail'
                                                : 'Simpan Keterangan'}
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAddingBulletKey(bulletComposeKey);
                                          setNewBulletText('');
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 cursor-pointer"
                                      >
                                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span>
                                          {locale === 'en'
                                            ? 'Add Work Detail'
                                            : 'Tambah Keterangan Kerja'}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {isCollapsed && (
                                <p className="mt-1.5 text-sm text-slate-500 print:hidden dark:text-slate-400">
                                  {stageBullets[0]}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Core Systems footer for the company */}
                      {(exp.systems.length > 0 || isAdminUser) && (
                        <div className="mt-5 border-t border-slate-100 pt-3.5 text-xs text-slate-500 print:mt-2 print:pt-1.5 print:text-[10px] dark:border-slate-800 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {locale === 'en' ? 'Core Systems:' : 'Sistem Utama:'}
                          </span>{' '}
                          <EditableText
                            value={
                              exp.systems.join(' · ') ||
                              (locale === 'en'
                                ? 'Add systems separated with middot or comma'
                                : 'Tambah daftar sistem (pisahkan koma)')
                            }
                            canEdit={isAdminUser}
                            maxLength={400}
                            onSave={(val) => {
                              const parsed = val
                                .split(/[·,]+/)
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .slice(0, 25);
                              return saveExperienceToFirestore(
                                { ...exp, systems: parsed },
                                exp.fromFirestore
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add / Edit Company Work Experience Modal */}
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
                      ? 'Edit Company & Primary Role'
                      : 'Ubah Perusahaan & Jabatan Utama'
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

      {/* LinkedIn-style Career Progression / Promotion Stage Modal */}
      {stageModalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stage-modal-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                  <Briefcase className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3
                    id="stage-modal-title"
                    className="font-display text-lg font-bold text-slate-950 dark:text-white"
                  >
                    {stageModalTarget.editingStage
                      ? locale === 'en'
                        ? `Edit Stage · ${stageModalTarget.exp.company}`
                        : `Ubah Jenjang Karir · ${stageModalTarget.exp.company}`
                      : locale === 'en'
                        ? `Add Promotion / Career Stage · ${stageModalTarget.exp.company}`
                        : `Tambah Jenjang Karir · ${stageModalTarget.exp.company}`}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {stageModalTarget.editingStage
                      ? locale === 'en'
                        ? 'Update role title, period, or responsibilities within this company timeline.'
                        : 'Perbarui jabatan, periode, atau keterangan kerja pada riwayat perusahaan ini.'
                      : locale === 'en'
                        ? 'Appears directly above your previous role in a connected timeline for the same company.'
                        : 'Akan tampil bersambung tepat di atas jabatan sebelumnya dalam timeline perusahaan yang sama.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStageModalTarget(null)}
                aria-label="Close stage modal"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStage} className="mt-5 space-y-4">
              {stageError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {stageError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="stage-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'New Role Title (EN) *' : 'Jabatan Baru (EN) *'}
                  </label>
                  <input
                    id="stage-role"
                    type="text"
                    required
                    maxLength={140}
                    value={stageRole}
                    onChange={(e) => setStageRole(e.target.value)}
                    placeholder="Information Technology Manager"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="stage-role-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Role Title (ID)' : 'Jabatan Baru (ID)'}
                  </label>
                  <input
                    id="stage-role-id"
                    type="text"
                    maxLength={140}
                    value={stageRoleId}
                    onChange={(e) => setStageRoleId(e.target.value)}
                    placeholder="Information Technology Manager"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="stage-period" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Period (EN) *' : 'Periode (EN) *'}
                  </label>
                  <input
                    id="stage-period"
                    type="text"
                    required
                    maxLength={60}
                    value={stagePeriod}
                    onChange={(e) => setStagePeriod(e.target.value)}
                    placeholder="Dec 2026 – Present"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="stage-period-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Period (ID)' : 'Periode (ID)'}
                  </label>
                  <input
                    id="stage-period-id"
                    type="text"
                    maxLength={60}
                    value={stagePeriodId}
                    onChange={(e) => setStagePeriodId(e.target.value)}
                    placeholder="Des 2026 – Sekarang"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="stage-status" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {locale === 'en' ? 'Status' : 'Status'}
                  </label>
                  <select
                    id="stage-status"
                    value={stageStatus}
                    onChange={(e) => setStageStatus(e.target.value as ExperienceStatus)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="active">{locale === 'en' ? 'Active / Current' : 'Aktif Saat Ini'}</option>
                    <option value="completed">{locale === 'en' ? 'Completed' : 'Selesai'}</option>
                  </select>
                </div>
              </div>

              {!stageModalTarget.editingStage && (
                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markPrevCompleted}
                    onChange={(e) => setMarkPrevCompleted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  <span>
                    {locale === 'en'
                      ? 'Automatically mark the previous active role in this company as Completed'
                      : 'Otomatis ubah status jabatan aktif sebelumnya di perusahaan ini menjadi Selesai'}
                  </span>
                </label>
              )}

              <div>
                <label htmlFor="stage-bullets" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en'
                    ? 'Work Details / Key Achievements (EN — 1 per line) *'
                    : 'Keterangan Kerja / Pencapaian Utama (EN — 1 per baris) *'}
                </label>
                <textarea
                  id="stage-bullets"
                  rows={4}
                  required
                  value={stageBulletsText}
                  onChange={(e) => setStageBulletsText(e.target.value)}
                  placeholder={
                    locale === 'en'
                      ? 'Lead IT department strategy, annual CAPEX/OPEX budgeting, and audit readiness...'
                      : 'Memimpin strategi departemen IT, anggaran CAPEX/OPEX tahunan, dan audit sistem...'
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="stage-bullets-id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {locale === 'en'
                    ? 'Work Details / Key Achievements (ID — 1 per line)'
                    : 'Keterangan Kerja / Pencapaian Utama (ID — 1 per baris)'}
                </label>
                <textarea
                  id="stage-bullets-id"
                  rows={3}
                  value={stageBulletsIdText}
                  onChange={(e) => setStageBulletsIdText(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStageModalTarget(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {locale === 'en' ? 'Cancel' : 'Batal'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingStage}
                  className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
                >
                  {isSavingStage
                    ? locale === 'en'
                      ? 'Saving...'
                      : 'Menyimpan...'
                    : locale === 'en'
                      ? 'Save Career Stage'
                      : 'Simpan Jenjang Karir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
