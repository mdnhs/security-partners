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
  "rounded-full px-[22px] py-3 text-[15px] leading-[normal] font-bold transition-colors"
const pageButton =
  "flex size-12 items-center justify-center rounded-full text-base leading-[normal] font-bold transition-colors"

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
      className="scroll-mt-28 bg-brand-surface px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-10">
        <div
          role="group"
          aria-label={labels.filterAria}
          className="flex flex-wrap gap-3"
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
          <article className="group flex flex-col overflow-hidden rounded-[28px] border border-brand-line bg-white shadow-[0px_12px_40px_0px_rgba(13,26,51,0.06)] lg:h-[451px] lg:flex-row">
            <div className="relative h-64 shrink-0 overflow-hidden md:h-80 lg:h-auto lg:w-[600px]">
              <Image
                src={featured.cover}
                alt=""
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col items-start justify-center gap-[18px] p-8 md:p-14">
              <PostMeta
                featuredLabel={labels.featuredBadge}
                category={featured.category}
                date={featured.date}
              >
                {featured.displayDate}
              </PostMeta>
              <h2 className="text-3xl leading-[1.2] font-black tracking-[-0.01em] text-brand-navy md:text-4xl md:leading-[1.2]">
                {featured.title}
              </h2>
              <p className="text-[17px] leading-[1.65] text-brand-ink">
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
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
