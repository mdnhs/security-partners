import type { Metadata } from "next"
import { Suspense } from "react"

import { ConsentEditor } from "@/components/admin/marketing/consent-editor"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Consent banner" }

export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePage("/admin/marketing/consent")
  return (
    <ConsentEditor description="The cookie banner visitors see while tracking is on. Changes stay in a draft until you publish." />
  )
}
