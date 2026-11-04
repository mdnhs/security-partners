import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import { SiteThemed } from "@/components/site-themed"
import { getLegalPageForRequest } from "@/server/modules/legal-pages/queries"
import { resolveMedia } from "@/server/modules/media/queries"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { LegalTemplate } from "@/templates/legal/render"
import { legalDocView } from "@/templates/legal/view"
import { legalPageMetadata } from "@/templates/shared/page-meta"

// Admin-managed legal pages at /<slug> (Cookie Policy, …). Unknown, draft-only
// and deleted addresses never get here as a 200: proxy.ts answers them with a
// real 404 (or a stored redirect) before streaming. In preview the draft shows.

export async function generateMetadata({
  params,
}: PageProps<"/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  // Sources first: they check preview access before any draft is read.
  const s = await loadSiteSources()
  const page = await getLegalPageForRequest(slug)
  if (!page) return {}
  return legalPageMetadata(s, {
    id: page.id,
    slug,
    title: page.title,
    description: page.doc.hero.description,
  })
}

export default function LegalPage({ params }: PageProps<"/[slug]">) {
  return (
    <SiteThemed>
      <Legal params={params} />
    </SiteThemed>
  )
}

async function Legal({ params }: Pick<PageProps<"/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const s = await loadSiteSources()
  const page = await getLegalPageForRequest(slug)
  if (!page) notFound()
  const { doc } = await resolveMedia({ doc: page.doc })
  return <LegalTemplate view={legalDocView(s, doc, page.updatedAt)} />
}
