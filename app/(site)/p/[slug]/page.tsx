import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { getBuilderPageForRequest } from "@/server/modules/builder-pages/queries"
import { resolveMedia } from "@/server/modules/media/queries"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { BuilderTemplate } from "@/templates/builder/render"
import {
  builderBlocksView,
  firstHeroDescription,
} from "@/templates/builder/views"
import { builderPageMetadata } from "@/templates/shared/page-meta"
import { chromeView } from "@/templates/shared/views"

// Builder pages (spec §7.5). Unknown, draft-only and deleted addresses never
// get here as a 200: proxy.ts answers them with a real 404 (or a stored
// redirect) before streaming. In preview the draft renders.

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  // Sources first: they check preview access before any draft is read.
  const s = await loadSiteSources()
  const page = await getBuilderPageForRequest(slug)
  if (!page) return {}
  // Only the SEO record's media is needed here, not the blocks'.
  const { seo } = await resolveMedia({ seo: page.seo })
  return builderPageMetadata(s, {
    id: page.id,
    slug,
    title: page.title,
    seo,
    firstHeroDescription: firstHeroDescription(page.doc.blocks),
  })
}

export default function BuilderPage({ params }: PageProps<"/p/[slug]">) {
  // The page's single top-level wrapper: swapped for SiteThemed (C3,
  // components/site-themed.tsx) at integration.
  return (
    <Suspense fallback={null}>
      <Builder params={params} />
    </Suspense>
  )
}

async function Builder({ params }: Pick<PageProps<"/p/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const s = await loadSiteSources()
  const page = await getBuilderPageForRequest(slug)
  if (!page) notFound()
  const { doc } = await resolveMedia({ doc: page.doc })
  return (
    <BuilderTemplate
      chrome={chromeView(s)}
      blocks={builderBlocksView(doc.blocks, s)}
      newsletterCopy={null}
    />
  )
}
