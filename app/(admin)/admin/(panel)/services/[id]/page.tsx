import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"

import { ServiceEditor } from "@/components/admin/services/service-editor"
import { requirePage } from "@/server/auth/session"
import { getSiteOrigin } from "@/server/modules/seo/queries"

export const metadata: Metadata = { title: "Edit service" }

export default function EditServicePage({
  params,
}: PageProps<"/admin/services/[id]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({
  params,
}: Pick<PageProps<"/admin/services/[id]">, "params">) {
  const { id } = await params
  // Permission first, as on every [param] page but settings/[key].
  await requirePage("/admin/services")
  if (!z.uuid().safeParse(id).success) notFound()
  return <ServiceEditor id={id} origin={await getSiteOrigin()} />
}
