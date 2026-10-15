import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { BlogPosts } from "@/components/blog/blog-posts"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { BlogTemplate } from "@/templates/blog/render"
import { blogView } from "@/templates/blog/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "blog")
}

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <Suspense fallback={null}>
      <Blog searchParams={searchParams} />
    </Suspense>
  )
}

async function Blog({
  searchParams,
}: Pick<PageProps<"/blog">, "searchParams">) {
  await connection()
  const [{ category }, sources] = await Promise.all([
    searchParams,
    loadSiteSources(),
  ])
  const view = blogView(sources)
  return (
    <BlogTemplate
      view={view}
      posts={
        <BlogPosts
          {...view.posts}
          initialCategory={typeof category === "string" ? category : undefined}
        />
      }
    />
  )
}
