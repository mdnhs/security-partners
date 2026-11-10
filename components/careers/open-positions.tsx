"use client"

import { Briefcase, ChevronDown, MapPin, Search, Shield } from "lucide-react"
import { useMemo, useState } from "react"

import { JobCard } from "@/components/careers/job-card"
import { Container } from "@/components/home/section"
import { filterJobs } from "@/lib/careers/filter"
import { cn } from "@/lib/utils"
import type { CareersView } from "@/templates/careers/view"

const CONTROL =
  "h-12 w-full rounded-xl border border-brand-line bg-white pr-4 pl-11 text-base md:h-[52px] md:bg-brand-surface md:text-[15px] text-brand-navy placeholder:text-brand-placeholder outline-none focus-visible:border-brand-blue focus-visible:ring-3 focus-visible:ring-brand-blue/20"

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
        className={cn(
          CONTROL,
          "appearance-none pr-9 pl-10 text-sm font-medium md:pr-10 md:pl-11 md:text-[15px] md:font-normal"
        )}
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
      className="scroll-mt-28 bg-brand-surface px-5 py-14 md:px-10 md:py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-4 md:gap-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-[1013px] flex-col gap-2.5 md:gap-3.5">
            <p className="text-xs font-black tracking-[0.125em] text-brand-green uppercase md:text-sm md:tracking-[0.14em]">
              {view.eyebrow}
            </p>
            <h2 className="text-[30px] leading-9 font-black tracking-[-0.01em] text-brand-navy sm:text-4xl sm:leading-[1.15] md:text-[44px]">
              {view.title}
            </h2>
            <p className="text-base leading-6 text-brand-ink md:text-lg md:leading-[1.6]">
              {view.description}
            </p>
          </div>
          <p className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-brand-line bg-white px-3.5 py-2 text-sm font-bold text-brand-navy md:px-5 md:py-2.5">
            <Briefcase
              aria-hidden
              className="size-4 text-brand-green md:size-[18px]"
            />
            {view.countLabel}
          </p>
        </div>

        {view.jobs.length > 0 ? (
          <>
            <div className="flex flex-col gap-4 md:rounded-[20px] md:bg-white md:p-5 md:shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)]">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[1fr_260px_240px] md:gap-3">
                <label className="relative col-span-2 block min-w-0 md:col-span-1">
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
                    className={cn(CONTROL, "h-[52px]")}
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
                className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:gap-2.5 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
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
                        "h-10 shrink-0 rounded-full border px-4 text-sm leading-none font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand-blue/30 md:h-auto md:px-[18px] md:py-2.5",
                        active
                          ? "border-brand-blue bg-brand-blue text-white md:border-brand-green md:bg-brand-green"
                          : "border-brand-line bg-white text-brand-navy hover:border-brand-green/60 md:bg-brand-surface"
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
              <ul className="flex flex-col gap-3 md:gap-4">
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
