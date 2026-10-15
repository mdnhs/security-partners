import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { ServicesTemplate } from "@/templates/services/render"
import { servicesView } from "@/templates/services/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "services")
}

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <Services />
    </Suspense>
  )
}

async function Services() {
  await connection()
  return <ServicesTemplate view={servicesView(await loadSiteSources())} />
}
