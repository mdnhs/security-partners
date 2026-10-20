import type { Metadata } from "next"
import { connection } from "next/server"

import { SiteThemed } from "@/components/site-themed"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { TeamTemplate } from "@/templates/team/render"
import { teamView } from "@/templates/team/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "team")
}

export default function TeamPage() {
  return (
    <SiteThemed>
      <Team />
    </SiteThemed>
  )
}

async function Team() {
  await connection()
  return <TeamTemplate view={teamView(await loadSiteSources())} />
}
