import type { Metadata } from "next"
import { connection } from "next/server"

import { BlogPosts } from "@/components/blog/blog-posts"
import { SiteThemed } from "@/components/site-themed"
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
    <SiteThemed>
      <Blog searchParams={searchParams} />
    </SiteThemed>
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
