import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { ApplicationDetail } from "@/components/admin/careers/application-detail"
import { isUuid } from "@/lib/ids"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Application" }

export default function ApplicationPage({
  params,
}: PageProps<"/admin/careers/applications/[id]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({
  params,
}: Pick<PageProps<"/admin/careers/applications/[id]">, "params">) {
  const { id } = await params
  await requirePage("/admin/careers/applications")
  if (!isUuid(id)) notFound()
  return <ApplicationDetail id={id} />
}
