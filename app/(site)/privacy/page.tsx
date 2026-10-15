import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { LegalTemplate } from "@/templates/legal/render"
import { legalView } from "@/templates/legal/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "privacy")
}

export default function PrivacyPage() {
  return (
    <Suspense fallback={null}>
      <Privacy />
    </Suspense>
  )
}

async function Privacy() {
  await connection()
  return <LegalTemplate view={legalView(await loadSiteSources(), "privacy")} />
}
