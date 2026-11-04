import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { JobEditor } from "@/components/admin/careers/job-editor"
import { isUuid } from "@/lib/ids"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Edit job" }

export default function EditJobPage({
  params,
}: PageProps<"/admin/careers/jobs/[id]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({
  params,
}: Pick<PageProps<"/admin/careers/jobs/[id]">, "params">) {
  const { id } = await params
  // Permission first, as on every [param] page but settings/[key].
  await requirePage("/admin/careers/jobs")
  if (!isUuid(id)) notFound()
  return <JobEditor id={id} />
}
