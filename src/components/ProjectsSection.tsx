import { useEffect, useRef, useState, DragEvent, ChangeEvent, FormEvent, MouseEvent } from 'react';
import {
  Plus,
  Upload,
  X,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Lock,
  Calendar,
} from 'lucide-react';
import { Locale } from '../data/cvData';
import { SiteCopyLocale } from '../utils/cvFirestoreApi';
import { EditableText } from './EditableText';
import { ProjectGridSkeleton } from './Skeletons';
import {
  ProjectCategory,
  ProjectPhotoItem,
  compressImageFile,
  createFirestoreProject,
  deleteFirestoreProject,
  subscribeProjects,
  updateFirestoreProject,
} from '../utils/projectApi';
import { sanitizeProjectImageSrc } from '../utils/safeUrls';
import { formatReadableFirestoreError } from '../firebase';

interface ProjectsSectionProps {
  locale: Locale;
  authReady: boolean;
  isAdminUser: boolean;
  siteCopy: SiteCopyLocale;
  invitedProjects?: ProjectPhotoItem[];
  onSaveSiteCopyField: (field: keyof SiteCopyLocale, value: string) => Promise<void>;
  onOpenAuth: () => void;
}

type CategoryFilter = 'all' | ProjectCategory;

const CATEGORY_LABELS: Record<ProjectCategory, { en: string; id: string }> = {
  infrastructure: { en: 'Infrastructure & Wi-Fi', id: 'Infrastruktur & Wi-Fi' },
  'pms-pos': { en: 'PMS & POS Systems', id: 'Sistem PMS & POS' },
  security: { en: 'Security & CCTV', id: 'Keamanan & CCTV' },
  'event-av': { en: 'Ballroom & Guest Tech', id: 'Ballroom & Teknologi Tamu' },
};

