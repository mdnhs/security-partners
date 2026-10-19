import type { Metadata } from "next"
import { Suspense } from "react"

import { UsersScreen } from "@/components/admin/users/users-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Users & roles" }

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  // integration: requirePage("/admin/users") (Phase B, on main) replaces this.
  await requirePermission({ user: ["read"] })
  return <UsersScreen />
}
