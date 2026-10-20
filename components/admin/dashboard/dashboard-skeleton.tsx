import { CardSkeleton, KpiRowSkeleton } from "@/components/admin/kit/skeletons"

/** Placeholder blocks while the dashboard loads (aria-hidden by the kit). */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <KpiRowSkeleton />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
