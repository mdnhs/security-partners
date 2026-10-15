import type { Metadata } from "next"
import { Suspense } from "react"

import { BlogPosts } from "@/components/blog/blog-posts"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"

export const metadata: Metadata = {
  title: "News & Insights | Security Partners Ltd.",
  description:
    "Security tips, company news and advice from the Security Partners team.",
}

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          image="/images/banner.png"
          crumb="Blog"
          title="News & Insights"
          description="Security tips, company news and advice from the Security Partners team."
        />
        {/* cacheComponents: searchParams is request data, read inside Suspense. */}
        <Suspense fallback={null}>
          <Posts searchParams={searchParams} />
        </Suspense>
        <EnquireBanner />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}

async function Posts({
  searchParams,
}: Pick<PageProps<"/blog">, "searchParams">) {
  const { category } = await searchParams
  return (
    <BlogPosts
      initialCategory={typeof category === "string" ? category : undefined}
    />
  )
}
