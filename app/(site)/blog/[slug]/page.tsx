import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { ArticleTemplate } from "@/templates/blog/render"
import { articleView } from "@/templates/blog/view"
import { articleMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  return articleMetadata(await loadSiteSources(), slug)
}

export default function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Article params={params} />
    </Suspense>
  )
}

async function Article({ params }: Pick<PageProps<"/blog/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const view = articleView(await loadSiteSources(), slug)
  // Soft 404 inside Suspense (see services/[slug]/page.tsx).
  if (!view) notFound()
  return <ArticleTemplate view={view} />
}
