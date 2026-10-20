import type { Metadata } from "next"
import { forbidden, redirect } from "next/navigation"
import { Suspense } from "react"

import { firstVisibleChild } from "@/lib/admin/nav"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Site settings" }

/** No overview: Site settings opens on the first child the user may read. */
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <FirstChild />
    </Suspense>
  )
}

async function FirstChild(): Promise<never> {
  const actor = await requirePage("/admin/settings")
  const child = firstVisibleChild("settings", actor.roles)
  if (!child) forbidden()
  redirect(child.href)
}
