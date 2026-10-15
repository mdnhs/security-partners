import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { AboutTemplate } from "@/templates/about/render"
import { aboutView } from "@/templates/about/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "about")
}

export default function AboutPage() {
  return (
    <Suspense fallback={null}>
      <About />
    </Suspense>
  )
}

async function About() {
  await connection()
  return <AboutTemplate view={aboutView(await loadSiteSources())} />
}
