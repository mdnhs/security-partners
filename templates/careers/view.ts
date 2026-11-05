import type { PageHeroProps } from "@/components/home/page-hero"
import { openJobs, previousJobs } from "@/lib/careers/open"
import { formatPostDate } from "@/lib/format"
import { interpolate } from "@/lib/interpolate"
import type { Link } from "@/lib/schemas/common"
import { jobPath } from "@/lib/schemas/api/jobs"
import type { JobRecord } from "@/server/modules/jobs-board/queries"
import type { SiteSources } from "@/templates/shared/sources"
import { linkView, pageHeroView } from "@/templates/shared/views"

export type JobTag = { label: string; tone: "open" | "urgent" | "closed" }

/** One job as a listing card (open positions, previous openings, similar roles). */
export type JobCardView = {
  slug: string
  href: string
  category: string
  tag: JobTag
  title: string
  location: string
  employmentType: string
  shift: string
  pay: string
  licence: string
  /** "Posted 2 days ago" (open jobs). */
  posted: string
  /** "Closed on 20 Sep 2026" (previous openings). */
  closedOn: string
  filledLabel: string
}

export type CareersView = {
  hero: PageHeroProps
  whyJoin: {
    eyebrow: string
    title: string
    description: string
    cards: { title: string; description: string; icon: string }[]
  }
  openings: {
    eyebrow: string
    title: string
    description: string
    countLabel: string
    searchPlaceholder: string
    allLocations: string
    allLicenceTypes: string
    allRolesLabel: string
    viewJobLabel: string
    jobs: JobCardView[]
    categories: { label: string; count: number }[]
    locations: string[]
    licences: string[]
    empty: { title: string; text: string }
  }
  previous: {
    eyebrow: string
    title: string
    description: string
    jobs: JobCardView[]
  } | null
  process: {
    eyebrow: string
    title: string
    description: string
    steps: { number: string; title: string; description: string }[]
  }
  cta: {
    eyebrow: string
    heading: string
    copy: string
    primary: Link
    secondary: Link
  }
}

const DAY = 86_400_000

/** "today", "1 day ago", "5 days ago", "1 week ago", "3 weeks ago", "2 months ago". */
export function postedAgo(at: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - at.getTime()) / DAY))
  const unit = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"} ago`
  if (days === 0) return "today"
  if (days < 7) return unit(days, "day")
  if (days < 30) return unit(Math.floor(days / 7), "week")
  if (days < 365) return unit(Math.floor(days / 30), "month")
  return unit(Math.floor(days / 365), "year")
}

const distinct = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b))

/** A job's card, the same everywhere it is listed. */
export function jobCardView(
  s: SiteSources,
  job: JobRecord,
  now: Date,
  open: boolean
): JobCardView {
  const page = s.pages.careers.data
  const c = job.content
  const [y, m, d] = c.closingDate.split("-").map(Number)
  return {
    slug: job.slug,
    href: jobPath(job.slug),
    category: c.category,
    tag: !open
      ? { label: page.tags.closed, tone: "closed" }
      : c.urgent
        ? { label: page.tags.urgent, tone: "urgent" }
        : { label: page.tags.open, tone: "open" },
    title: c.title,
    location: c.location,
    employmentType: c.employmentType,
    shift: c.shift,
    pay: c.pay,
    licence: c.licence,
    posted: interpolate(page.openings.postedLabel, {
      ago: postedAgo(job.publishedAt ?? now, now),
    }),
    closedOn: interpolate(page.previous.closedOnLabel, {
      // A calendar date (open/closed is decided on the Irish calendar), so
      // it is read in UTC: no site time zone can move it to another day.
      date: formatPostDate(new Date(Date.UTC(y, m - 1, d)), "UTC"),
    }),
    filledLabel: page.previous.filledLabel,
  }
}

/** "/careers": `jobs` are every published job; open/closed is decided at `now`. */
export function careersView(
  s: SiteSources,
  jobs: readonly JobRecord[],
  now: Date
): CareersView {
  const page = s.pages.careers.data
  const open = openJobs(jobs, now)
  const previous = previousJobs(jobs, now)
  const counts = new Map<string, number>()
  for (const job of open)
    counts.set(
      job.content.category,
      (counts.get(job.content.category) ?? 0) + 1
    )
  return {
    hero: pageHeroView(s, page.hero),
    whyJoin: {
      eyebrow: page.whyJoin.eyebrow,
      title: page.whyJoin.title,
      description: page.whyJoin.description,
      cards: page.whyJoin.cards.map((card) => ({
        title: card.title,
        description: card.description,
        icon: card.icon.url,
      })),
    },
    openings: {
      eyebrow: page.openings.eyebrow,
      title: page.openings.title,
      description: page.openings.description,
      countLabel: interpolate(page.openings.countLabel, { count: open.length }),
      searchPlaceholder: page.openings.searchPlaceholder,
      allLocations: page.openings.allLocations,
      allLicenceTypes: page.openings.allLicenceTypes,
      allRolesLabel: interpolate(page.openings.allRoles, {
        count: open.length,
      }),
      viewJobLabel: page.openings.viewJobLabel,
      jobs: open.map((job) => jobCardView(s, job, now, true)),
      // In listing order (Map keeps first appearance: the newest role first).
      categories: [...counts.keys()].map((label) => ({
        label,
        count: counts.get(label)!,
      })),
      locations: distinct(open.map((job) => job.content.location)),
      licences: distinct(open.map((job) => job.content.licence)),
      empty: { title: page.openings.emptyTitle, text: page.openings.emptyText },
    },
    previous:
      previous.length === 0
        ? null
        : {
            eyebrow: page.previous.eyebrow,
            title: page.previous.title,
            description: page.previous.description,
            jobs: previous.map((job) => jobCardView(s, job, now, false)),
          },
    process: {
      eyebrow: page.process.eyebrow,
      title: page.process.title,
      description: page.process.description,
      steps: page.process.steps.map((step, i) => ({
        number: String(i + 1).padStart(2, "0"),
        title: step.title,
        description: step.description,
      })),
    },
    cta: {
      eyebrow: page.cta.eyebrow,
      heading: page.cta.heading,
      copy: page.cta.copy,
      primary: linkView(s, page.cta.primary),
      secondary: linkView(s, page.cta.secondary),
    },
  }
}
