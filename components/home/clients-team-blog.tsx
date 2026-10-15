import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { Container, SectionHeading } from "@/components/home/section"
import { BlogCard } from "@/components/blog/blog-card"
import { clients, posts, team } from "@/components/home/data"

export function Clients() {
  return (
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-24">
      <Container className="flex flex-col gap-14">
        <SectionHeading eyebrow="Trusted by" title="Our Clients" />
        <ul data-stagger className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {clients.map((client) => (
            <li
              key={client.name}
              className="flex h-[120px] items-center justify-center rounded-[20px] border border-brand-line bg-white px-7 py-5"
            >
              <div className="relative h-[76px] w-[200px] max-w-full">
                <Image
                  src={client.logo}
                  alt={client.name}
                  fill
                  sizes="200px"
                  className="object-contain"
                />
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function Team({
  title = "Meet The Team",
  description = "The people behind Security Partners.",
}: {
  title?: string
  description?: string
}) {
  return (
    <section
      id="team"
      className="scroll-mt-28 bg-white px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow="Our people"
          title={title}
          description={description}
        />
        <ul data-stagger className="grid gap-6 lg:grid-cols-2">
          {team.map((member) => (
            <li
              key={member.name}
              className="flex flex-col overflow-hidden rounded-3xl bg-brand-blue shadow-[0px_20px_40px_0px_rgba(0,0,0,0.18)] sm:h-[320px] sm:flex-row"
            >
              {/* Temporary photo: both layers come from the design. */}
              <div className="relative h-72 shrink-0 overflow-hidden sm:h-full sm:w-[240px]">
                <div
                  data-parallax
                  className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
                >
                  <Image
                    src="/images/team-temp.jpg"
                    alt=""
                    fill
                    sizes="(min-width: 640px) 240px, 100vw"
                    className="object-cover"
                  />
                  <Image
                    src="/images/about.png"
                    alt={member.name}
                    fill
                    sizes="(min-width: 640px) 240px, 100vw"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3.5 px-8 pt-8 pb-7">
                <div className="flex flex-col gap-1 pt-1.5">
                  <h3 className="text-[22px] leading-[normal] font-black text-white">
                    {member.name}
                  </h3>
                  <p className="text-sm leading-[normal] font-bold tracking-[0.02em] text-brand-green">
                    {member.role}
                  </p>
                </div>
                <p className="text-[15px] leading-[1.6] text-white/82">
                  {member.bio}
                </p>
                <div className="flex-1" />
                <div className="h-px bg-white/20" />
                <a
                  href={`mailto:${member.email}`}
                  className="text-[13px] leading-[normal] font-medium break-all text-white hover:underline"
                >
                  {member.email}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function Blog() {
  return (
    <section
      id="blog"
      className="scroll-mt-28 bg-brand-surface px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-14">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            align="start"
            eyebrow="News & insights"
            title="From Our Blog"
            description="Security tips, company news and advice from the Security Partners team."
            className="max-w-[640px]"
          />
          <Link
            href="/blog"
            data-reveal
            className={buttonClassName({
              variant: "brand-outline-blue",
              size: "pill-sm",
            })}
          >
            View All Posts <span aria-hidden>→</span>
          </Link>
        </div>

        <ul data-stagger className="grid gap-6 md:grid-cols-3">
          {posts.slice(0, 3).map((post) => (
            <li key={post.slug}>
              <BlogCard post={post} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
