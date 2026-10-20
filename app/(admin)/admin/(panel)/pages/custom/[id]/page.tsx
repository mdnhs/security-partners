import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageBuilder } from "@/components/admin/builder/page-builder"
import { isUuid } from "@/lib/ids"
import { requirePage } from "@/server/auth/session"

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
  // Permission first, as on every [param] page but settings/[key].
  await requirePage("/admin/pages/custom")
  if (!isUuid(id)) notFound()
  return <PageBuilder id={id} />
}
