import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { AuthorBadge } from "@/components/blog/blog-card"
import { ShareLinks } from "@/components/blog/share-links"
import { Container, Eyebrow } from "@/components/home/section"
import {
  allPosts,
  blogFilters,
  posts,
  type Post,
  type PostBlock,
} from "@/components/home/data"

export function ArticleHeader({ post }: { post: Post }) {
  return (
    <section className="bg-brand-surface px-6 py-14 md:px-10 lg:py-[72px]">
      <Container className="flex flex-col items-start gap-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2.5 rounded-full border border-brand-line bg-white px-4 py-2 text-[13px] leading-[normal] font-bold">
            <li>
              <Link href="/" className="text-brand-ink hover:text-brand-navy">
                Home
              </Link>
            </li>
            <li aria-hidden className="text-brand-placeholder">
              /
            </li>
            <li>
              <Link
                href="/blog"
                className="text-brand-ink hover:text-brand-navy"
              >
                Blog
              </Link>
            </li>
            <li aria-hidden className="text-brand-placeholder">
              /
            </li>
            <li aria-current="page" className="text-brand-green-dark">
              {post.category}
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center gap-3 text-sm leading-[normal] font-medium text-brand-muted">
          <span className="rounded-full bg-brand-mint px-3 py-1.5 text-xs leading-[normal] font-bold text-brand-green-dark">
            {post.category}
          </span>
          <time dateTime={post.date}>{post.displayDate}</time>
          {post.readTime && (
            <>
              <span aria-hidden className="font-bold text-brand-placeholder">
                •
              </span>
              <span>{post.readTime}</span>
            </>
          )}
        </div>

        <h1 className="max-w-[960px] text-4xl leading-[1.12] font-black tracking-[-0.015em] text-brand-navy md:text-[56px]">
          {post.title}
        </h1>
        <p className="max-w-[820px] text-lg leading-[1.6] text-brand-ink md:text-xl md:leading-[1.6]">
          {post.lead ?? post.excerpt}
        </p>
        {post.author && <AuthorBadge author={post.author} size="lg" />}

        <div
          data-reveal
          className="relative mt-8 h-72 w-full overflow-hidden rounded-[28px] md:h-[560px]"
        >
          <div
            data-parallax
            className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
          >
            <Image
              src={post.cover}
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

function Block({ block }: { block: PostBlock }) {
  switch (block.type) {
    case "p":
      return <p className={paragraph}>{block.text}</p>
    case "h2":
      return (
        <h2 className="mt-7 text-[26px] leading-[1.25] font-black tracking-[-0.005em] text-brand-navy md:text-[30px]">
          {block.text}
        </h2>
      )
    case "list":
      return (
        <ul className="flex flex-col gap-3.5">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3.5">
              <Image
                src="/images/check.svg"
                alt=""
                width={24}
                height={24}
                className="shrink-0"
              />
              <span className="text-[17px] leading-normal font-medium text-brand-navy">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )
    case "quote":
      return (
        <figure className="flex flex-col gap-3 rounded-[20px] border-l-5 border-brand-green bg-brand-mint px-7 py-8 font-bold md:px-9">
          <blockquote className="text-xl leading-normal text-brand-navy md:text-[22px]">
            “{block.text}”
          </blockquote>
          <figcaption className="text-sm leading-[normal] text-brand-green-dark">
            {block.cite}
          </figcaption>
        </figure>
      )
    case "image":
      return (
        <div className="relative h-64 overflow-hidden rounded-3xl md:h-[400px]">
          <Image
            src={block.src}
            alt={block.alt}
            fill
            sizes="(min-width: 1280px) 776px, 100vw"
            className="object-cover"
          />
        </div>
      )
  }
}

const card =
  "flex flex-col rounded-3xl border border-brand-line bg-white px-6 py-7 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
const cardTitle = "text-xl leading-[normal] font-black text-brand-navy"

export function ArticleBody({ post }: { post: Post }) {
  const recent = posts.filter((p) => p.slug !== post.slug).slice(0, 3)
  const tags = post.tags ?? [post.category]

  return (
    <section className="bg-white px-6 pt-14 pb-20 md:px-10 lg:pt-20 lg:pb-28">
      <Container className="flex flex-col gap-16 lg:flex-row lg:items-start">
        <article className="flex min-w-0 flex-1 flex-col gap-[22px]">
          {(post.body ?? [{ type: "p", text: post.excerpt }]).map(
            (block, i) => (
              <Block key={i} block={block} />
            )
          )}

          <div className="h-px bg-brand-line" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-sm leading-[normal] font-bold text-brand-navy">
                Tags:
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
            <ShareLinks title={post.title} />
          </div>
        </article>

        <aside className="flex w-full flex-col gap-6 lg:w-[360px] lg:shrink-0">
          <div className={`${card} gap-[18px]`}>
            <p className={cardTitle}>Recent Posts</p>
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
                  <time
                    dateTime={item.date}
                    className="text-[13px] leading-[normal] font-medium text-brand-muted"
                  >
                    {item.displayDate}
                  </time>
                </div>
              </Link>
            ))}
          </div>

          <nav aria-label="Categories" className={`${card} gap-1.5`}>
            <p className={`${cardTitle} mb-1.5`}>Categories</p>
            {blogFilters.map((category) => (
              <Link
                key={category}
                href={`/blog?category=${encodeURIComponent(category)}`}
                className="flex items-center justify-between py-3 text-[15px] leading-[normal] font-medium text-brand-navy hover:text-brand-blue"
              >
                {category}
                <span className="rounded-full bg-brand-mint px-2.5 py-[3px] text-xs leading-[normal] font-bold text-brand-green-dark">
                  {allPosts.filter((p) => p.category === category).length}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-col items-start gap-3.5 rounded-3xl bg-brand-blue px-7 py-8">
            <Eyebrow>Need security?</Eyebrow>
            <p className="text-2xl leading-[1.2] font-black text-white">
              Protect your premises after hours
            </p>
            <p className="text-[15px] leading-[1.6] text-white/85">
              Tell us about your site and we&apos;ll come back with a tailored,
              no-obligation quote.
            </p>
            <Link
              href="/contact"
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "w-full"
              )}
            >
              Get a Quote
            </Link>
          </div>
        </aside>
      </Container>
    </section>
  )
}
