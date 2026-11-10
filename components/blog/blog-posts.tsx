"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

import {
  type Author,
  AuthorBadge,
  BlogCard,
  type BlogCardPost,
  PostMeta,
} from "@/components/blog/blog-card"
import { Container } from "@/components/home/section"
import { interpolate, interpolateParts } from "@/lib/interpolate"
import { cn } from "@/lib/utils"

const pill =
  "flex h-10 shrink-0 items-center rounded-full px-4 text-sm leading-[normal] font-bold whitespace-nowrap transition-colors md:h-auto md:px-[22px] md:py-3 md:text-[15px]"
const pageButton =
  "flex size-11 items-center justify-center rounded-full text-base md:size-12 leading-[normal] font-bold transition-colors"

export type BlogPostsProps = {
  /** Every article except the featured one, newest first. */
  posts: BlogCardPost[]
  featured: (BlogCardPost & { author: Author | null }) | null
  /** Category names in the filter bar (categories with showInFilter). */
  filters: string[]
  pageSize: number
  initialCategory?: string
  labels: {
    allPosts: string
    readArticle: string
    featuredBadge: string
    /** "No posts in {category} yet. Check back soon." */
    emptyCategory: string
    filterAria: string
    paginationAria: string
    previousPage: string
    /** "Page {n}" */
    pageNumber: string
    nextPage: string
  }
}

export function BlogPosts({
  posts,
  featured,
  filters,
  pageSize,
  initialCategory,
  labels,
}: BlogPostsProps) {
  const all = labels.allPosts
  const [category, setCategory] = useState(
    initialCategory && filters.includes(initialCategory) ? initialCategory : all
  )
  const [page, setPage] = useState(1)
  const sectionRef = useRef<HTMLElement>(null)

  const filtered =
    category === all ? posts : posts.filter((p) => p.category === category)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const showFeatured =
    featured !== null &&
    page === 1 &&
    (category === all || category === featured.category)

  const selectCategory = (next: string) => {
    setCategory(next)
    setPage(1)
  }
  const goTo = (next: number) => {
    setPage(next)
    sectionRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section
      ref={sectionRef}
      className="scroll-mt-28 bg-brand-surface pb-14 md:px-10 md:py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-4 px-5 md:gap-10 md:px-0">
        <div
          role="group"
          aria-label={labels.filterAria}
          className="sticky top-[69px] z-30 -mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto border-b border-brand-line bg-white px-5 py-3.5 md:static md:mx-0 md:flex-wrap md:gap-3 md:overflow-visible md:border-0 md:bg-transparent md:p-0 [&::-webkit-scrollbar]:hidden"
        >
          {[all, ...filters].map((item) => {
            const active = item === category
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => selectCategory(item)}
                className={cn(
                  pill,
                  active
                    ? "bg-brand-blue text-white"
                    : "border border-brand-line bg-white text-brand-navy hover:border-brand-blue"
                )}
              >
                {item}
              </button>
            )
          })}
        </div>

        {showFeatured && (
          <article className="group mt-2 flex flex-col overflow-hidden rounded-[20px] border border-brand-line bg-white shadow-[0px_12px_40px_0px_rgba(13,26,51,0.06)] md:mt-0 md:rounded-[28px] lg:h-[451px] lg:flex-row">
            <div className="relative h-[200px] shrink-0 overflow-hidden md:h-80 lg:h-auto lg:w-[600px]">
              <Image
                src={featured.cover}
                alt=""
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col items-start justify-center gap-3.5 p-5 md:gap-[18px] md:p-14">
              <PostMeta
                featuredLabel={labels.featuredBadge}
                category={featured.category}
                date={featured.date}
              >
                {featured.displayDate}
              </PostMeta>
              <h2 className="text-xl leading-7 font-black tracking-[-0.01em] text-brand-navy md:text-4xl md:leading-[1.2]">
                {featured.title}
              </h2>
              <p className="text-[15px] leading-[23px] text-brand-ink md:text-[17px] md:leading-[1.65]">
                {featured.excerpt}
              </p>
              {featured.author && <AuthorBadge author={featured.author} />}
              <Link
                href={`/blog/${featured.slug}`}
                className="pt-1.5 text-base leading-[normal] font-bold whitespace-pre text-brand-blue hover:underline"
              >
                {labels.readArticle}
              </Link>
            </div>
          </article>
        )}

        {visible.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {visible.map((post) => (
              <li key={post.slug}>
                <BlogCard post={post} readArticle={labels.readArticle} />
              </li>
            ))}
          </ul>
        ) : (
          !showFeatured && (
            <p className="rounded-3xl border border-brand-line bg-white px-8 py-16 text-center text-lg text-brand-ink">
              {interpolateParts(labels.emptyCategory, { category })}
            </p>
          )
        )}

        <nav
          aria-label={labels.paginationAria}
          className="flex items-center justify-center gap-2.5"
        >
          <button
            type="button"
            aria-label={labels.previousPage}
            disabled={page === 1}
            onClick={() => goTo(page - 1)}
            className={cn(
              pageButton,
              "border border-brand-line bg-white text-brand-navy hover:border-brand-blue disabled:opacity-40"
            )}
          >
            ←
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={interpolate(labels.pageNumber, { n })}
              aria-current={n === page ? "page" : undefined}
              onClick={() => goTo(n)}
              className={cn(
                pageButton,
                n === page
                  ? "bg-brand-blue text-white"
                  : "border border-brand-line bg-white text-brand-navy hover:border-brand-blue"
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            aria-label={labels.nextPage}
            disabled={page === pageCount}
            onClick={() => goTo(page + 1)}
            className={cn(
              pageButton,
              "border border-brand-line bg-white text-brand-navy hover:border-brand-blue disabled:opacity-40"
            )}
          >
            →
          </button>
        </nav>
      </Container>
    </section>
  )
}
