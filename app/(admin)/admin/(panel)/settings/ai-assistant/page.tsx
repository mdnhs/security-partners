import type { Metadata } from "next"
import { Suspense } from "react"

import { IntegrationForm } from "@/components/admin/integrations/integration-form"
import { INTEGRATIONS } from "@/lib/schemas/integrations"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = {
  title: INTEGRATIONS["integrations.ai"].label,
}

/**
 * Site settings › AI assistant (MK parity §5.1): the AI integration's form,
 * moved from /admin/settings/integrations/ai (which redirects here). Phase C
 * (C7) replaces it with the full AI assistant settings screen.
 */
export default function AiAssistantPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePage("/admin/settings/ai-assistant")
  return <IntegrationForm integrationKey="integrations.ai" />
}
