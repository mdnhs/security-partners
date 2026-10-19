import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageBuilder } from "@/components/admin/builder/page-builder"
import { idParam } from "@/lib/schemas/api/params"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Page builder" }

export default function CustomPagePage({
  params,
}: PageProps<"/admin/pages/custom/[id]">) {
  return (
    <Suspense fallback={null}>
      <Builder params={params} />
    </Suspense>
  )
}

async function Builder({
  params,
}: Pick<PageProps<"/admin/pages/custom/[id]">, "params">) {
  const { id } = await params
  // Same permission as the nav registry's "pages" item (permissionFor).
  // integration: requirePage — swap for `await requirePage(`/admin/pages/custom/${id}`)`
  // when Phase B's page guards are on this branch.
  await requirePermission({ page: ["read"] })
  if (!idParam.safeParse({ id }).success) notFound()
  return <PageBuilder id={id} />
}
