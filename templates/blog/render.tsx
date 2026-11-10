import { ScrollDots } from "@/components/home/scroll-dots"
import { ArticleBody, ArticleHeader } from "@/components/blog/article"
import { BlogCard } from "@/components/blog/blog-card"
import { PageHero } from "@/components/home/page-hero"
import { Container, SectionHeading } from "@/components/home/section"
import { EnquireBanner } from "@/components/home/services"
import { HomeMotion } from "@/components/motion/home-motion"

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
      <main>
        <PageHero {...view.hero} />
        {posts}
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <HomeMotion />
    </>
  )
}

/** "/blog/[slug]". */
export function ArticleTemplate({ view }: { view: ArticleView }) {
  return (
    <>
      <main>
        <ArticleHeader {...view.header} />
        <ArticleBody {...view.body} />
        <section className="bg-brand-surface py-14 md:px-10 md:py-20 lg:py-28">
          <Container className="flex flex-col gap-6 md:gap-14">
            <SectionHeading
              className="px-5 md:px-0"
              eyebrow={view.related.eyebrow}
              title={view.related.heading}
            />
            <ul
              id="related-list"
              data-stagger
              className="flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-1 md:grid md:snap-none md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden"
            >
              {view.related.posts.map((item) => (
                <li
                  key={item.slug}
                  className="w-[296px] shrink-0 snap-center md:w-auto md:shrink"
                >
                  <BlogCard
                    post={item}
                    readArticle={view.related.readArticle}
                  />
                </li>
              ))}
            </ul>
            <ScrollDots targetId="related-list" className="md:hidden" />
          </Container>
        </section>
      </main>
      <HomeMotion />
    </>
  )
}
