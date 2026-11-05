import type { Metadata } from "next"
import { connection } from "next/server"

import { SiteThemed } from "@/components/site-themed"
import { getApplyRetention } from "@/server/modules/applications/queries"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { ApplyTemplate } from "@/templates/careers/apply-render"
import { applyView } from "@/templates/careers/apply-view"
import { applyMetadata } from "@/templates/shared/page-meta"

// The talent pool ("Send Us Your CV"): the apply form with no job.

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return applyMetadata(await loadSiteSources(), null)
}

export default function TalentPoolPage() {
  return (
    <SiteThemed>
      <TalentPool />
    </SiteThemed>
  )
}

async function TalentPool() {
  await connection()
  return (
    <ApplyTemplate
      view={applyView(
        await loadSiteSources(),
        null,
        new Date(),
        await getApplyRetention()
      )}
    />
  )
}
