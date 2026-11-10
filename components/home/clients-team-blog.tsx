import { Mail } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { ScrollDots } from "@/components/home/scroll-dots"
import { ClientsCarousel } from "@/components/home/clients-carousel"
import { Container, SectionHeading } from "@/components/home/section"
import { cn } from "@/lib/utils"
import { BlogCard, type BlogCardPost } from "@/components/blog/blog-card"

export type ClientsProps = {
  eyebrow: string
  heading: string
  clients: { name: string; logo: string }[]
}

export function Clients({ eyebrow, heading, clients }: ClientsProps) {
  return (
    // No side padding on the section: the strip runs the full width of the
    // page; only the heading keeps the page margins.
    <section className="bg-brand-surface py-14 md:py-20 lg:py-24">
      <div className="px-5 md:px-10">
        <Container>
          <SectionHeading eyebrow={eyebrow} title={heading} />
        </Container>
      </div>
      {/* Phones: a static two-column grid. Wider screens: the drifting strip. */}
      <ul className="mt-6 grid grid-cols-2 gap-3 px-5 md:hidden">
        {clients.map((client) => (
          <li
            key={client.name}
            className="flex h-[84px] items-center justify-center rounded-2xl border border-brand-line bg-white px-4 py-3"
          >
            <div className="relative h-14 w-full max-w-[118px]">
              <Image
                src={client.logo}
                alt={client.name}
                fill
                sizes="118px"
                className="object-contain"
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="max-md:hidden">
        <ClientsCarousel label={heading} clients={clients} />
      </div>
    </section>
  )
}

export type TeamProps = {
  eyebrow: string
  title: string
  description: string
  /** Shown behind each member photo (pages.team.leadership.photoPlaceholder). */
  photoPlaceholder: string
  /** Phones: stack the cards (team page) instead of a swipe strip (home). */
  stack?: boolean
  members: {
    name: string
    role: string
    bio: string
    email: string
    photo: string | null
  }[]
}

export function Team({
  eyebrow,
  title,
  description,
  photoPlaceholder,
  stack = false,
  members,
}: TeamProps) {
  return (
    <section
      id="team"
      className="scroll-mt-28 bg-white py-14 md:px-10 md:py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-6 md:gap-14">
        <SectionHeading
          className="px-5 md:px-0"
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
        <ul
          id="team-list"
          data-team-list
          className={cn(
            "flex [scrollbar-width:none] gap-4 px-5 pb-1 sm:grid sm:snap-none sm:gap-6 sm:overflow-visible sm:px-5 sm:pb-0 md:px-0 lg:grid-cols-2 [&::-webkit-scrollbar]:hidden",
            stack ? "flex-col" : "snap-x snap-mandatory overflow-x-auto"
          )}
        >
          {members.map((member) => (
            <li
              key={member.name}
              data-card="dark"
              className={cn(
                "flex shrink-0 snap-center flex-col overflow-hidden rounded-3xl bg-brand-blue shadow-[0px_20px_40px_0px_rgba(0,0,0,0.18)] transition-shadow duration-300 ease-out hover:shadow-[0px_30px_56px_0px_rgba(0,0,0,0.3)] sm:h-[320px] sm:w-auto sm:shrink sm:flex-row",
                stack ? "w-full" : "w-[300px]"
              )}
            >
              <div className="relative h-60 shrink-0 overflow-hidden sm:h-72 sm:h-full sm:w-[240px]">
                <div
                  data-parallax
                  className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
                >
                  <Image
                    src={photoPlaceholder}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 240px, 100vw"
                    className="object-cover"
                  />
                  {member.photo && (
                    <Image
                      src={member.photo}
                      alt={member.name}
                      fill
                      sizes="(min-width: 640px) 240px, 100vw"
                      className="object-cover"
                    />
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 px-[22px] pt-[22px] pb-6 sm:gap-3.5 sm:px-8 sm:pt-8 sm:pb-7">
                <div className="flex flex-col gap-1 sm:pt-1.5">
                  <h3 className="text-xl leading-[25px] font-black text-white sm:text-[22px] sm:leading-[normal]">
                    {member.name}
                  </h3>
                  <p className="text-[13px] leading-[17px] font-bold tracking-[0.02em] text-brand-green sm:text-sm sm:leading-[normal]">
                    {member.role}
                  </p>
                </div>
                <p className="text-sm leading-[21px] text-white/82 sm:text-[15px] sm:leading-[1.6]">
                  {member.bio}
                </p>
                <div className="flex-1" />
                <div className="h-px bg-white/20" />
                <a
                  href={`mailto:${member.email}`}
                  className="flex items-center gap-2 text-[13px] leading-[normal] font-medium break-all text-white hover:underline"
                >
                  <Mail aria-hidden className="size-4 shrink-0 sm:hidden" />
                  {member.email}
                </a>
              </div>
            </li>
          ))}
        </ul>
        {stack ? null : <ScrollDots targetId="team-list" />}
      </Container>
    </section>
  )
}

export type BlogProps = {
  eyebrow: string
  heading: string
  intro: string
  cta: { label: string; href: string }
  posts: BlogCardPost[]
  readArticle: string
}

export function Blog({
  eyebrow,
  heading,
  intro,
  cta,
  posts,
  readArticle,
}: BlogProps) {
  return (
    <section
      id="blog"
      className="scroll-mt-28 bg-brand-surface px-5 py-14 md:px-10 md:py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-6 md:gap-14">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            align="start"
            eyebrow={eyebrow}
            title={heading}
            description={intro}
            className="max-w-[640px]"
          />
          <Link
            href={cta.href}
            data-reveal
            className={buttonClassName(
              { variant: "brand-outline-blue", size: "pill-sm" },
              "max-md:hidden"
            )}
          >
            {`${cta.label} `}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <ul data-stagger className="grid gap-3 md:grid-cols-3 md:gap-6">
          {posts.map((post, i) => (
            <li key={post.slug}>
              <BlogCard post={post} readArticle={readArticle} compact={i > 0} />
            </li>
          ))}
        </ul>
        <Link
          href={cta.href}
          className={buttonClassName(
            { variant: "brand-outline-blue", size: "pill-sm" },
            "h-[52px] w-full py-0 md:hidden"
          )}
        >
          {cta.label}
        </Link>
      </Container>
    </section>
  )
}
