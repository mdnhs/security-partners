import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// bg-skeleton, not bg-muted: muted is nearly the panel's own grey.
export function KpiRowSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="rounded-card bg-skeleton h-[164px]" />
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      aria-hidden
      className={cn("rounded-card bg-skeleton h-72", className)}
    />
  )
}

/** Help: the topics column and one article (help/layout.tsx's fallback). */
export function HelpPageSkeleton() {
  return (
    <div aria-hidden className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <div className="hidden flex-col gap-2 lg:flex">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => (
          <Skeleton key={index} className="bg-skeleton h-7 rounded-lg" />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <Skeleton className="bg-skeleton h-10 w-36 rounded-xl lg:hidden" />
        <HelpArticleSkeleton />
      </div>
    </div>
  )
}

/**
 * One help article (breadcrumb, title, lead, sections) and, on wide
 * screens, "On this page": a page's own fallback while the topics stay.
 */
export function HelpArticleSkeleton() {
  return (
    <div aria-hidden className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="flex max-w-[70ch] flex-col gap-4">
        <Skeleton className="bg-skeleton h-4 w-48 rounded-md" />
        <Skeleton className="bg-skeleton h-9 w-2/3 rounded-lg" />
        <Skeleton className="bg-skeleton h-16 w-full rounded-lg" />
        {[0, 1].map((index) => (
          <div key={index} className="mt-6 flex flex-col gap-3">
            <Skeleton className="bg-skeleton h-6 w-1/3 rounded-md" />
            <Skeleton className="bg-skeleton h-4 w-full rounded-md" />
            <Skeleton className="bg-skeleton h-4 w-5/6 rounded-md" />
            <Skeleton className="bg-skeleton h-4 w-4/6 rounded-md" />
          </div>
        ))}
      </div>
      <div className="hidden flex-col gap-2 xl:flex">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="bg-skeleton h-5 rounded-md" />
        ))}
      </div>
    </div>
  )
}
