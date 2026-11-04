import type { PageHeroProps } from "@/components/home/page-hero"
import { isOpen } from "@/lib/careers/open"
import { interpolate } from "@/lib/interpolate"
import { jobPath } from "@/lib/schemas/api/jobs"
import type { JobRecord } from "@/server/modules/jobs-board/queries"
import type { SiteSources } from "@/templates/shared/sources"
import { pageHeroView } from "@/templates/shared/views"

import type { CareersTemplate } from "./schema"

/** "/careers/<slug>/apply" (Figma 550:285). */
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
    meta: {
      location: string
      employmentType: string
      shift: string
      pay: string
    }
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

export function applyView(
  s: SiteSources,
  job: JobRecord,
  now: Date
): ApplyView {
  const page = s.pages.careers.data
  const apply = page.apply
  const c = job.content
  const open = isOpen(c, now)
  const href = jobPath(job.slug)
  const form = s.settings["sections.contact"].form
  return {
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
    title: apply.title,
    intro: apply.intro,
    closedNotice: open ? null : apply.closedNotice,
    copy: apply,
    messages: {
      errorMessage: form.errorMessage,
      rateLimitedMessage: form.rateLimitedMessage,
    },
    sidebar: {
      applyingFor: apply.sidebar.applyingFor,
      jobTitle: c.title,
      meta: {
        location: c.location,
        employmentType: c.employmentType,
        shift: c.shift,
        pay: c.pay,
      },
      viewJob: apply.sidebar.viewJob,
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
    },
  }
}
