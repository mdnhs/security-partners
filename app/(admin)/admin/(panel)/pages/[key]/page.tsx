import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageEditor } from "@/components/admin/pages/page-editor"
import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { requirePage } from "@/server/auth/session"
import { isPageKey } from "@/templates/registry"

export async function generateMetadata({
  params,
}: PageProps<"/admin/pages/[key]">): Promise<Metadata> {
  const { key } = await params
  return { title: isPageKey(key) ? `Edit ${PAGE_LABELS[key]}` : "Page" }
}

export default function EditPagePage({
  params,
}: PageProps<"/admin/pages/[key]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({
  params,
}: Pick<PageProps<"/admin/pages/[key]">, "params">) {
  const { key } = await params
  if (!isPageKey(key)) notFound()
  await requirePage("/admin/pages")
  return <PageEditor pageKey={key} />
}
