import { redirect } from "next/navigation"
import { Suspense } from "react"

import { withSearch } from "@/lib/admin/website"
import { requireActor } from "@/server/auth/session"

/** Collections are edited on the Website screens (307, query kept). */
export default function CollectionsPage({
  searchParams,
}: PageProps<"/admin/collections">) {
  return (
    <Suspense fallback={null}>
      <Go searchParams={searchParams} />
    </Suspense>
  )
}

async function Go({
  searchParams,
}: Pick<PageProps<"/admin/collections">, "searchParams">): Promise<never> {
  await requireActor()
  redirect(withSearch("/admin/website", await searchParams))
}
