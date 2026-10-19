import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { IntegrationForm } from "@/components/admin/integrations/integration-form"
import { MigrateMediaPanel } from "@/components/admin/integrations/migrate-media-panel"
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
  // The AI assistant moved to Site settings (MK §5.1). next.config's legacy
  // redirect normally answers first; this keeps the page from rendering it.
  if (key === "integrations.ai") redirect("/admin/settings/ai-assistant")
  await requirePermission({ integration: ["read"] })
  return (
    <IntegrationForm integrationKey={key}>
      {key === "integrations.r2" ? <MigrateMediaPanel /> : null}
    </IntegrationForm>
  )
}
