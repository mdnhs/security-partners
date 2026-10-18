import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { JsonLd } from "@/components/seo/json-ld"
import { publicOrigin } from "@/server/lib/site-origin"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { ServiceDetailTemplate } from "@/templates/services/render"
import { serviceDetailView } from "@/templates/services/view"
import { serviceMetadata } from "@/templates/shared/page-meta"
import { serviceJsonLd } from "@/templates/shared/structured-data"

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  return serviceMetadata(await loadSiteSources(), slug)
}

export default function ServiceDetailPage({
  params,
}: PageProps<"/services/[slug]">) {
  return (
    <Suspense fallback={null}>
      <ServiceDetail params={params} />
    </Suspense>
  )
}

async function ServiceDetail({
  params,
}: Pick<PageProps<"/services/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const s = await loadSiteSources()
  const view = serviceDetailView(s, slug)
  // Unknown slugs never get here as a 200: proxy.ts rewrites them to the
  // 404; drafts in preview keep this soft 404 (200 + noindex, inside
  // Suspense the shell has already streamed).
  if (!view) notFound()
  const jsonLd = serviceJsonLd(
    s,
    slug,
    publicOrigin(s.settings.site.productionUrl)
  )
  return (
    <>
      <ServiceDetailTemplate view={view} />
      {jsonLd && <JsonLd data={jsonLd} />}
    </>
  )
}
