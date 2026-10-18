import type { Metadata } from "next"
import { Suspense } from "react"

import { IntegrationsOverview } from "@/components/admin/integrations/integrations-overview"
import { PageHeader } from "@/components/admin/page-header"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Integrations" }

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <Integrations />
    </Suspense>
  )
}

async function Integrations() {
  await requirePermission({ integration: ["read"] })
  return (
    <>
      <PageHeader
        stacked
        title="Integrations"
        description="Connections to outside services. Secrets are stored encrypted and are never shown again after saving."
      />
      <IntegrationsOverview />
    </>
  )
}
