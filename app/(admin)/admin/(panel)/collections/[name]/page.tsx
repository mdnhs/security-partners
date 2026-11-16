import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { adminHrefForCollection, withSearch } from "@/lib/admin/website"
import { COLLECTIONS, type CollectionName } from "@/lib/schemas/api/collections"
import { requireActor, requirePermission } from "@/server/auth/session"

/** Each collection is edited on the screen of the page that shows it (307, query kept). */
export default function CollectionPage({
  params,
  searchParams,
}: PageProps<"/admin/collections/[name]">) {
  return (
    <Suspense fallback={null}>
      <Go params={params} searchParams={searchParams} />
    </Suspense>
  )
}

const isCollectionName = (value: string): value is CollectionName =>
  (COLLECTIONS as readonly string[]).includes(value)

// Signed in before the 404, so a stranger never learns which paths exist.
async function Go({
  params,
  searchParams,
}: Pick<
  PageProps<"/admin/collections/[name]">,
  "params" | "searchParams"
>): Promise<never> {
  const { name } = await params
  await requireActor()
  if (!isCollectionName(name)) notFound()
  await requirePermission({ collection: ["read"] })
  redirect(withSearch(adminHrefForCollection(name), await searchParams))
}
