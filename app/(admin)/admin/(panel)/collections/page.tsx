import type { Metadata } from "next"
import { forbidden, redirect } from "next/navigation"
import { Suspense } from "react"

import { firstVisibleChild } from "@/lib/admin/nav"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Collections" }

/** No overview: Collections opens (307) on the first child the user may read. */
export default function CollectionsPage() {
  return (
    <Suspense fallback={null}>
      <FirstChild />
    </Suspense>
  )
}

async function FirstChild(): Promise<never> {
  const actor = await requirePage("/admin/collections")
  const child = firstVisibleChild("collections", actor.roles)
  if (!child) forbidden()
  redirect(child.href)
}
