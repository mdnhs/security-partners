import type { PageHeroProps } from "@/components/home/page-hero"
import { isOpen } from "@/lib/careers/open"
import { interpolate } from "@/lib/interpolate"
import { jobPath } from "@/lib/schemas/api/jobs"
import type { JobRecord } from "@/server/modules/jobs-board/queries"
import type { SiteSources } from "@/templates/shared/sources"
import { pageHeroView } from "@/templates/shared/views"

import type { CareersTemplate } from "./schema"

/** "/careers/<slug>/apply" (Figma 550:285), or "/careers/apply" (talent pool, no job). */
export type ApplyView = {
  jobSlug: string
  open: boolean
  hero: PageHeroProps
  backLabel: string
  backHref: string
  title: string
  intro: string
  /** Shown instead of the form once the role has closed. */
  closedNotice: string | null
  copy: CareersTemplate["apply"]
  messages: { errorMessage: string; rateLimitedMessage: string }
  sidebar: {
    applyingFor: string
    jobTitle: string
    /** null for the talent pool. */
    meta: {
      location: string
      employmentType: string
      shift: string
      pay: string
    } | null
    viewJob: string
    nextHeading: string
    nextSteps: { number: string; title: string; description: string }[]
    dataHeading: string
    dataCopy: string
    helpHeading: string
    phone: string
    phoneHref: string
    email: string
  }
}

/** Settings › Careers retention, for the {months} / {keepMonths} placeholders. */
export type ApplyRetention = { months: number; keepMonths: number }

/** Until Settings › Careers is saved (the 0022/0025 migration values). */
export const DEFAULT_RETENTION: ApplyRetention = { months: 12, keepMonths: 24 }

export function applyView(
  s: SiteSources,
  job: JobRecord | null,
  now: Date,
  retention: ApplyRetention = DEFAULT_RETENTION
): ApplyView {
  const page = s.pages.careers.data
  const values = {
    months: String(retention.months),
    keepMonths: String(retention.keepMonths),
  }
  const apply = {
    ...page.apply,
    consents: page.apply.consents.map((text) => interpolate(text, values)),
    sidebar: {
      ...page.apply.sidebar,
      dataCopy: interpolate(page.apply.sidebar.dataCopy, values),
    },
  }
  const form = s.settings["sections.contact"].form
  const shared = {
    title: apply.title,
    intro: apply.intro,
    copy: apply,
    messages: {
      errorMessage: form.errorMessage,
      rateLimitedMessage: form.rateLimitedMessage,
    },
  }
  const sidebar = {
    applyingFor: apply.sidebar.applyingFor,
    nextHeading: apply.sidebar.nextHeading,
    nextSteps: apply.sidebar.nextSteps.map((step, i) => ({
      number: String(i + 1),
      ...step,
    })),
    dataHeading: apply.sidebar.dataHeading,
    dataCopy: apply.sidebar.dataCopy,
    helpHeading: apply.sidebar.helpHeading,
    phone: page.job.questions.phone,
    phoneHref: page.job.questions.phoneHref,
    email: page.job.questions.email,
  }

  if (!job)
    // The talent pool ("Send Us Your CV"): the same form, with the banner's copy.
    return {
      ...shared,
      jobSlug: "",
      open: true,
      hero: {
        ...pageHeroView(s, page.hero, {
          trail: [{ label: page.hero.crumb, href: "/careers" }],
        }),
        crumb: apply.crumb,
        title: page.cta.heading,
        description: page.cta.copy,
      },
      backLabel: page.job.similar.viewAllLabel,
      backHref: "/careers",
      closedNotice: null,
      sidebar: {
        ...sidebar,
        jobTitle: page.cta.eyebrow,
        meta: null,
        viewJob: page.job.similar.viewAllLabel,
      },
    }

  const c = job.content
  const open = isOpen(c, now)
  const href = jobPath(job.slug)
  return {
    ...shared,
    jobSlug: job.slug,
    open,
    hero: {
      ...pageHeroView(s, page.hero, {
        trail: [
          { label: page.hero.crumb, href: "/careers" },
          { label: c.title, href },
        ],
      }),
      crumb: apply.crumb,
      title: apply.heroTitle,
      description: [
        c.title,
        c.location,
        interpolate(apply.referenceLabel, { reference: c.reference }),
      ].join(" · "),
    },
    backLabel: apply.backLabel,
    backHref: href,
    closedNotice: open ? null : apply.closedNotice,
    sidebar: {
      ...sidebar,
      jobTitle: c.title,
      meta: {
        location: c.location,
        employmentType: c.employmentType,
        shift: c.shift,
        pay: c.pay,
      },
      viewJob: apply.sidebar.viewJob,
    },
  }
}
