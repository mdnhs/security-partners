import type { Metadata } from "next"
import { Suspense } from "react"

import { ConsentEditor } from "@/components/admin/marketing/consent-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Consent banner" }

export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePermission(GROWTH_SETTINGS.consent.read)
  return (
    <ConsentEditor description="The cookie banner visitors see while tracking is on. Changes stay in a draft until you publish." />
  )
}
