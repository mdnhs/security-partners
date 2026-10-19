import type { Metadata } from "next"
import { Suspense } from "react"

import { ArticlesScreen } from "@/components/admin/articles/articles-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Insights" }

export default function ArticlesPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ article: ["read"] })
  return <ArticlesScreen />
}
