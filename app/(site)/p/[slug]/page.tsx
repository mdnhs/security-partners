import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { builderSlug } from "@/lib/schemas/api/builder-pages"
import { getPublishedBuilderPage } from "@/server/modules/builder-pages/queries"
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

/** The page with media resolved; null for a malformed slug or no page. */
async function loadBuilderPage(slug: string) {
  if (!builderSlug.safeParse(slug).success) return null
  const page = await getPublishedBuilderPage(slug)
  if (!page) return null
  const { doc, seo } = await resolveMedia({ doc: page.doc, seo: page.seo })
  return { ...page, slug, doc, seo, raw: page.doc }
}

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  // Sources first: they check preview access before any draft is read.
  const s = await loadSiteSources()
  const page = await loadBuilderPage(slug)
  if (!page) return {}
  return builderPageMetadata(s, {
    id: page.id,
    slug,
    title: page.title,
    seo: page.seo,
    firstHeroDescription: firstHeroDescription(page.raw.blocks),
  })
}

export default function BuilderPage({ params }: PageProps<"/p/[slug]">) {
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
  const page = await loadBuilderPage(slug)
  if (!page) notFound()
  return (
    <BuilderTemplate
      chrome={chromeView(s)}
      blocks={builderBlocksView(page.doc.blocks, s)}
      newsletterCopy={null}
    />
  )
}
