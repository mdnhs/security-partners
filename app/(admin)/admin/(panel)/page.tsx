import type { Metadata } from "next"
import { Suspense } from "react"

import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

/** Placeholder landing page until the Phase 4 dashboard (Task 4.7). */
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  )
}

async function Welcome() {
  const { user } = await requireSession()
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      <p className="text-muted-foreground">
        You are signed in to the Security Partners admin.
      </p>
    </section>
  )
}
