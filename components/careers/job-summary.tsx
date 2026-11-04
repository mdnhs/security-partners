import {
  ArrowRight,
  Briefcase,
  Calendar,
  CircleCheck,
  Clock,
  Euro,
  Hash,
  type LucideIcon,
  Mail,
  MapPin,
  Phone,
} from "lucide-react"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { JobView, SummaryIcon } from "@/templates/careers/job-view"

import { ShareButton } from "./share-button"

const ICONS: Record<SummaryIcon, LucideIcon> = {
  hash: Hash,
  mapPin: MapPin,
  briefcase: Briefcase,
  clock: Clock,
  euro: Euro,
  calendar: Calendar,
}

/** "Job Summary" card (549:665): the facts, Apply and Share. */
export function JobSummary({ view }: { view: JobView }) {
  return (
    <section
      aria-labelledby="job-summary"
      data-card="light"
      className="flex flex-col gap-5 rounded-3xl border border-brand-line bg-white p-6 shadow-[0px_12px_30px_0px_rgba(13,26,51,0.08)] md:p-8"
    >
      <h2
        id="job-summary"
        className="text-2xl leading-[1.2] font-black text-brand-navy"
      >
        {view.summary.heading}
      </h2>
      <dl className="flex flex-col gap-5">
        {view.summary.rows.map((row) => {
          const Icon = ICONS[row.icon]
          return (
            <div key={row.label} className="flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-mint text-brand-green">
                <Icon aria-hidden className="size-[19px]" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-sm text-brand-muted">{row.label}</dt>
                <dd className="text-[17px] leading-tight font-bold text-brand-navy">
                  {row.value}
                </dd>
              </div>
            </div>
          )
        })}
      </dl>
      <hr className="border-brand-line" />
      {view.applyHref ? (
        <Link
          href={view.applyHref}
          className={buttonClassName(
            { variant: "brand", size: "pill" },
            "w-full gap-2.5"
          )}
        >
          {view.summary.applyLabel}
          <ArrowRight aria-hidden className="size-[18px]" />
        </Link>
      ) : (
        <p className="rounded-2xl bg-brand-surface px-4 py-3 text-[15px] leading-normal text-brand-ink">
          {view.closedNotice}
        </p>
      )}
      <ShareButton
        path={view.path}
        title={view.hero.title}
        label={view.summary.shareLabel}
        copiedLabel={view.share.copiedLabel}
        className="inline-flex items-center justify-center gap-2 self-center text-[15px] font-bold text-brand-ink hover:text-brand-blue"
      />
    </section>
  )
}

/** "Questions about this role?" (549:734). */
export function JobQuestions({ view }: { view: JobView["questions"] }) {
  const items = [
    { icon: Phone, text: view.phone, href: view.phoneHref },
    { icon: Mail, text: view.email, href: `mailto:${view.email}` },
  ]
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-brand-blue p-6 text-white md:p-8">
      <h2 className="text-[22px] leading-[1.2] font-black">{view.heading}</h2>
      <p className="text-[15px] leading-[1.55] text-white/85">{view.copy}</p>
      <ul className="flex flex-col gap-4">
        {items.map(({ icon: Icon, text, href }) => (
          <li key={href}>
            <a
              href={href}
              className="flex min-h-11 items-center gap-3 font-bold break-all hover:underline"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-green">
                <Icon aria-hidden className="size-[18px]" />
              </span>
              {text}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** "Before You Apply" (549:748). */
export function BeforeYouApply({ view }: { view: JobView["beforeYouApply"] }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-brand-line bg-brand-surface p-6 md:p-7">
      <h2 className="text-xl leading-[1.2] font-black text-brand-navy">
        {view.heading}
      </h2>
      <p className="text-[15px] text-brand-ink">{view.intro}</p>
      <CheckList items={view.items} className="gap-3.5 text-[15px]" />
    </section>
  )
}

export function CheckList({
  items,
  className,
}: {
  items: string[]
  className?: string
}) {
  return (
    <ul
      className={cn("flex flex-col leading-normal text-brand-ink", className)}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CircleCheck
            aria-hidden
            className="mt-px size-[22px] shrink-0 text-brand-green"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
