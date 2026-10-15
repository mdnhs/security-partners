import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { ServiceDetailTemplate } from "@/templates/services/render"
import { serviceDetailView } from "@/templates/services/view"
import { serviceMetadata } from "@/templates/shared/page-meta"

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
  const view = serviceDetailView(await loadSiteSources(), slug)
  // Inside Suspense this is a soft 404 (200 + noindex): the shell has
  // already streamed (Cache Components; Next docs "Status codes").
  if (!view) notFound()
  return <ServiceDetailTemplate view={view} />
}
