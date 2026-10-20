import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { UserDetail } from "@/components/admin/users/user-detail"
import { isUuid } from "@/lib/ids"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "User" }

export default function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({
  params,
}: Pick<PageProps<"/admin/users/[id]">, "params">) {
  const { id } = await params
  // Permission first: a 403 never leaks whether an id exists.
  await requirePage("/admin/users")
  if (!isUuid(id)) notFound()
  return <UserDetail id={id} />
}
