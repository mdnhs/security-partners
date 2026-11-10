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
        "flex flex-col gap-2 text-sm leading-5 md:flex-row md:flex-wrap md:gap-x-6 md:text-[15px] md:leading-normal",
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
                "size-4 shrink-0 md:size-[18px]",
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
      className="group relative flex flex-col gap-3.5 rounded-[20px] border border-brand-line bg-white p-5 shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)] transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1 md:flex-row md:items-center md:justify-between md:gap-5 md:px-7 md:py-6"
    >
      <div className="flex min-w-0 flex-col gap-3.5 md:gap-3">
        <JobTags category={job.category} tag={job.tag} />
        <h3 className="text-[19px] leading-6 font-black text-brand-navy md:text-[22px] md:leading-[1.25]">
          <Link
            href={job.href}
            className="outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {job.title}
          </Link>
        </h3>
        <JobMeta job={job} />
      </div>
      <div className="relative z-10 flex items-center justify-between gap-2 border-t border-brand-line pt-3.5 md:flex-col md:items-end md:gap-3 md:border-0 md:pt-0">
        <p className="text-[13px] font-medium text-brand-muted md:text-sm md:font-normal">
          {job.posted}
        </p>
        <Link
          href={job.href}
          tabIndex={-1}
          aria-hidden
          className={buttonClassName(
            { variant: "brand", size: "pill-sm" },
            "gap-1.5 max-md:bg-transparent max-md:p-0 max-md:text-sm max-md:text-brand-blue max-md:hover:bg-transparent md:gap-2"
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
    <li className="flex flex-col gap-3.5 rounded-[20px] border border-brand-line bg-brand-surface p-5 md:flex-row md:items-center md:justify-between md:gap-5 md:px-7 md:py-6">
      <div className="flex min-w-0 flex-col gap-3.5 md:gap-3">
        <JobTags category={job.category} tag={job.tag} />
        <h3 className="text-[19px] leading-6 font-black text-brand-ink md:text-[20px] md:leading-[1.25]">
          {job.title}
        </h3>
        <JobMeta job={job} muted />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-brand-line pt-3.5 md:flex-col md:items-end md:gap-3 md:border-0 md:pt-0">
        <p className="text-[13px] text-brand-ink md:text-sm">{job.closedOn}</p>
        <span className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-bold text-brand-muted md:px-5 md:py-2.5">
          <Lock aria-hidden className="size-4" />
          {job.filledLabel}
        </span>
      </div>
    </li>
  )
}
