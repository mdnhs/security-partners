import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { ContactTemplate } from "@/templates/contact/render"
import { contactView } from "@/templates/contact/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "contact")
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <Contact />
    </Suspense>
  )
}

async function Contact() {
  await connection()
  return <ContactTemplate view={contactView(await loadSiteSources())} />
}
