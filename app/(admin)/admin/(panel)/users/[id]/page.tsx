import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"

import { UserDetail } from "@/components/admin/users/user-detail"
import { requirePermission } from "@/server/auth/session"

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
  if (!z.uuid().safeParse(id).success) notFound()
  await requirePermission({ user: ["read"] })
  return <UserDetail id={id} />
}
