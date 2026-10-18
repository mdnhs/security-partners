import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { IntegrationForm } from "@/components/admin/integrations/integration-form"
import {
  INTEGRATIONS,
  integrationKeyFromSlug,
} from "@/lib/schemas/integrations"
import { requirePermission } from "@/server/auth/session"

export async function generateMetadata({
  params,
}: PageProps<"/admin/settings/integrations/[slug]">): Promise<Metadata> {
  const key = integrationKeyFromSlug((await params).slug)
  return { title: key ? INTEGRATIONS[key].label : "Integrations" }
}

export default function IntegrationPage({
  params,
}: PageProps<"/admin/settings/integrations/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Integration params={params} />
    </Suspense>
  )
}

async function Integration({
  params,
}: Pick<PageProps<"/admin/settings/integrations/[slug]">, "params">) {
  const key = integrationKeyFromSlug((await params).slug)
  if (!key) notFound()
  await requirePermission({ integration: ["read"] })
  return <IntegrationForm integrationKey={key} />
}
