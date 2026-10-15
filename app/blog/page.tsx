import type { Metadata } from "next"

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

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const { category } = await searchParams
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
        <BlogPosts
          initialCategory={typeof category === "string" ? category : undefined}
        />
        <EnquireBanner />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}
