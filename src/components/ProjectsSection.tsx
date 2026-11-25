import { useEffect, useRef, useState, DragEvent, ChangeEvent, FormEvent } from 'react';
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
      className={`print-section border-b border-slate-200 bg-white py-14 print:bg-white print:py-5 dark:border-slate-800 dark:bg-slate-900 md:py-20 ${
        projects.length === 0 ? 'print:hidden' : ''
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 print:px-0">
        {/* Section Header + Upload Toolbar */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 print:text-[10px] dark:text-blue-400">
              <EditableText
                value={siteCopy.projectsKicker}
                canEdit={isAdminUser}
                maxLength={80}
                onSave={(val) => onSaveSiteCopyField('projectsKicker', val)}
              />
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 print:mt-0.5 print:text-lg dark:text-white">
              <EditableText
                value={siteCopy.projectsTitle}
                canEdit={isAdminUser}
                maxLength={120}
                onSave={(val) => onSaveSiteCopyField('projectsTitle', val)}
              />
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 print:hidden dark:text-slate-300">
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
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
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
              className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
            >
              {filterKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    filter === key
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
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

            <p className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
              {filteredProjects.length} {locale === 'en' ? 'projects' : 'proyek'}
            </p>
          </div>
        )}

        {/* Error banner */}
        {loadError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
          >
            {loadError}
          </div>
        )}

        {/* Skeleton Loading State */}
        {isLoading ? (
          <ProjectGridSkeleton count={3} />
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="no-print mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-950">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-slate-950 dark:text-white">
              {locale === 'en'
                ? 'No project photos published yet'
                : 'Belum ada proyek yang ditambahkan'}
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-slate-600 dark:text-slate-400">
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
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
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
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
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
          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                className="print-break-inside-avoid group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow duration-150 hover:shadow-md print:rounded-lg print:border-slate-300 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-100 print:aspect-16/9 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveLightboxId(project.id)}
                    aria-label={`View ${project.title}`}
                    className="h-full w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 cursor-pointer"
                  >
                    {!brokenImages[project.id] && sanitizeProjectImageSrc(project.imageDataUrl) ? (
                      <img
                        src={sanitizeProjectImageSrc(project.imageDataUrl)}
                        alt={`${project.title} (${project.year})`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [project.id]: true }))
                        }
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 p-4 text-center text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <ImageIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                        <span className="mt-2 text-xs font-medium">{project.title}</span>
                      </div>
                    )}
                  </button>

                  {/* Year Badge */}
                  <span className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2.5 py-1 font-mono text-xs font-semibold text-white tabular-nums backdrop-blur-xs print:bg-white print:text-slate-900">
                    <Calendar className="h-3 w-3 opacity-80" aria-hidden="true" />
                    <span>{project.year}</span>
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5 print:p-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 print:text-[10px] dark:text-slate-400">
                      <EditableText
                        value={project.year}
                        canEdit={isAdminUser}
                        maxLength={24}
                        className="font-mono font-semibold text-blue-700 tabular-nums dark:text-blue-400"
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

                    <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-slate-950 print:mt-0.5 print:text-xs dark:text-white">
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
                          className="text-left hover:text-blue-700 dark:hover:text-blue-400 cursor-pointer"
                        >
                          {project.title}
                        </button>
                      )}
                    </h3>

                    {project.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 print:mt-1 print:line-clamp-none print:text-[11px] print:leading-snug dark:text-slate-300">
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
                    <div className="no-print mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setActiveLightboxId(project.id)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                      >
                        {locale === 'en' ? 'Preview' : 'Lihat Foto'}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(project)}
                          aria-label={`Edit ${project.title}`}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{locale === 'en' ? 'Edit' : 'Ubah'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProject(project.id)}
                          aria-label={`Delete ${project.title}`}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60 cursor-pointer"
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
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/75 px-6 py-5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-500 hover:bg-blue-50/50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/30 dark:hover:text-blue-400 cursor-pointer"
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
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="project-modal-title"
                  className="font-display text-xl font-bold text-slate-950 dark:text-white"
                >
                  {editingId
                    ? locale === 'en'
                      ? 'Edit Project'
                      : 'Ubah Proyek'
                    : locale === 'en'
                      ? 'Add New Project'
                      : 'Tambah Proyek Baru'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {locale === 'en'
                    ? 'Enter project name, upload photo, and specify the year. Automatically saved to Firestore.'
                    : 'Isi nama proyek, unggah foto, dan tahun. Otomatis tersimpan ke Cloud Firestore.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
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
                className={`relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                } ${imageDataUrl ? 'aspect-16/10' : 'px-6 py-8'}`}
              >
                {isProcessingImage ? (
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
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
                    <Upload className="mx-auto h-6 w-6 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                    <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {locale === 'en'
                        ? 'Upload Project Photo *'
                        : 'Unggah Foto Proyek *'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="proj-title"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="proj-year"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowOptionalDetails((prev) => !prev)}
                  className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400 cursor-pointer"
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
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="proj-property"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="proj-category"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {locale === 'en' ? 'Category' : 'Kategori'}
                      </label>
                      <select
                        id="proj-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as ProjectCategory)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
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
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  {locale === 'en' ? 'Cancel' : 'Batal'}
                </button>
                {!editingId && (
                  <button
                    type="button"
                    disabled={isSaving || isProcessingImage}
                    onClick={() => void persistProject(true)}
                    className="rounded-lg border border-blue-700 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300 cursor-pointer"
                  >
                    {locale === 'en' ? 'Save & Add Another' : 'Simpan & Tambah Lagi'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving || isProcessingImage}
                  className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
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
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-4 md:p-8"
        >
          <button
            type="button"
            onClick={() => setActiveLightboxId(null)}
            aria-label="Close lightbox"
            className="absolute top-5 right-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 transition-colors hover:bg-slate-200 cursor-pointer"
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
                className="absolute left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 md:inline-flex cursor-pointer"
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
                className="absolute right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 md:inline-flex cursor-pointer"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-900">
            <div className="flex max-h-[65vh] items-center justify-center bg-black">
              <img
                src={sanitizeProjectImageSrc(activeLightboxItem.imageDataUrl)}
                alt={activeLightboxItem.title}
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="flex flex-col gap-3 p-6 text-slate-100 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">
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
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                    {activeLightboxItem.description}
                  </p>
                )}
              </div>

              {isAdminUser && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(activeLightboxItem)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{locale === 'en' ? 'Edit' : 'Ubah'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteProject(activeLightboxItem.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/60 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900/70 cursor-pointer"
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
