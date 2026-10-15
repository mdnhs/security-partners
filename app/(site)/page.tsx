import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { HomeTemplate } from "@/templates/home/render"
import { homeView } from "@/templates/home/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "home")
}

// Content is read per request inside Suspense (after connection()), so the
// build never touches the database. The fallback renders nothing.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  )
}

async function Home() {
  await connection()
  return <HomeTemplate view={homeView(await loadSiteSources())} />
}
