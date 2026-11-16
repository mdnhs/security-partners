import type { Metadata } from "next"
import { Suspense } from "react"

import { LegalPagesSection } from "@/components/admin/legal/legal-pages-section"
import { PageHeader } from "@/components/admin/page-header"
import { SitePagesList } from "@/components/admin/pages/pages-list"
import { LEGAL_PAGE_KEYS } from "@/lib/admin/website"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Legal pages" }

export default function LegalPagesPage() {
  return (
    <Suspense fallback={null}>
      <LegalPages />
    </Suspense>
  )
}

async function LegalPages() {
  await requirePage("/admin/website/legal")
  return (
    <>
      <PageHeader
        title="Legal pages"
        description="Privacy, terms and other policies. Changes stay in a draft until you publish."
      />
      <div className="flex flex-col gap-10">
        <section aria-labelledby="legal-fixed" className="flex flex-col gap-4">
          <h2 id="legal-fixed" className="text-card-title">
            Privacy and terms
          </h2>
          <SitePagesList only={LEGAL_PAGE_KEYS} />
        </section>
        <LegalPagesSection />
      </div>
    </>
  )
}
