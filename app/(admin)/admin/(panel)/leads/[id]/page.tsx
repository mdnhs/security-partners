import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { idParam } from "@/lib/schemas/api/params"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Lead" }

/**
 * Old lead address (notification emails, search results, bookmarks): the
 * lead now opens in the inbox's drawer (MK parity D3.2), `?lead=<id>`.
 * Nothing renders here, so the page needs no Suspense of its own (D3.2
 * review M6); the panel layout's boundary covers the request data.
 */
export default async function LeadPage({
  params,
}: PageProps<"/admin/leads/[id]">) {
  const { id } = await params
  // Permission first: a 403 never leaks whether an id exists.
  // integration: requirePage("/admin/leads") (Phase B, on main).
  await requirePermission({ lead: ["read"] })
  // Only a UUID goes into the URL (and later the API path): SEC1.
  if (!idParam.safeParse({ id }).success) notFound()
  redirect(`/admin/leads?lead=${encodeURIComponent(id.toLowerCase())}`)
}
