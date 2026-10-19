import type { Metadata } from "next"
import { Suspense } from "react"

import { AiSettingsView } from "@/components/admin/ai/ai-settings-view"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = {
  title: "AI assistant",
}

/**
 * Site settings › AI assistant (MK parity §5.1, §6.3): provider, key,
 * model, who can use it and the owner's enquiry-details switch. Moved from
 * /admin/settings/integrations/ai (which redirects here).
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
  return <AiSettingsView />
}