export function ProjectsSection({
  locale,
  authReady,
  isAdminUser,
  siteCopy,
  invitedProjects,
  onSaveSiteCopyField,
  onOpenAuth,
}: ProjectsSectionProps) {
  const [projects, setProjects] = useState<ProjectPhotoItem[]>(invitedProjects ?? []);
  const [isLoading, setIsLoading] = useState(!invitedProjects);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>('all');

  // Upload / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [property, setProperty] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [category, setCategory] = useState<ProjectCategory>('infrastructure');
  const [description, setDescription] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Lightbox modal state
  const [activeLightboxId, setActiveLightboxId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCardMouseMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  useEffect(() => {
    if (!isAdminUser && invitedProjects) {
      setProjects(invitedProjects);
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    if (!authReady || !isAdminUser) return;
    setIsLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeProjects(
      (items) => {
        setProjects(items);
        setIsLoading(false);
      },
      (err) => {
        setLoadError(formatReadableFirestoreError(err));
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, invitedProjects, isAdminUser]);

  const filteredProjects = projects.filter((item) =>
    filter === 'all' ? true : item.category === filter
  );

  const activeLightboxIndex = filteredProjects.findIndex((p) => p.id === activeLightboxId);
  const activeLightboxItem = activeLightboxIndex >= 0 ? filteredProjects[activeLightboxIndex] : null;

  useEffect(() => {
    if (!activeLightboxId && !isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeLightboxId) setActiveLightboxId(null);
        else if (isModalOpen) closeModal();
      } else if (activeLightboxId && filteredProjects.length > 1) {
        if (e.key === 'ArrowRight') {
          const next = (activeLightboxIndex + 1) % filteredProjects.length;
          setActiveLightboxId(filteredProjects[next].id);
        } else if (e.key === 'ArrowLeft') {
          const prev = (activeLightboxIndex - 1 + filteredProjects.length) % filteredProjects.length;
          setActiveLightboxId(filteredProjects[prev].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxId, activeLightboxIndex, filteredProjects, isModalOpen]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setProperty('');
    setYear(String(new Date().getFullYear()));
    setCategory('infrastructure');
    setDescription('');
    setImageDataUrl('');
    setShowOptionalDetails(false);
    setFormError(null);
    setIsProcessingImage(false);
    setIsSaving(false);
  };

  const openNewUploadModal = () => {
    if (!isAdminUser) {
      onOpenAuth();
      return;
    }
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item: ProjectPhotoItem) => {
    if (!isAdminUser) {
      onOpenAuth();
      return;
    }
    setEditingId(item.id);
    setTitle(item.title);
    setProperty(item.property);
    setYear(item.year);
    setCategory(item.category);
    setDescription(item.description);
    setImageDataUrl(item.imageDataUrl);
    setShowOptionalDetails(Boolean(item.property || item.description));
    setFormError(null);
    setActiveLightboxId(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSelectedFile = async (file: File) => {
    setFormError(null);
    setIsProcessingImage(true);
    try {
      const compressed = await compressImageFile(file);
      setImageDataUrl(compressed);
      if (!title.trim()) {
        const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        setTitle(cleanName);
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Could not process the selected image.'
            : 'Gagal memproses gambar yang dipilih.'
      );
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleModalDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleSelectedFile(file);
    }
  };

  const persistProject = async (addAnotherAfter: boolean) => {
    setFormError(null);

    if (!isAdminUser) {
      setFormError(locale === 'en' ? 'Admin login required.' : 'Login admin diperlukan.');
      return;
    }

    if (!imageDataUrl) {
      setFormError(
        locale === 'en'
          ? 'Please upload a project photo first.'
          : 'Silakan unggah foto proyek terlebih dahulu.'
      );
      return;
    }

    if (!title.trim()) {
      setFormError(
        locale === 'en'
          ? 'Project name is required.'
          : 'Nama proyek wajib diisi.'
      );
      return;
    }

    if (!year.trim()) {
      setFormError(
        locale === 'en'
          ? 'Project year is required.'
          : 'Tahun proyek wajib diisi.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        property: property.trim(),
        year: year.trim(),
        category,
        description: description.trim(),
        imageDataUrl,
      };

      if (editingId) {
        await updateFirestoreProject(editingId, payload);
      } else {
        await createFirestoreProject(payload);
      }

      if (addAnotherAfter && !editingId) {
        resetForm();
      } else {
        closeModal();
      }
    } catch (err) {
      setFormError(formatReadableFirestoreError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    await persistProject(false);
  };

  const handleInlineUpdateProject = async (
    project: ProjectPhotoItem,
    patch: Partial<Pick<ProjectPhotoItem, 'title' | 'year' | 'property' | 'description'>>
  ) => {
    await updateFirestoreProject(project.id, {
      title: patch.title ?? project.title,
      property: patch.property ?? project.property,
      year: patch.year ?? project.year,
      category: project.category,
      description: patch.description ?? project.description,
      imageDataUrl: project.imageDataUrl,
    });
  };

  const handleDeleteProject = async (id: string) => {
    if (!isAdminUser) {
      onOpenAuth();
      return;
    }

    try {
      await deleteFirestoreProject(id);
      if (activeLightboxId === id) {
        setActiveLightboxId(null);
      }
    } catch (err) {
      setLoadError(formatReadableFirestoreError(err));
    }
  };

  const filterKeys: CategoryFilter[] = ['all', 'infrastructure', 'pms-pos', 'security', 'event-av'];
  const showCategoryFilters = projects.some(
    (p) => Boolean(p.property) || Boolean(p.description) || p.category !== 'infrastructure'
  );

  if (!isAdminUser && !isLoading && projects.length === 0) {
    return null;
  }

  return (
    <section
      id="projects"
      data-animate="section"
      className={`print-section border-b border-[var(--line)] bg-[var(--bg)] py-16 print:bg-white print:py-5 md:py-24 ${
        projects.length === 0 ? 'print:hidden' : ''
      }`}
    >
      <div className="mx-auto max-w-[1120px] px-[clamp(20px,5vw,48px)] print:px-0">
        {/* Section Header + Upload Toolbar */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--brass)] print:text-[10px]">
              <span className="inline-block h-px w-[22px] bg-[var(--brass)] print:hidden" aria-hidden="true" />
              <EditableText
                value={siteCopy.projectsKicker}
                canEdit={isAdminUser}
                maxLength={80}
                onSave={(val) => onSaveSiteCopyField('projectsKicker', val)}
              />
            </p>
            <h2 className="mt-2.5 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-bold tracking-tight text-[var(--ink)] print:mt-0.5 print:text-lg">
              <EditableText
                value={siteCopy.projectsTitle}
                canEdit={isAdminUser}
                maxLength={120}
                onSave={(val) => onSaveSiteCopyField('projectsTitle', val)}
              />
            </h2>
            <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-[var(--mute)] print:hidden">
              <EditableText
                value={siteCopy.projectsDesc}
                canEdit={isAdminUser}
                multiline
                maxLength={400}
                onSave={(val) => onSaveSiteCopyField('projectsDesc', val)}
              />
            </p>
          </div>

          {isAdminUser && (
            <div className="no-print flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={openNewUploadModal}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2.5 text-xs font-semibold text-[#1a1405] transition-transform duration-200 hover:-translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{locale === 'en' ? 'Add Project' : 'Tambah Proyek'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Category Filter Tabs */}
        {projects.length > 0 && showCategoryFilters && (
          <div className="no-print mt-8 flex flex-wrap items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Filter projects by category"
              className="flex flex-wrap items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg2)] p-1"
            >
              {filterKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    filter === key
                      ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                      : 'text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  {key === 'all'
                    ? locale === 'en'
                      ? 'All Projects'
                      : 'Semua Proyek'
                    : CATEGORY_LABELS[key][locale]}
                </button>
              ))}
            </div>

            <p className="font-mono text-xs text-[var(--mute)] tabular-nums">
              {filteredProjects.length} {locale === 'en' ? 'projects' : 'proyek'}
            </p>
          </div>
        )}

        {/* Error banner */}
        {loadError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-300/60 bg-red-50/90 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
          >
            {loadError}
          </div>
        )}

        {/* Skeleton Loading State */}
        {isLoading ? (
          <ProjectGridSkeleton count={3} />
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="no-print mt-10 flex flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--line)] bg-[var(--bg2)]/70 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--brass)]">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-[var(--ink)]">
              {locale === 'en'
                ? 'No project photos published yet'
                : 'Belum ada proyek yang ditambahkan'}
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-[var(--mute)]">
              {isAdminUser
                ? locale === 'en'
                  ? 'Add a project with Name, Photo, and Year. New entries keep appending cleanly downward.'
                  : 'Tambahkan proyek dengan Nama Proyek, Foto, dan Tahun. Proyek baru akan terus tersusun ke bawah.'
                : locale === 'en'
                  ? 'Sign in with your admin account from the top-right corner to add and manage projects.'
                  : 'Masuk dengan akun admin dari pojok kanan atas untuk menambahkan dan mengelola proyek.'}
            </p>
            <div className="no-print mt-6">
              {isAdminUser ? (
                <button
                  type="button"
                  onClick={openNewUploadModal}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-[#1a1405] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {locale === 'en' ? 'Add First Project' : 'Tambah Proyek Pertama'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brass)] cursor-pointer"
                >
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {locale === 'en' ? 'Admin Login to Add' : 'Login Admin untuk Tambah'}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="mt-10 rounded-[22px] border border-[var(--line)] bg-[var(--bg2)]/70 px-6 py-12 text-center">
            <p className="text-sm font-medium text-[var(--mute)]">
              {locale === 'en'
                ? 'No projects found in this category.'
                : 'Belum ada proyek pada kategori ini.'}
            </p>
          </div>
        ) : (
          /* Project Gallery Grid growing downward */
          <div className="mt-8 grid grid-cols-1 gap-6 print:mt-3 print:grid-cols-2 print:gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <article
                key={project.id}
                onMouseMove={handleCardMouseMove}
                className="editorial-card print-break-inside-avoid group flex flex-col bg-[var(--bg2)]/65 print:rounded-lg print:border-slate-300"
              >
                <div className="relative z-10 aspect-4/3 w-full overflow-hidden bg-[var(--bg2)] print:aspect-16/9">
                  <button
                    type="button"
                    onClick={() => setActiveLightboxId(project.id)}
                    aria-label={`View ${project.title}`}
                    className="h-full w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)] cursor-pointer"
                  >
                    {!brokenImages[project.id] && sanitizeProjectImageSrc(project.imageDataUrl) ? (
                      <img
                        src={sanitizeProjectImageSrc(project.imageDataUrl)}
                        alt={`${project.title} (${project.year})`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [project.id]: true }))
                        }
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--bg2)] p-4 text-center text-[var(--mute)]">
                        <ImageIcon className="h-8 w-8 text-[var(--brass)]/70" aria-hidden="true" />
                        <span className="mt-2 text-xs font-medium">{project.title}</span>
                      </div>
                    )}
                  </button>

                  {/* Year Badge */}
                  <span className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-[#0a1024]/85 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#e0b873] tabular-nums backdrop-blur-xs print:bg-white print:text-slate-900">
                    <Calendar className="h-3 w-3 opacity-85" aria-hidden="true" />
                    <span>{project.year}</span>
                  </span>
                </div>

                <div className="relative z-10 flex flex-1 flex-col justify-between p-5 print:p-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--mute)] print:text-[10px]">
                      <EditableText
                        value={project.year}
                        canEdit={isAdminUser}
                        maxLength={24}
                        className="font-mono font-semibold text-[var(--brass)] tabular-nums"
                        onSave={(val) => handleInlineUpdateProject(project, { year: val })}
                      />
                      {project.property && (
                        <>
                          <span aria-hidden="true">·</span>
                          <EditableText
                            value={project.property}
                            canEdit={isAdminUser}
                            maxLength={140}
                            onSave={(val) => handleInlineUpdateProject(project, { property: val })}
                          />
                        </>
                      )}
                    </div>

                    <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-[var(--ink)] print:mt-0.5 print:text-xs">
                      {isAdminUser ? (
                        <EditableText
                          value={project.title}
                          canEdit={isAdminUser}
                          maxLength={140}
                          onSave={(val) => handleInlineUpdateProject(project, { title: val })}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveLightboxId(project.id)}
                          className="text-left hover:text-[var(--brass)] cursor-pointer"
                        >
                          {project.title}
                        </button>
                      )}
                    </h3>

                    {project.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--mute)] print:mt-1 print:line-clamp-none print:text-[11px] print:leading-snug">
                        <EditableText
                          value={project.description}
                          canEdit={isAdminUser}
                          multiline
                          maxLength={1200}
                          onSave={(val) => handleInlineUpdateProject(project, { description: val })}
                        />
                      </p>
                    )}
                  </div>

                  {isAdminUser && (
                    <div className="no-print mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
                      <button
                        type="button"
                        onClick={() => setActiveLightboxId(project.id)}
                        className="text-xs font-medium text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                      >
                        {locale === 'en' ? 'Preview' : 'Lihat Foto'}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(project)}
                          aria-label={`Edit ${project.title}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--mute)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{locale === 'en' ? 'Edit' : 'Ubah'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProject(project.id)}
                          aria-label={`Delete ${project.title}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{locale === 'en' ? 'Delete' : 'Hapus'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Continuous Add Project Downward Action Bar (visible whenever admin is logged in) */}
        {isAdminUser && !isLoading && projects.length > 0 && (
          <div className="no-print mt-8">
            <button
              type="button"
              onClick={openNewUploadModal}
              className="flex w-full items-center justify-center gap-2.5 rounded-[22px] border-2 border-dashed border-[var(--line)] bg-[var(--bg2)]/60 px-6 py-5 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] cursor-pointer"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span>
                {locale === 'en'
                  ? 'Add Another Project (Name, Photo & Year)'
                  : 'Tambah Proyek Lagi ke Bawah (Nama Proyek, Foto & Tahun)'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Upload / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#060a18]/75 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[22px] border border-[var(--line)] bg-[var(--bg)] p-6 shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="project-modal-title"
                  className="font-display text-xl font-bold text-[var(--ink)]"
                >
                  {editingId
                    ? locale === 'en'
                      ? 'Edit Project'
                      : 'Ubah Proyek'
                    : locale === 'en'
                      ? 'Add New Project'
                      : 'Tambah Proyek Baru'}
                </h3>
                <p className="mt-1 text-xs text-[var(--mute)]">
                  {locale === 'en'
                    ? 'Enter project name, upload photo, and specify the year. Automatically saved to Firestore.'
                    : 'Isi nama proyek, unggah foto, dan tahun. Otomatis tersimpan ke Cloud Firestore.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                className="rounded-lg p-2 text-[var(--mute)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="mt-6 space-y-4">
              {/* Drag & Drop Image Picker */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleModalDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
                  isDragging
                    ? 'border-[var(--brass)] bg-[var(--brass)]/10'
                    : 'border-[var(--line)] bg-[var(--bg2)] hover:border-[var(--brass)]/60'
                } ${imageDataUrl ? 'aspect-16/10' : 'px-6 py-8'}`}
              >
                {isProcessingImage ? (
                  <p className="text-sm font-medium text-[var(--mute)]">
                    {locale === 'en' ? 'Optimizing image...' : 'Mengoptimalkan foto...'}
                  </p>
                ) : imageDataUrl ? (
                  <>
                    <img
                      src={imageDataUrl}
                      alt="Project preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 py-3 text-xs font-medium text-white">
                      {locale === 'en'
                        ? 'Click or drop a new photo to replace'
                        : 'Klik atau seret foto baru untuk mengganti'}
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-6 w-6 text-[var(--brass)]" aria-hidden="true" />
                    <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
                      {locale === 'en'
                        ? 'Upload Project Photo *'
                        : 'Unggah Foto Proyek *'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--mute)]">
                      JPG, PNG, WebP (Max 15 MB)
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-300/60 bg-red-50/90 px-3.5 py-2.5 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="proj-title"
                    className="block text-xs font-semibold text-[var(--ink)]"
                  >
                    {locale === 'en' ? 'Project Name *' : 'Nama Proyek *'}
                  </label>
                  <input
                    id="proj-title"
                    type="text"
                    required
                    maxLength={140}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      locale === 'en'
                        ? 'e.g. UniFi & Ruijie 345+ AP Rollout'
                        : 'mis. Implementasi 345+ AP UniFi & Ruijie'
                    }
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--mute)] focus:border-[var(--brass)] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="proj-year"
                    className="block text-xs font-semibold text-[var(--ink)]"
                  >
                    {locale === 'en' ? 'Year *' : 'Tahun *'}
                  </label>
                  <input
                    id="proj-year"
                    type="text"
                    required
                    maxLength={24}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2024"
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3.5 py-2.5 font-mono text-sm text-[var(--ink)] tabular-nums focus:border-[var(--brass)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowOptionalDetails((prev) => !prev)}
                  className="text-xs font-semibold text-[var(--brass)] hover:underline cursor-pointer"
                >
                  {showOptionalDetails
                    ? locale === 'en'
                      ? 'Hide optional details (Location, Category, Summary)'
                      : 'Sembunyikan detail opsional (Lokasi, Kategori, Ringkasan)'
                    : locale === 'en'
                      ? '+ Add optional details (Location, Category, Summary)'
                      : '+ Tambah detail opsional (Lokasi, Kategori, Ringkasan)'}
                </button>
              </div>

              {showOptionalDetails && (
                <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--bg2)]/70 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="proj-property"
                        className="block text-xs font-semibold text-[var(--ink)]"
                      >
                        {locale === 'en' ? 'Hotel / Location (Optional)' : 'Hotel / Lokasi (Opsional)'}
                      </label>
                      <input
                        id="proj-property"
                        type="text"
                        maxLength={140}
                        value={property}
                        onChange={(e) => setProperty(e.target.value)}
                        placeholder="Hotel Ciputra Jakarta"
                        className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--mute)] focus:border-[var(--brass)] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="proj-category"
                        className="block text-xs font-semibold text-[var(--ink)]"
                      >
                        {locale === 'en' ? 'Category' : 'Kategori'}
                      </label>
                      <select
                        id="proj-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as ProjectCategory)}
                        className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
                      >
                        {(Object.keys(CATEGORY_LABELS) as ProjectCategory[]).map((catKey) => (
                          <option key={catKey} value={catKey}>
                            {CATEGORY_LABELS[catKey][locale]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="proj-desc"
                      className="block text-xs font-semibold text-[var(--ink)]"
                    >
                      {locale === 'en' ? 'Summary (Optional)' : 'Ringkasan Singkat (Opsional)'}
                    </label>
                    <textarea
                      id="proj-desc"
                      rows={2}
                      maxLength={1200}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        locale === 'en'
                          ? 'Describe scope, systems deployed, and outcome...'
                          : 'Jelaskan cakupan proyek dan sistem yang diimplementasikan...'
                      }
                      className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--mute)] focus:border-[var(--brass)] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--line)] pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-[var(--line)] bg-[var(--bg2)] px-4 py-2 text-sm font-semibold text-[var(--ink)] cursor-pointer"
                >
                  {locale === 'en' ? 'Cancel' : 'Batal'}
                </button>
                {!editingId && (
                  <button
                    type="button"
                    disabled={isSaving || isProcessingImage}
                    onClick={() => void persistProject(true)}
                    className="rounded-full border border-[var(--brass)]/50 bg-[var(--brass)]/12 px-4 py-2 text-sm font-semibold text-[var(--brass)] transition-colors hover:bg-[var(--brass)]/20 disabled:opacity-50 cursor-pointer"
                  >
                    {locale === 'en' ? 'Save & Add Another' : 'Simpan & Tambah Lagi'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving || isProcessingImage}
                  className="rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[#1a1405] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving
                    ? locale === 'en'
                      ? 'Saving...'
                      : 'Menyimpan...'
                    : editingId
                      ? locale === 'en'
                        ? 'Save Changes'
                        : 'Simpan Perubahan'
                      : locale === 'en'
                        ? 'Save Project'
                        : 'Simpan Proyek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {activeLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeLightboxItem.title}
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#060a18]/92 p-4 backdrop-blur-sm md:p-8"
        >
          <button
            type="button"
            onClick={() => setActiveLightboxId(null)}
            aria-label="Close lightbox"
            className="absolute top-5 right-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brass)] text-[#1a1405] transition-transform hover:scale-105 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          {filteredProjects.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  const prev =
                    (activeLightboxIndex - 1 + filteredProjects.length) % filteredProjects.length;
                  setActiveLightboxId(filteredProjects[prev].id);
                }}
                aria-label="Previous project"
                className="absolute left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 md:inline-flex cursor-pointer"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = (activeLightboxIndex + 1) % filteredProjects.length;
                  setActiveLightboxId(filteredProjects[next].id);
                }}
                aria-label="Next project"
                className="absolute right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 md:inline-flex cursor-pointer"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] border border-white/15 bg-[#101a38]">
            <div className="flex max-h-[65vh] items-center justify-center bg-[#060a18]">
              <img
                src={sanitizeProjectImageSrc(activeLightboxItem.imageDataUrl)}
                alt={activeLightboxItem.title}
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="flex flex-col gap-3 p-6 text-[#eaf0ff] sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium text-[#e0b873]">
                  <span className="font-mono tabular-nums">{activeLightboxItem.year}</span>
                  {activeLightboxItem.property && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{activeLightboxItem.property}</span>
                    </>
                  )}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold text-white">
                  {activeLightboxItem.title}
                </h3>
                {activeLightboxItem.description && (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9aa8cc]">
                    {activeLightboxItem.description}
                  </p>
                )}
              </div>

              {isAdminUser && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(activeLightboxItem)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-[#eaf0ff] hover:bg-white/10 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Edit' : 'Ubah'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteProject(activeLightboxItem.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-900/60 bg-red-950/60 px-3.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900/70 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Delete' : 'Hapus'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
