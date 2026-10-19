import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { type ReactNode, Suspense } from "react"

import { idParam } from "@/lib/schemas/api/params"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Lead" }

/**
 * Old lead address (notification emails, search results, bookmarks): the
 * lead now opens in the inbox's drawer (MK parity D3.2), `?lead=<id>`.
 */
export default function LeadPage({ params }: PageProps<"/admin/leads/[id]">) {
  return (
    <Suspense fallback={null}>
      <Redirect params={params} />
    </Suspense>
  )
}

async function Redirect({
  params,
}: Pick<PageProps<"/admin/leads/[id]">, "params">): Promise<ReactNode> {
  const { id } = await params
  // Permission first: a 403 never leaks whether an id exists.
  // integration: requirePage("/admin/leads") (Phase B, on main).
  await requirePermission({ lead: ["read"] })
  // Only a UUID goes into the URL (and later the API path): SEC1.
  if (!idParam.safeParse({ id }).success) notFound()
  redirect(`/admin/leads?lead=${encodeURIComponent(id.toLowerCase())}`)
}
