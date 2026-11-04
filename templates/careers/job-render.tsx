import { ArrowRight, Briefcase, Clock, Euro, Info, MapPin } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Fragment } from "react"

import { JobMeta, JobTags } from "@/components/careers/job-card"
import {
  BeforeYouApply,
  CheckList,
  JobQuestions,
  JobSummary,
} from "@/components/careers/job-summary"
import { OfferIcon } from "@/components/careers/offer-icon"
import { ShareButton } from "@/components/careers/share-button"
import { Container, SectionHeading } from "@/components/home/section"
import { HomeMotion } from "@/components/motion/home-motion"
import { buttonClassName } from "@/components/ui/button"
import { renderInline } from "@/lib/rich-text/render"
import { cn } from "@/lib/utils"

import type { JobHeroTag, JobView } from "./job-view"
import type { JobCardView } from "./view"

function HeroTag({ tag }: { tag: JobHeroTag }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs leading-none font-bold",
        tag.tone === "category"
          ? "bg-white/15 text-white"
          : tag.tone === "urgent"
            ? "bg-amber-100 text-amber-800"
            : tag.tone === "closed"
              ? "bg-white/85 text-brand-muted"
              : "bg-white text-brand-green-dark"
      )}
    >
      {tag.tone !== "category" && (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            tag.tone === "urgent"
              ? "bg-amber-600"
              : tag.tone === "closed"
                ? "bg-brand-muted"
                : "bg-brand-green"
          )}
        />
      )}
      {tag.label}
    </span>
  )
}

/** Job hero (549:302): the page hero's photo and trail, the role's tags, facts and actions. */
function JobHero({ view }: { view: JobView }) {
  const hero = view.hero
  const meta = [
    { icon: MapPin, text: hero.meta.location },
    { icon: Briefcase, text: hero.meta.employmentType },
    { icon: Clock, text: hero.meta.shift },
    { icon: Euro, text: hero.meta.pay },
  ]
  return (
    <section
      data-hero
      className="relative overflow-hidden px-6 pt-20 pb-24 md:px-10 lg:pt-28 lg:pb-30"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div data-hero-media className="absolute inset-0 will-change-transform">
          <Image
            src={hero.image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-r from-[rgba(13,27,54,0.92)] via-[rgba(13,27,54,0.6)] via-55% to-[rgba(13,27,54,0.1)] max-lg:to-[rgba(13,27,54,0.6)]" />
      </div>

      <Container className="relative">
        <div data-hero-content className="flex flex-col items-start gap-[22px]">
          <nav
            data-hero-item
            aria-label={hero.ariaLabel}
            className="max-w-full"
          >
            <ol className="flex flex-wrap items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] leading-[normal] font-bold">
              <li>
                <Link href="/" className="text-white/85 hover:text-white">
                  {hero.homeLabel}
                </Link>
              </li>
              {hero.trail.map((item) => (
                <Fragment key={item.href}>
                  <li aria-hidden className="text-white/50">
                    /
                  </li>
                  <li>
                    <Link
                      href={item.href}
                      className="text-white/85 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                </Fragment>
              ))}
              <li aria-hidden className="text-white/50">
                /
              </li>
              <li aria-current="page" className="text-brand-green">
                {hero.crumb}
              </li>
            </ol>
          </nav>
          <div data-hero-item className="flex flex-wrap gap-2">
            {hero.tags.map((tag) => (
              <HeroTag key={tag.label} tag={tag} />
            ))}
          </div>
          <h1
            data-hero-title
            className="max-w-[820px] text-[40px] leading-[1.1] font-black tracking-[-0.01em] text-white md:text-[64px]"
          >
            {hero.title}
          </h1>
          <p
            data-hero-item
            className="max-w-[640px] text-lg leading-[1.6] text-white/85 md:text-[19px]"
          >
            {hero.summary}
          </p>
          <ul data-hero-item className="flex flex-wrap gap-2.5">
            {meta.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
          <div
            data-hero-item
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
          >
            {view.applyHref && (
              <Link
                href={view.applyHref}
                className={buttonClassName(
                  { variant: "brand", size: "pill" },
                  "gap-2.5 max-sm:w-full"
                )}
              >
                {hero.applyLabel}
                <ArrowRight aria-hidden className="size-[18px]" />
              </Link>
            )}
            <ShareButton
              path={view.path}
              title={hero.title}
              label={view.share.label}
              copiedLabel={view.share.copiedLabel}
              className={buttonClassName(
                { variant: "brand-outline", size: "pill" },
                "flex-row-reverse gap-2.5 max-sm:w-full"
              )}
            />
          </div>
        </div>
      </Container>
    </section>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[28px] leading-[1.25] font-black text-brand-navy md:text-[30px]">
      {children}
    </h2>
  )
}

function RequirementCard({
  label,
  tag,
  items,
  tone,
}: {
  label: string
  tag: string
  items: string[]
  tone: "essential" | "desirable"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-3xl border border-brand-line p-6 md:p-7",
        tone === "essential" ? "bg-white" : "bg-brand-surface"
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="text-xl font-black text-brand-navy">{label}</h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs leading-none font-bold",
            tone === "essential"
              ? "bg-brand-mint text-brand-green-dark"
              : "bg-brand-line/70 text-brand-muted"
          )}
        >
          {tone === "desirable" && (
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-brand-muted"
            />
          )}
          {tag}
        </span>
      </div>
      <CheckList items={items} className="gap-3.5 text-base" />
    </div>
  )
}

