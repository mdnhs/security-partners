import type { Metadata } from "next"
import { forbidden, redirect } from "next/navigation"
import { Suspense } from "react"

import { firstVisibleChild } from "@/lib/admin/nav"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Website" }

/** No overview: Website opens on the first screen the user may open. */
export default function WebsitePage() {
  return (
    <Suspense fallback={null}>
      <FirstChild />
    </Suspense>
  )
}

async function FirstChild(): Promise<never> {
  const actor = await requirePage("/admin/website")
  const child = firstVisibleChild("website", actor.roles)
  if (!child) forbidden()
  redirect(child.href)
}
