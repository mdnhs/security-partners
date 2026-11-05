import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import { SiteThemed } from "@/components/site-themed"
import { getJobBySlug } from "@/server/modules/jobs-board/queries"
import { getApplyRetention } from "@/server/modules/applications/queries"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { ApplyTemplate } from "@/templates/careers/apply-render"
import { applyView } from "@/templates/careers/apply-view"
import { applyMetadata } from "@/templates/shared/page-meta"

async function loadJob(slug: string) {
  const s = await loadSiteSources()
  const { isEnabled: draft } = await draftMode()
  return { s, job: await getJobBySlug(slug, draft) }
}

export async function generateMetadata({
  params,
}: PageProps<"/careers/[slug]/apply">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  const { s, job } = await loadJob(slug)
  return job ? applyMetadata(s, job) : {}
}

export default function ApplyPage({
  params,
}: PageProps<"/careers/[slug]/apply">) {
  return (
    <SiteThemed>
      <Apply params={params} />
    </SiteThemed>
  )
}

async function Apply({
  params,
}: Pick<PageProps<"/careers/[slug]/apply">, "params">) {
  await connection()
  const { slug } = await params
  const { s, job } = await loadJob(slug)
  // Unknown slugs are a real 404 in proxy.ts; a draft without preview
  // keeps this soft 404.
  if (!job) notFound()
  return (
    <ApplyTemplate
      view={applyView(s, job, new Date(), await getApplyRetention())}
    />
  )
}
