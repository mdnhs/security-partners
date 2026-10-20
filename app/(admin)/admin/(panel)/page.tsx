import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { Dashboard } from "@/components/admin/dashboard/dashboard"
import { DashboardSkeleton } from "@/components/admin/dashboard/dashboard-skeleton"
import { firstName } from "@/components/admin/dashboard/present"
import { requirePage, requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

/** Dashboard (master 4.7) in the JW layout: greeting, KPIs, trend, Next up. */
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <>
          <p role="status" className="sr-only">
            Loading dashboard…
          </p>
          <DashboardSkeleton />
        </>
      }
    >
      <Welcome />
    </Suspense>
  )
}

// The greeting depends on the time of day: request time, never the static
// shell; the client renders the same words from `renderedAt`.
async function Welcome() {
  await requirePage("/admin")
  const { user } = await requireSession()
  await connection()
  return (
    <Dashboard
      firstName={firstName(user.name)}
      renderedAt={new Date().toISOString()}
    />
  )
}
