import { ArrowRight, Briefcase, Clock, Euro, Lock, MapPin } from "lucide-react"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { JobCardView, JobTag } from "@/templates/careers/view"

export function JobTags({
  category,
  tag,
  onDark = false,
}: {
  category: string
  tag: JobTag
  onDark?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "rounded-full px-3 py-1.5 text-xs leading-none font-bold",
          onDark
            ? "bg-white/15 text-white"
            : tag.tone === "closed"
              ? "bg-brand-mint text-brand-green-dark"
              : "bg-brand-mint text-brand-green-dark"
        )}
      >
        {category}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs leading-none font-bold",
          tag.tone === "urgent"
            ? "bg-amber-100 text-amber-800"
            : tag.tone === "closed"
              ? "bg-brand-line text-brand-muted"
              : onDark
                ? "bg-white text-brand-green-dark"
                : "bg-brand-mint text-brand-green-dark"
        )}
      >
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
        {tag.label}
      </span>
    </div>
  )
}

export function JobMeta({
  job,
  muted = false,
  className,
}: {
  job: Pick<JobCardView, "location" | "employmentType" | "shift" | "pay">
  muted?: boolean
  className?: string
}) {
  const items = [
    { icon: MapPin, text: job.location },
    { icon: Briefcase, text: job.employmentType },
    { icon: Clock, text: job.shift },
    { icon: Euro, text: job.pay },
  ]
  return (
    <ul
      className={cn(
        "flex flex-wrap gap-x-6 gap-y-2 text-[15px] leading-normal",
        muted ? "text-brand-muted" : "text-brand-ink",
        className
      )}
    >
      {items
        .filter((item) => item.text !== "")
        .map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2">
            <Icon
              aria-hidden
              className={cn(
                "size-[18px] shrink-0",
                muted ? "text-brand-muted" : "text-brand-green"
              )}
            />
            {text}
          </li>
        ))}
    </ul>
  )
}

/** An open position (listing, 548:372). */
export function JobCard({
  job,
  viewJobLabel,
}: {
  job: JobCardView
  viewJobLabel: string
}) {
  return (
    <li
      data-card="light"
      className="group relative flex flex-col gap-5 rounded-[20px] border border-brand-line bg-white px-6 py-6 shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)] transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1 md:flex-row md:items-center md:justify-between md:px-7"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <JobTags category={job.category} tag={job.tag} />
        <h3 className="text-[22px] leading-[1.25] font-black text-brand-navy">
          <Link
            href={job.href}
            className="outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {job.title}
          </Link>
        </h3>
        <JobMeta job={job} />
      </div>
      <div className="relative z-10 flex flex-col gap-3 md:items-end">
        <p className="text-sm text-brand-muted">{job.posted}</p>
        <Link
          href={job.href}
          tabIndex={-1}
          aria-hidden
          className={buttonClassName(
            { variant: "brand", size: "pill-sm" },
            "gap-2 max-md:w-full"
          )}
        >
          {viewJobLabel}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </li>
  )
}

/** A closed or filled role (Previous Openings, 548:558). */
export function ClosedJobCard({ job }: { job: JobCardView }) {
  return (
    <li className="flex flex-col gap-5 rounded-[20px] border border-brand-line bg-brand-surface px-6 py-6 md:flex-row md:items-center md:justify-between md:px-7">
      <div className="flex min-w-0 flex-col gap-3">
        <JobTags category={job.category} tag={job.tag} />
        <h3 className="text-[20px] leading-[1.25] font-black text-brand-ink">
          {job.title}
        </h3>
        <JobMeta job={job} muted />
      </div>
      <div className="flex flex-col gap-3 md:items-end">
        <p className="text-sm text-brand-ink">{job.closedOn}</p>
        <span className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-5 py-2.5 text-sm font-bold text-brand-muted max-md:w-full">
          <Lock aria-hidden className="size-4" />
          {job.filledLabel}
        </span>
      </div>
    </li>
  )
}
