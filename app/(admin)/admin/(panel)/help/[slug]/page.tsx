import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { HelpArticleView } from "@/components/admin/help/help-view"
import { HelpArticleSkeleton } from "@/components/admin/kit/skeletons"
import {
  canReadArticle,
  HELP_ARTICLES,
  helpArticle,
} from "@/lib/admin/help/registry"
import { requirePage } from "@/server/auth/session"

type Params = Promise<{ slug: string }>

/** The docs are static data in the repo, so every article is known up front. */
export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const article = helpArticle((await params).slug)
  return { title: article ? `${article.title} · Help` : "Help" }
}

export default function HelpArticlePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<HelpArticleSkeleton />}>
      <Article params={params} />
    </Suspense>
  )
}

async function Article({ params }: { params: Params }) {
  const { slug } = await params
  // Signed in before the 404, so a stranger never learns which paths exist.
  const actor = await requirePage("/admin/help")
  const article = helpArticle(slug)
  // An article about screens the viewer's role cannot open is not listed,
  // and not served either.
  if (!article || !canReadArticle(actor.roles, article)) notFound()
  return <HelpArticleView article={article} roles={actor.roles} />
}
