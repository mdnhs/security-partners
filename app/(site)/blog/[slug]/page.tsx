import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ArticleBody, ArticleHeader } from "@/components/blog/article"
import { BlogCard } from "@/components/blog/blog-card"
import { allPosts, posts } from "@/components/home/data"
import { Container, SectionHeading } from "@/components/home/section"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"

export function generateStaticParams() {
  return allPosts.map((post) => ({ slug: post.slug }))
}

const findPost = (slug: string) => allPosts.find((post) => post.slug === slug)

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = findPost((await params).slug)
  if (!post) return {}
  return {
    title: `${post.title} | Security Partners Ltd.`,
    description: post.excerpt,
  }
}

export default async function BlogPostPage({
  params,
}: PageProps<"/blog/[slug]">) {
  const post = findPost((await params).slug)
  if (!post) notFound()

  // Same category first, then the most recent posts.
  const others = posts.filter((p) => p.slug !== post.slug)
  const related = [
    ...others.filter((p) => p.category === post.category),
    ...others.filter((p) => p.category !== post.category),
  ].slice(0, 3)

  return (
    <>
      <SiteHeader />
      <main>
        <ArticleHeader post={post} />
        <ArticleBody post={post} />
        <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
          <Container className="flex flex-col gap-14">
            <SectionHeading eyebrow="Keep reading" title="Related Articles" />
            <ul
              data-stagger
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {related.map((item) => (
                <li key={item.slug}>
                  <BlogCard post={item} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}
