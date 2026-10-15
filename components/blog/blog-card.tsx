import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

/** An article as cards and lists show it (dates already formatted). */
export type BlogCardPost = {
  slug: string
  title: string
  excerpt: string
  category: string
  /** "2026-09-20" for <time dateTime>; null: no date shown (never published). */
  date: string | null
  /** "20 Sep 2026"; null with `date`. */
  displayDate: string | null
  cover: string
}

export type Author = { name: string; role: string }

export function BlogCard({
  post,
  readArticle,
}: {
  post: BlogCardPost
  readArticle: string
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-brand-line bg-white shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)]">
      <div className="relative h-[230px] shrink-0 overflow-hidden">
        <Image
          src={post.cover}
          alt=""
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col items-start gap-3.5 px-7 pt-7 pb-8">
        <PostMeta category={post.category} date={post.date}>
          {post.displayDate}
        </PostMeta>
        <h3 className="text-[22px] leading-[1.3] font-black text-brand-navy">
          {post.title}
        </h3>
        <p className="text-[15px] leading-[1.6] text-brand-ink">
          {post.excerpt}
        </p>
        <Link
          href={`/blog/${post.slug}`}
          className="pt-1 text-[15px] leading-[normal] font-bold whitespace-pre text-brand-blue hover:underline"
        >
          {readArticle}
        </Link>
      </div>
    </article>
  )
}

export function PostMeta({
  category,
  date,
  featuredLabel,
  children,
}: {
  category: string
  /** null: the date is omitted. */
  date: string | null
  /** Shows the "Featured" badge when set. */
  featuredLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 leading-[normal]">
      {featuredLabel && (
        <span className="rounded-full bg-brand-blue px-3 py-1.5 text-xs leading-[normal] font-bold text-white">
          {featuredLabel}
        </span>
      )}
      <span className="rounded-full bg-brand-mint px-3 py-1.5 text-xs leading-[normal] font-bold text-brand-green-dark">
        {category}
      </span>
      {date && (
        <time
          dateTime={date}
          className="text-[13px] font-medium text-brand-muted"
        >
          {children}
        </time>
      )}
    </div>
  )
}

export function AuthorBadge({
  author,
  size = "sm",
}: {
  author: Author
  size?: "sm" | "lg"
}) {
  const initials = author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
  const lg = size === "lg"

  return (
    <div
      className={cn(
        "flex items-center leading-[normal]",
        lg ? "gap-3.5" : "gap-3"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-full bg-brand-blue font-bold text-white",
          lg ? "size-[52px] text-[17px]" : "size-11 text-[15px]"
        )}
      >
        {initials}
      </span>
      <div className="flex flex-col gap-0.5">
        <p
          className={cn(
            "font-bold text-brand-navy",
            lg ? "text-base leading-[normal]" : "text-[15px]"
          )}
        >
          {author.name}
        </p>
        <p
          className={cn(
            "text-brand-muted",
            lg ? "text-sm leading-[normal]" : "text-[13px]"
          )}
        >
          {author.role}
        </p>
      </div>
    </div>
  )
}
