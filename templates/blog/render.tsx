import { ArticleBody, ArticleHeader } from "@/components/blog/article"
import { BlogCard } from "@/components/blog/blog-card"
import { PageHero } from "@/components/home/page-hero"
import { Container, SectionHeading } from "@/components/home/section"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"

import type { ArticleView, BlogView } from "./view"

/**
 * "/blog". `posts` is passed separately because the initial category comes
 * from ?category= (request data, read inside Suspense by the page).
 */
export function BlogTemplate({
  view,
  posts,
}: {
  view: BlogView
  posts: React.ReactNode
}) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        {posts}
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}

/** "/blog/[slug]". */
export function ArticleTemplate({ view }: { view: ArticleView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <ArticleHeader {...view.header} />
        <ArticleBody {...view.body} />
        <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
          <Container className="flex flex-col gap-14">
            <SectionHeading
              eyebrow={view.related.eyebrow}
              title={view.related.heading}
            />
            <ul
              data-stagger
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {view.related.posts.map((item) => (
                <li key={item.slug}>
                  <BlogCard
                    post={item}
                    readArticle={view.related.readArticle}
                  />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
