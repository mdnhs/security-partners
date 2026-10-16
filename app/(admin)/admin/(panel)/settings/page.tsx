import type { Metadata } from "next"
import { forbidden, redirect } from "next/navigation"
import { Suspense } from "react"

import { firstReadableSettingsKey } from "@/lib/admin/settings-keys"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Settings" }

/** No overview: Settings opens on the first key the user may read. */
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <FirstKey />
    </Suspense>
  )
}

async function FirstKey(): Promise<never> {
  const actor = await requirePermission({ settings: ["read"] })
  const key = firstReadableSettingsKey(actor.roles)
  if (!key) forbidden()
  redirect(`/admin/settings/${key}`)
}
