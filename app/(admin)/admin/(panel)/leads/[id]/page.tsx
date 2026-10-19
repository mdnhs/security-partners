import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { LeadDetail } from "@/components/admin/leads/lead-detail"
import { idParam } from "@/lib/schemas/api/params"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Lead" }

export default function LeadPage({ params }: PageProps<"/admin/leads/[id]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({
  params,
}: Pick<PageProps<"/admin/leads/[id]">, "params">) {
  const { id } = await params
  // Permission first: a 403 never leaks whether an id exists.
  await requirePage("/admin/leads")
  if (!idParam.safeParse({ id }).success) notFound()
  return <LeadDetail id={id} />
}
