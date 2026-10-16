import type { Metadata } from "next"
import { Suspense } from "react"

import { Dashboard } from "@/components/admin/dashboard/dashboard"
import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

/** Dashboard (master 4.7): greeting, KPIs, lead trend and Next up. */
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <p className="text-muted-foreground">
          Here is what is happening on the website.
        </p>
      </section>
      <Dashboard />
    </div>
  )
}
