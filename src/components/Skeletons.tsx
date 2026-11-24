export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="skeleton-shimmer aspect-4/3 bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-3 p-5">
        <div className="skeleton-shimmer h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="skeleton-shimmer h-5 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-1.5 pt-1">
          <div className="skeleton-shimmer h-3 w-full rounded bg-slate-100 dark:bg-slate-800/70" />
          <div className="skeleton-shimmer h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800/70" />
        </div>
      </div>
    </div>
  );
}

export function ProjectGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading project gallery"
      className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <ProjectCardSkeleton key={idx} />
      ))}
    </div>
  );
}

export function ExperienceTimelineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading work experience timeline"
      className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12 md:gap-8 md:p-8"
        >
          <div className="space-y-3 md:col-span-4">
            <div className="skeleton-shimmer h-3 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="skeleton-shimmer h-6 w-52 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="skeleton-shimmer h-4 w-44 rounded bg-slate-100 dark:bg-slate-800/80" />
            <div className="skeleton-shimmer h-3 w-48 rounded bg-slate-100 dark:bg-slate-800/70" />
          </div>
          <div className="space-y-3 md:col-span-8">
            <div className="skeleton-shimmer h-3.5 w-full rounded bg-slate-100 dark:bg-slate-800/80" />
            <div className="skeleton-shimmer h-3.5 w-11/12 rounded bg-slate-100 dark:bg-slate-800/80" />
            <div className="skeleton-shimmer h-3.5 w-4/5 rounded bg-slate-100 dark:bg-slate-800/80" />
            <div className="pt-3">
              <div className="skeleton-shimmer h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800/70" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
