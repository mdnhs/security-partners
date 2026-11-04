import { isOpen, openJobs } from "@/lib/careers/open"
import { interpolate } from "@/lib/interpolate"
import type { ParagraphsDoc } from "@/lib/schemas/common"
import type { OfferIcon } from "@/lib/schemas/content/job"
import { jobApplyPath, jobPath } from "@/lib/schemas/api/jobs"
import type { JobRecord } from "@/server/modules/jobs-board/queries"
import type { SiteSources } from "@/templates/shared/sources"
import { placeholders } from "@/templates/shared/views"

import { type JobCardView, jobCardView } from "./view"

export type JobHeroTag = {
  label: string
  tone: "open" | "urgent" | "closed" | "category"
}

export type SummaryIcon =
  "hash" | "mapPin" | "briefcase" | "clock" | "euro" | "calendar"

/** "/careers/<slug>" (Figma 549:285). */
export type JobView = {
  slug: string
  open: boolean
  /** The application form; null once the role has closed. */
  applyHref: string | null
  /** Shown instead of Apply when the role has closed. */
  closedNotice: string | null
  /** Site path of this page (Share copies its absolute address). */
  path: string
  hero: {
    image: string
    homeLabel: string
    ariaLabel: string
    trail: { label: string; href: string }[]
    crumb: string
    tags: JobHeroTag[]
    title: string
    summary: string
    meta: {
      location: string
      employmentType: string
      shift: string
      pay: string
    }
    applyLabel: string
  }
  share: { label: string; copiedLabel: string }
  about: { heading: string; body: ParagraphsDoc }
  responsibilities: { heading: string; items: string[] }
  lookingFor: {
    heading: string
    essential: { label: string; tag: string; items: string[] }
    desirable: { label: string; tag: string; items: string[] } | null
  }
  offer: {
    heading: string
    intro: string
    items: { icon: OfferIcon; text: string }[]
  } | null
  equalOpportunity: string
  summary: {
    heading: string
    rows: { icon: SummaryIcon; label: string; value: string }[]
    applyLabel: string
    shareLabel: string
  }
  questions: {
    heading: string
    copy: string
    phone: string
    phoneHref: string
    email: string
  }
  beforeYouApply: { heading: string; intro: string; items: string[] }
  similarCopy: {
    eyebrow: string
    heading: string
    viewAllLabel: string
    viewAllHref: string
    viewJobLabel: string
  }
  /** Up to 3 open roles: same category first, then newest; never this one. */
  similar: JobCardView[]
}

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** "2026-11-30" → "30 November 2026" (a calendar date: no time zone involved). */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return `${d} ${LONG_MONTHS[m - 1]} ${y}`
}

/** `job` at `now`; `all` are the published jobs (similar roles come from them). */
export function jobView(
  s: SiteSources,
  job: JobRecord,
  all: readonly JobRecord[],
  now: Date
): JobView {
  const page = s.pages.careers.data
  const copy = page.job
  const c = job.content
  const open = isOpen(c, now)
  const values = placeholders(s)
  const similar = openJobs(
    all.filter((other) => other.slug !== job.slug),
    now
  )
    // openJobs is newest first; a stable sort keeps that within each group.
    .sort(
      (a, b) =>
        Number(b.content.category === c.category) -
        Number(a.content.category === c.category)
    )
    .slice(0, 3)
  const status: JobHeroTag = !open
    ? { label: page.tags.closed, tone: "closed" }
    : c.urgent
      ? { label: page.tags.urgent, tone: "urgent" }
      : { label: page.tags.nowHiring, tone: "open" }
  return {
    slug: job.slug,
    open,
    applyHref: open ? jobApplyPath(job.slug) : null,
    closedNotice: open ? null : copy.closedNotice,
    path: jobPath(job.slug),
    hero: {
      image: page.hero.image.url,
      homeLabel: s.settings.microcopy.breadcrumb.home,
      ariaLabel: s.settings.microcopy.aria.breadcrumb,
      trail: [{ label: page.hero.crumb, href: "/careers" }],
      crumb: c.title,
      tags: [status, { label: c.category, tone: "category" }],
      title: c.title,
      summary: c.summary,
      meta: {
        location: c.location,
        employmentType: c.employmentType,
        shift: c.shift,
        pay: c.pay,
      },
      applyLabel: copy.applyLabel,
    },
    share: { label: copy.shareLabel, copiedLabel: copy.copiedLabel },
    about: { heading: copy.aboutHeading, body: c.about },
    responsibilities: {
      heading: copy.responsibilitiesHeading,
      items: c.responsibilities,
    },
    lookingFor: {
      heading: copy.lookingForHeading,
      essential: {
        label: copy.essentialLabel,
        tag: copy.essentialTag,
        items: c.essential,
      },
      desirable:
        c.desirable.length === 0
          ? null
          : {
              label: copy.desirableLabel,
              tag: copy.desirableTag,
              items: c.desirable,
            },
    },
    offer:
      c.offers.length === 0
        ? null
        : { heading: copy.offerHeading, intro: c.offerIntro, items: c.offers },
    equalOpportunity: interpolate(copy.equalOpportunity, values),
    summary: {
      heading: copy.summary.heading,
      rows: [
        { icon: "hash", label: copy.summary.reference, value: c.reference },
        { icon: "mapPin", label: copy.summary.location, value: c.location },
        {
          icon: "briefcase",
          label: copy.summary.jobType,
          value: c.employmentType,
        },
        { icon: "clock", label: copy.summary.hours, value: c.shift },
        { icon: "euro", label: copy.summary.pay, value: c.pay },
        {
          icon: "calendar",
          label: copy.summary.startDate,
          value: c.startDate,
        },
        {
          icon: "calendar",
          label: copy.summary.closingDate,
          value: longDate(c.closingDate),
        },
      ],
      applyLabel: copy.summary.applyLabel,
      shareLabel: copy.summary.shareLabel,
    },
    questions: copy.questions,
    beforeYouApply: copy.beforeYouApply,
    similarCopy: {
      eyebrow: copy.similar.eyebrow,
      heading: copy.similar.heading,
      viewAllLabel: copy.similar.viewAllLabel,
      viewAllHref: "/careers#open-positions",
      viewJobLabel: copy.similar.viewJobLabel,
    },
    similar: similar.map((other) => jobCardView(s, other, now, true)),
  }
}
