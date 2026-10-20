import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { NewsletterSection } from "@/components/newsletter/newsletter-section"
import { JsonLd } from "@/components/seo/json-ld"
import { SiteThemed } from "@/components/site-themed"
import { publicOrigin } from "@/server/lib/site-origin"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { ArticleTemplate } from "@/templates/blog/render"
import { articleView } from "@/templates/blog/view"
import { articleMetadata } from "@/templates/shared/page-meta"
import { articleJsonLdFor } from "@/templates/shared/structured-data"

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  return articleMetadata(await loadSiteSources(), slug)
}

export default function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <SiteThemed>
      <Article params={params} />
    </SiteThemed>
  )
}

async function Article({ params }: Pick<PageProps<"/blog/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const s = await loadSiteSources()
  const view = articleView(s, slug)
  // Unknown slugs are a real 404 in proxy.ts; previews keep the soft 404
  // (see services/[slug]/page.tsx).
  if (!view) notFound()
  const jsonLd = articleJsonLdFor(
    s,
    slug,
    publicOrigin(s.settings.site.productionUrl)
  )
  return (
    <>
      <ArticleTemplate
        view={view}
        newsletter={
          <Suspense fallback={null}>
            <NewsletterSection where="article" />
          </Suspense>
        }
      />
      {jsonLd && <JsonLd data={jsonLd} />}
    </>
  )
}
