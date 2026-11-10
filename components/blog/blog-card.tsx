import { ArrowRight } from "lucide-react"
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
  compact = false,
}: {
  post: BlogCardPost
  readArticle: string
  /** On phones, shows a small row (thumbnail + title) instead of the card. */
  compact?: boolean
}) {
  return (
    <>
      {compact && <BlogRow post={post} />}
      <article
        data-card="light"
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-[20px] border border-brand-line bg-white shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)] transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1 md:rounded-3xl",
          compact && "max-md:hidden"
        )}
      >
        <div className="relative h-[170px] shrink-0 overflow-hidden md:h-[230px]">
          <Image
            src={post.cover}
            alt=""
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col items-start gap-2.5 px-[18px] pt-[18px] pb-5 md:gap-3.5 md:px-7 md:pt-7 md:pb-8">
          <PostMeta category={post.category} date={post.date}>
            {post.displayDate}
          </PostMeta>
          <h3 className="text-lg leading-[23px] font-black text-brand-navy group-hover:bg-linear-to-r group-hover:from-brand-green group-hover:to-brand-blue group-hover:bg-clip-text group-hover:text-transparent md:text-[22px] md:leading-[1.3]">
            {post.title}
          </h3>
          <p className="text-sm leading-[21px] text-brand-ink md:text-[15px] md:leading-[1.6]">
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
    </>
  )
}

function BlogRow({ post }: { post: BlogCardPost }) {
  return (
    <article
      data-card="light"
      className="flex items-center gap-3.5 rounded-[18px] border border-brand-line bg-white p-3 md:hidden"
    >
      <div className="relative size-[88px] shrink-0 overflow-hidden rounded-xl">
        <Image
          src={post.cover}
          alt=""
          fill
          sizes="88px"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <PostMeta category={post.category} date={post.date}>
          {post.displayDate}
        </PostMeta>
        <h3 className="text-[15px] leading-5 font-black text-brand-navy">
          {post.title}
        </h3>
        <Link
          href={`/blog/${post.slug}`}
          className="flex items-center gap-1.5 text-[13px] font-bold text-brand-blue"
        >
          Read
          <ArrowRight aria-hidden className="size-3.5" />
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
    <div className="flex flex-wrap items-center gap-2.5 leading-[normal] md:gap-3">
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
