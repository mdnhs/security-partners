import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { type Author, AuthorBadge } from "@/components/blog/blog-card"
import { ShareLinks, type ShareLinksProps } from "@/components/blog/share-links"
import { Container, Eyebrow } from "@/components/home/section"
import type { WithMedia } from "@/lib/media"
import { ArticleBlocks } from "@/lib/rich-text/render"
import type { RichTextDoc } from "@/lib/schemas/common"

export type ArticleHeaderProps = {
  article: {
    title: string
    /** Lead paragraph (falls back to the excerpt). */
    lead: string
    category: string
    /** null (never published): the date is omitted. */
    date: string | null
    displayDate: string | null
    /** "5 min read", or null to hide it. */
    readTime: string | null
    author: Author | null
    cover: string
  }
  breadcrumb: {
    ariaLabel: string
    home: string
    blog: string
    blogHref: string
  }
}

export function ArticleHeader({ article, breadcrumb }: ArticleHeaderProps) {
  return (
    <section className="bg-brand-surface px-6 py-14 md:px-10 lg:py-[72px]">
      <Container className="flex flex-col items-start gap-6">
        <nav aria-label={breadcrumb.ariaLabel}>
          <ol className="flex flex-wrap items-center gap-2.5 rounded-full border border-brand-line bg-white px-4 py-2 text-[13px] leading-[normal] font-bold">
            <li>
              <Link href="/" className="text-brand-ink hover:text-brand-navy">
                {breadcrumb.home}
              </Link>
            </li>
            <li aria-hidden className="text-brand-placeholder">
              /
            </li>
            <li>
              <Link
                href={breadcrumb.blogHref}
                className="text-brand-ink hover:text-brand-navy"
              >
                {breadcrumb.blog}
              </Link>
            </li>
            <li aria-hidden className="text-brand-placeholder">
              /
            </li>
            <li aria-current="page" className="text-brand-green-dark">
              {article.category}
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center gap-3 text-sm leading-[normal] font-medium text-brand-muted">
          <span className="rounded-full bg-brand-mint px-3 py-1.5 text-xs leading-[normal] font-bold text-brand-green-dark">
            {article.category}
          </span>
          {article.date && (
            <time dateTime={article.date}>{article.displayDate}</time>
          )}
          {article.readTime && (
            <>
              <span aria-hidden className="font-bold text-brand-placeholder">
                •
              </span>
              <span>{article.readTime}</span>
            </>
          )}
        </div>

        <h1 className="max-w-[960px] text-4xl leading-[1.12] font-black tracking-[-0.015em] text-brand-navy md:text-[56px]">
          {article.title}
        </h1>
        <p className="max-w-[820px] text-lg leading-[1.6] text-brand-ink md:text-xl md:leading-[1.6]">
          {article.lead}
        </p>
        {article.author && <AuthorBadge author={article.author} size="lg" />}

        <div
          data-reveal
          className="relative mt-8 h-72 w-full overflow-hidden rounded-[28px] md:h-[560px]"
        >
          <div
            data-parallax
            className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
          >
            <Image
              src={article.cover}
              alt=""
              fill
              priority
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}

const paragraph = "text-lg leading-[1.75] text-[#3b4556]"
const card =
  "flex flex-col rounded-3xl border border-brand-line bg-white px-6 py-7 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
const cardTitle = "text-xl leading-[normal] font-black text-brand-navy"

export type ArticleBodyProps = {
  /** null: the article has no designed body yet and shows its excerpt. */
  body: WithMedia<RichTextDoc> | null
  excerpt: string
  tags: string[]
  share: ShareLinksProps
  recent: {
    slug: string
    title: string
    cover: string
    /** null (never published): the date is omitted. */
    date: string | null
    displayDate: string | null
  }[]
  categories: { name: string; count: number }[]
  labels: {
    tagsLabel: string
    recentPostsHeading: string
    categoriesAria: string
    categoriesHeading: string
  }
  cta: {
    eyebrow: string
    heading: string
    copy: string
    link: { label: string; href: string }
  }
}

export function ArticleBody({
  body,
  excerpt,
  tags,
  share,
  recent,
  categories,
  labels,
  cta,
}: ArticleBodyProps) {
  return (
    <section className="bg-white px-6 pt-14 pb-20 md:px-10 lg:pt-20 lg:pb-28">
      <Container className="flex flex-col gap-16 lg:flex-row lg:items-start">
        <article className="flex min-w-0 flex-1 flex-col gap-[22px]">
          {body ? (
            <ArticleBlocks doc={body} />
          ) : (
            <p className={paragraph}>{excerpt}</p>
          )}

          <div className="h-px bg-brand-line" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-sm leading-[normal] font-bold text-brand-navy">
                {labels.tagsLabel}
              </p>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-brand-surface px-3 py-1.5 text-xs leading-[normal] font-bold text-brand-ink"
                >
                  {tag}
                </span>
              ))}
            </div>
            <ShareLinks {...share} />
          </div>
        </article>

        <aside className="flex w-full flex-col gap-6 lg:w-[360px] lg:shrink-0">
          <div className={`${card} gap-[18px]`}>
            <p className={cardTitle}>{labels.recentPostsHeading}</p>
            {recent.map((item) => (
              <Link
                key={item.slug}
                href={`/blog/${item.slug}`}
                className="group flex items-center gap-3.5"
              >
                <div className="relative size-[76px] shrink-0 overflow-hidden rounded-[14px]">
                  <Image
                    src={item.cover}
                    alt=""
                    fill
                    sizes="76px"
                    className="object-cover"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="text-[15px] leading-[1.35] font-bold text-brand-navy group-hover:text-brand-blue">
                    {item.title}
                  </p>
                  {item.date && (
                    <time
                      dateTime={item.date}
                      className="text-[13px] leading-[normal] font-medium text-brand-muted"
                    >
                      {item.displayDate}
                    </time>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <nav aria-label={labels.categoriesAria} className={`${card} gap-1.5`}>
            <p className={`${cardTitle} mb-1.5`}>{labels.categoriesHeading}</p>
            {categories.map((category) => (
              <Link
                key={category.name}
                href={`/blog?category=${encodeURIComponent(category.name)}`}
                className="flex items-center justify-between py-3 text-[15px] leading-[normal] font-medium text-brand-navy hover:text-brand-blue"
              >
                {category.name}
                <span className="rounded-full bg-brand-mint px-2.5 py-[3px] text-xs leading-[normal] font-bold text-brand-green-dark">
                  {category.count}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-col items-start gap-3.5 rounded-3xl bg-brand-blue px-7 py-8">
            <Eyebrow>{cta.eyebrow}</Eyebrow>
            <p className="text-2xl leading-[1.2] font-black text-white">
              {cta.heading}
            </p>
            <p className="text-[15px] leading-[1.6] text-white/85">
              {cta.copy}
            </p>
            <Link
              href={cta.link.href}
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "w-full"
              )}
            >
              {cta.link.label}
            </Link>
          </div>
        </aside>
      </Container>
    </section>
  )
}
