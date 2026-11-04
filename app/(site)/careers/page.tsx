import type { Metadata } from "next"
import { connection } from "next/server"

import { SiteThemed } from "@/components/site-themed"
import { listPublishedJobs } from "@/server/modules/jobs-board/queries"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { CareersTemplate } from "@/templates/careers/render"
import { careersView } from "@/templates/careers/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "careers")
}

export default function CareersPage() {
  return (
    <SiteThemed>
      <Careers />
    </SiteThemed>
  )
}

async function Careers() {
  await connection()
  const [s, jobs] = await Promise.all([loadSiteSources(), listPublishedJobs()])
  return <CareersTemplate view={careersView(s, jobs, new Date())} />
}
