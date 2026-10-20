import type { Metadata } from "next"
import { Suspense } from "react"

import { TrackingEditor } from "@/components/admin/marketing/tracking-editor"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Tracking" }

export default function MarketingPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePage("/admin/marketing")
  return (
    <TrackingEditor description="Tag IDs and switches. Nothing loads until a visitor consents. Changes stay in a draft until you publish." />
  )
}
