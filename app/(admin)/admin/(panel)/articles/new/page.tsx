import type { Metadata } from "next"
import { Suspense } from "react"

import { NewArticleForm } from "@/components/admin/articles/new-article-form"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "New article" }

export default function NewArticlePage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ article: ["create"] })
  return <NewArticleForm />
}
