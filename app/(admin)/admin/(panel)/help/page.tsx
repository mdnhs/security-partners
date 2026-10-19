import type { Metadata } from "next"
import { Suspense } from "react"

import { HelpView } from "@/components/admin/help/help-view"
import { PageHeader } from "@/components/admin/page-header"
import { requirePage } from "@/server/auth/session"
import { listOwnerContacts } from "@/server/modules/users/service"

export const metadata: Metadata = { title: "Help" }

export default function HelpPage() {
  return (
    <Suspense fallback={null}>
      <Help />
    </Suspense>
  )
}

async function Help() {
  await requirePage("/admin/help")
  const owners = await listOwnerContacts()
  return (
    <>
      <PageHeader
        title="Help"
        description="Shortcuts, who to ask, and where the guides are."
      />
      <HelpView owners={owners} />
    </>
  )
}
