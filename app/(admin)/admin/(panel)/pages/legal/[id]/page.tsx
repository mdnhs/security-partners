import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { LegalPageEditor } from "@/components/admin/legal/legal-page-editor"
import { isUuid } from "@/lib/ids"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Legal page" }

export default function LegalPagePage({
  params,
}: PageProps<"/admin/pages/legal/[id]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({
  params,
}: Pick<PageProps<"/admin/pages/legal/[id]">, "params">) {
  const { id } = await params
  // Permission first, as on every [param] page but settings/[key].
  await requirePage("/admin/pages/legal")
  if (!isUuid(id)) notFound()
  return <LegalPageEditor id={id} />
}
