import type { Metadata } from "next"
import { Suspense } from "react"

import { UsersScreen } from "@/components/admin/users/users-screen"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Users" }

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePage("/admin/users")
  return <UsersScreen />
}
