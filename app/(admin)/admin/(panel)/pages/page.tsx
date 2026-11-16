import { redirect } from "next/navigation"
import { Suspense } from "react"

import { websiteHref, withSearch } from "@/lib/admin/website"
import { requireActor } from "@/server/auth/session"

/**
 * The Pages list moved to Website (307, query kept). `?new=1` (New page)
 * opens the dialog on Custom pages, where builder pages now live.
 */
export default function PagesPage({ searchParams }: PageProps<"/admin/pages">) {
  return (
    <Suspense fallback={null}>
      <Go searchParams={searchParams} />
    </Suspense>
  )
}

async function Go({
  searchParams,
}: Pick<PageProps<"/admin/pages">, "searchParams">): Promise<never> {
  await requireActor()
  const target =
    (await searchParams).new === "1"
      ? websiteHref("custom-pages")
      : "/admin/website"
  redirect(withSearch(target, await searchParams))
}
