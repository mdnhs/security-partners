"use client"

import { Briefcase, ChevronDown, MapPin, Search, Shield } from "lucide-react"
import { useMemo, useState } from "react"

import { JobCard } from "@/components/careers/job-card"
import { Container } from "@/components/home/section"
import { filterJobs } from "@/lib/careers/filter"
import { cn } from "@/lib/utils"
import type { CareersView } from "@/templates/careers/view"

const CONTROL =
  "h-[52px] w-full rounded-xl border border-brand-line bg-brand-surface pr-4 pl-11 text-[15px] text-brand-navy placeholder:text-brand-placeholder outline-none focus-visible:border-brand-blue focus-visible:ring-3 focus-visible:ring-brand-blue/20"

function SelectFilter({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: typeof MapPin
  label: string
  value: string
  options: string[]
  onChange(value: string): void
}) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-brand-muted"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, "appearance-none pr-10")}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-brand-muted"
      />
    </label>
  )
}

/** "Open Positions" (548:327): search, location and licence selects, category chips, job cards. */
export function OpenPositions({ view }: { view: CareersView["openings"] }) {
  const [q, setQ] = useState("")
  const [location, setLocation] = useState("")
  const [licence, setLicence] = useState("")
  const [category, setCategory] = useState("")
  const shown = useMemo(
    () => filterJobs(view.jobs, { q, location, licence, category }),
    [view.jobs, q, location, licence, category]
  )
  const chips = [
    { label: view.allRolesLabel, value: "" },
    ...view.categories.map((c) => ({ label: c.label, value: c.label })),
  ]
  return (
    <section
      id="open-positions"
      className="scroll-mt-28 bg-brand-surface px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-[1013px] flex-col gap-3.5">
            <p className="text-sm font-black tracking-[0.14em] text-brand-green uppercase">
              {view.eyebrow}
            </p>
            <h2 className="text-4xl leading-[1.15] font-black tracking-[-0.01em] text-brand-navy md:text-[44px]">
              {view.title}
            </h2>
            <p className="text-lg leading-[1.6] text-brand-ink">
              {view.description}
            </p>
          </div>
          <p className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-2.5 text-sm font-bold text-brand-navy">
            <Briefcase aria-hidden className="size-[18px] text-brand-green" />
            {view.countLabel}
          </p>
        </div>

        {view.jobs.length > 0 ? (
          <>
            <div className="flex flex-col gap-4 rounded-[20px] bg-white p-5 shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)]">
              <div className="grid gap-3 md:grid-cols-[1fr_260px_240px]">
                <label className="relative block min-w-0">
                  <span className="sr-only">{view.searchPlaceholder}</span>
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-brand-muted"
                  />
                  <input
                    type="search"
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    placeholder={view.searchPlaceholder}
                    className={CONTROL}
                  />
                </label>
                <SelectFilter
                  icon={MapPin}
                  label={view.allLocations}
                  value={location}
                  options={view.locations}
                  onChange={setLocation}
                />
                <SelectFilter
                  icon={Shield}
                  label={view.allLicenceTypes}
                  value={licence}
                  options={view.licences}
                  onChange={setLicence}
                />
              </div>
              <div
                role="group"
                aria-label={view.title}
                className="flex flex-wrap gap-2.5"
              >
                {chips.map((chip) => {
                  const active = category === chip.value
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategory(chip.value)}
                      className={cn(
                        "rounded-full border px-[18px] py-2.5 text-sm leading-none font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand-blue/30",
                        active
                          ? "border-brand-green bg-brand-green text-white"
                          : "border-brand-line bg-brand-surface text-brand-navy hover:border-brand-green/60"
                      )}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <p role="status" className="sr-only">
              {shown.length} / {view.jobs.length}
            </p>
            {shown.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {shown.map((job) => (
                  <JobCard
                    key={job.slug}
                    job={job}
                    viewJobLabel={view.viewJobLabel}
                  />
                ))}
              </ul>
            ) : (
              <Empty title={view.empty.title} text={view.empty.text} />
            )}
          </>
        ) : (
          <Empty title={view.empty.title} text={view.empty.text} />
        )}
      </Container>
    </section>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-brand-line bg-white px-6 py-14 text-center">
      <p className="text-xl font-black text-brand-navy">{title}</p>
      <p className="max-w-[560px] text-base leading-[1.6] text-brand-ink">
        {text}
      </p>
    </div>
  )
}