function JobBody({ view }: { view: JobView }) {
  return (
    <section className="bg-white px-6 py-20 md:px-10 lg:py-28">
      <Container className="grid gap-12 lg:grid-cols-[minmax(0,760px)_384px] lg:justify-between lg:gap-14">
        <div className="flex min-w-0 flex-col gap-12">
          {view.closedNotice && (
            <p
              role="status"
              className="flex items-start gap-3 rounded-2xl border border-brand-line bg-brand-surface px-5 py-4 text-base leading-normal text-brand-ink"
            >
              <Info
                aria-hidden
                className="mt-0.5 size-[22px] shrink-0 text-brand-blue"
              />
              <span>
                {view.closedNotice}{" "}
                <Link
                  href="/careers"
                  className="font-bold text-brand-blue hover:underline"
                >
                  {view.similarCopy.viewAllLabel}
                </Link>
              </span>
            </p>
          )}
          <div data-stagger className="flex flex-col gap-5">
            <Heading>{view.about.heading}</Heading>
            {view.about.body.content.map((paragraph, i) => (
              <p key={i} className="text-[17px] leading-[1.65] text-brand-ink">
                {renderInline(paragraph.content)}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-5">
            <Heading>{view.responsibilities.heading}</Heading>
            <CheckList
              items={view.responsibilities.items}
              className="gap-3.5 text-[17px]"
            />
          </div>
          <div className="flex flex-col gap-5">
            <Heading>{view.lookingFor.heading}</Heading>
            <div className="grid gap-5 md:grid-cols-2">
              <RequirementCard
                tone="essential"
                {...view.lookingFor.essential}
              />
              {view.lookingFor.desirable && (
                <RequirementCard
                  tone="desirable"
                  {...view.lookingFor.desirable}
                />
              )}
            </div>
          </div>
          {view.offer && (
            <div className="flex flex-col gap-5">
              <Heading>{view.offer.heading}</Heading>
              {view.offer.intro && (
                <p className="text-[17px] leading-normal text-brand-ink">
                  {view.offer.intro}
                </p>
              )}
              <ul className="grid gap-4 sm:grid-cols-2">
                {view.offer.items.map((item) => (
                  <li
                    key={item.text}
                    data-card="light"
                    className="flex items-center gap-3.5 rounded-2xl border border-brand-line bg-white p-3.5 pr-4 transition-[border-color,box-shadow] duration-300 hover:border-brand-blue/40 hover:shadow-[0px_12px_30px_0px_rgba(13,26,51,0.08)]"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-mint text-brand-green">
                      <OfferIcon name={item.icon} className="size-[19px]" />
                    </span>
                    <span className="text-base font-bold text-brand-navy">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="flex items-start gap-3.5 rounded-2xl border border-brand-green/30 bg-brand-mint px-5 py-5 text-[15px] leading-[1.6] text-brand-ink md:px-6">
            <Info
              aria-hidden
              className="mt-0.5 size-[22px] shrink-0 text-brand-green"
            />
            <span>{view.equalOpportunity}</span>
          </p>
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <JobSummary view={view} />
          <JobQuestions view={view.questions} />
          <BeforeYouApply view={view.beforeYouApply} />
        </aside>
      </Container>
    </section>
  )
}

/** A similar role (549:782): a compact card. */
function SimilarJobCard({
  job,
  viewJobLabel,
}: {
  job: JobCardView
  viewJobLabel: string
}) {
  return (
    <li
      data-card="light"
      className="group relative flex flex-col gap-4 rounded-3xl border border-brand-line bg-white p-7 shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)] transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1"
    >
      <JobTags category={job.category} tag={job.tag} />
      <h3 className="text-xl leading-[1.3] font-black text-brand-navy">
        <Link
          href={job.href}
          className="outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {job.title}
        </Link>
      </h3>
      <JobMeta
        job={{ ...job, shift: "" }}
        className="flex-col gap-y-2.5 text-[15px]"
      />
      <hr className="mt-auto border-brand-line" />
      <span
        aria-hidden
        className="inline-flex items-center gap-2 text-[15px] font-bold text-brand-blue"
      >
        {viewJobLabel}
        <ArrowRight
          aria-hidden
          className="size-[18px] transition-transform group-hover:translate-x-1"
        />
      </span>
    </li>
  )
}

function SimilarRoles({ view }: { view: JobView }) {
  const copy = view.similarCopy
  return (
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            align="start"
            eyebrow={copy.eyebrow}
            title={copy.heading}
          />
          <Link
            href={copy.viewAllHref}
            className={buttonClassName(
              { variant: "brand-outline-blue", size: "pill" },
              "gap-2.5 max-md:w-full"
            )}
          >
            {copy.viewAllLabel}
            <ArrowRight aria-hidden className="size-[18px]" />
          </Link>
        </div>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {view.similar.map((job) => (
            <SimilarJobCard
              key={job.slug}
              job={job}
              viewJobLabel={copy.viewJobLabel}
            />
          ))}
        </ul>
      </Container>
    </section>
  )
}

/** "/careers/<slug>" (Figma 549:285). */
export function JobDetailTemplate({ view }: { view: JobView }) {
  return (
    <>
      <main>
        <JobHero view={view} />
        <JobBody view={view} />
        {view.similar.length > 0 && <SimilarRoles view={view} />}
      </main>
      <HomeMotion />
    </>
  )
}
