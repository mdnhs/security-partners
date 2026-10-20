import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { isUuid } from "@/lib/ids"
import { requirePage } from "@/server/auth/session"

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
  await requirePage("/admin/leads")
  // Only a UUID goes into the URL (and later the API path): SEC1.
  if (!isUuid(id)) notFound()
  redirect(`/admin/leads?lead=${encodeURIComponent(id.toLowerCase())}`)
}
