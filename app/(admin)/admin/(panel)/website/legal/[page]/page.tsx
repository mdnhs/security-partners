import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageEditor } from "@/components/admin/pages/page-editor"
import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { isLegalPageKey } from "@/lib/admin/website"
import { requirePage } from "@/server/auth/session"
import { getSiteOrigin } from "@/server/modules/seo/queries"

export async function generateMetadata({
  params,
}: PageProps<"/admin/website/legal/[page]">): Promise<Metadata> {
  const { page } = await params
  return { title: isLegalPageKey(page) ? PAGE_LABELS[page] : "Legal pages" }
}

/** Privacy policy and Terms of use: fixed pages listed under Legal pages. */
export default function LegalFixedPagePage({
  params,
}: PageProps<"/admin/website/legal/[page]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({
  params,
}: Pick<PageProps<"/admin/website/legal/[page]">, "params">) {
  const { page } = await params
  // Permission first, as on every [param] page but settings/[key].
  await requirePage("/admin/website/legal")
  if (!isLegalPageKey(page)) notFound()
  return <PageEditor pageKey={page} origin={await getSiteOrigin()} />
}
