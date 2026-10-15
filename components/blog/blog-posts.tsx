"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

import { AuthorBadge, BlogCard, PostMeta } from "@/components/blog/blog-card"
import { Container } from "@/components/home/section"
import { blogFilters, featuredPost, posts } from "@/components/home/data"
import { cn } from "@/lib/utils"

const ALL = "All Posts"
const PAGE_SIZE = 6

const pill =
  "rounded-full px-[22px] py-3 text-[15px] leading-[normal] font-bold transition-colors"
const pageButton =
  "flex size-12 items-center justify-center rounded-full text-base leading-[normal] font-bold transition-colors"

export function BlogPosts({ initialCategory }: { initialCategory?: string }) {
  const [category, setCategory] = useState(
    initialCategory && blogFilters.includes(initialCategory)
      ? initialCategory
      : ALL
  )
  const [page, setPage] = useState(1)
  const sectionRef = useRef<HTMLElement>(null)

  const filtered =
    category === ALL ? posts : posts.filter((p) => p.category === category)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const showFeatured =
    page === 1 && (category === ALL || category === featuredPost.category)

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
          aria-label="Filter posts by category"
          className="flex flex-wrap gap-3"
        >
          {[ALL, ...blogFilters].map((item) => {
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
                src={featuredPost.cover}
                alt=""
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col items-start justify-center gap-[18px] p-8 md:p-14">
              <PostMeta
                featured
                category={featuredPost.category}
                date={featuredPost.date}
              >
                {featuredPost.displayDate}
              </PostMeta>
              <h2 className="text-3xl leading-[1.2] font-black tracking-[-0.01em] text-brand-navy md:text-4xl md:leading-[1.2]">
                {featuredPost.title}
              </h2>
              <p className="text-[17px] leading-[1.65] text-brand-ink">
                {featuredPost.excerpt}
              </p>
              {featuredPost.author && (
                <AuthorBadge author={featuredPost.author} />
              )}
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="pt-1.5 text-base leading-[normal] font-bold whitespace-pre text-brand-blue hover:underline"
              >
                {"Read Article  →"}
              </Link>
            </div>
          </article>
        )}

        {visible.length > 0 ? (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) => (
              <li key={post.slug}>
                <BlogCard post={post} />
              </li>
            ))}
          </ul>
        ) : (
          !showFeatured && (
            <p className="rounded-3xl border border-brand-line bg-white px-8 py-16 text-center text-lg text-brand-ink">
              No posts in {category} yet. Check back soon.
            </p>
          )
        )}

        <nav
          aria-label="Pagination"
          className="flex items-center justify-center gap-2.5"
        >
          <button
            type="button"
            aria-label="Previous page"
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
              aria-label={`Page ${n}`}
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
            aria-label="Next page"
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
