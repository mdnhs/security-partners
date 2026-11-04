import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import { JsonLd } from "@/components/seo/json-ld"
import { SiteThemed } from "@/components/site-themed"
import { publicOrigin } from "@/server/lib/site-origin"
import {
  getJobBySlug,
  listPublishedJobs,
} from "@/server/modules/jobs-board/queries"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { JobDetailTemplate } from "@/templates/careers/job-render"
import { jobView } from "@/templates/careers/job-view"
import { jobMetadata } from "@/templates/shared/page-meta"
import { jobJsonLdFor } from "@/templates/shared/structured-data"

/** The job at `slug`: published, or its draft for a previewer (after the preview check). */
async function loadJob(slug: string) {
  const s = await loadSiteSources()
  const { isEnabled: draft } = await draftMode()
  return { s, job: await getJobBySlug(slug, draft) }
}

export async function generateMetadata({
  params,
}: PageProps<"/careers/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  const { s, job } = await loadJob(slug)
  return job ? jobMetadata(s, job) : {}
}

export default function JobDetailPage({
  params,
}: PageProps<"/careers/[slug]">) {
  return (
    <SiteThemed>
      <JobDetail params={params} />
    </SiteThemed>
  )
}

async function JobDetail({
  params,
}: Pick<PageProps<"/careers/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const [{ s, job }, all] = await Promise.all([
    loadJob(slug),
    listPublishedJobs(),
  ])
  // Unknown slugs never get here as a 200: proxy.ts rewrites them to the
  // 404; a draft without preview keeps this soft 404 (200 + noindex).
  if (!job) notFound()
  const now = new Date()
  const origin = publicOrigin(s.settings.site.productionUrl)
  return (
    <>
      <JobDetailTemplate view={jobView(s, job, all, now)} />
      <JsonLd data={jobJsonLdFor(s, job, origin, now)} />
    </>
  )
}
