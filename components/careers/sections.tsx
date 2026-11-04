import { Upload } from "lucide-react"
import Image from "next/image"

import { ClosedJobCard } from "@/components/careers/job-card"
import { Container, SectionHeading } from "@/components/home/section"
import { buttonClassName } from "@/components/ui/button"
import type { CareersView } from "@/templates/careers/view"

/** "Why Join Security Partners" (548:293). */
export function WhyJoin({ view }: { view: CareersView["whyJoin"] }) {
  return (
    <section className="bg-white px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow={view.eyebrow}
          title={view.title}
          description={view.description}
        />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {view.cards.map((card) => (
            <li
              key={card.title}
              data-card="light"
              className="group flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-7 py-8 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)] transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-green">
                <Image src={card.icon} alt="" width={24} height={24} />
              </div>
              <h3 className="text-xl leading-[1.3] font-black text-brand-navy">
                {card.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-brand-ink">
                {card.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

/** "Previous Openings" (548:552): left out when nothing has closed. */
export function PreviousOpenings({
  view,
}: {
  view: NonNullable<CareersView["previous"]>
}) {
  return (
    <section className="bg-white px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-8">
        <SectionHeading
          align="start"
          eyebrow={view.eyebrow}
          title={view.title}
          description={view.description}
        />
        <ul className="flex flex-col gap-4">
          {view.jobs.map((job) => (
            <ClosedJobCard key={job.slug} job={job} />
          ))}
        </ul>
      </Container>
    </section>
  )
}

/** "Our Hiring Process" (548:669). */
export function HiringProcess({ view }: { view: CareersView["process"] }) {
  return (
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow={view.eyebrow}
          title={view.title}
          description={view.description}
        />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {view.steps.map((step) => (
            <li
              key={step.number}
              data-card="light"
              className="group flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-7 py-8 transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1"
            >
              <span className="flex size-[52px] items-center justify-center rounded-full bg-brand-green text-lg font-black text-white">
                {step.number}
              </span>
              <h3 className="text-xl leading-[1.3] font-black text-brand-navy">
                {step.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-brand-ink">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}

/** "Don't see the right role?" talent pool banner (548:695). */
export function TalentPoolCta({ view }: { view: CareersView["cta"] }) {
  return (
    <section className="bg-white px-6 py-20 md:px-10 lg:py-28">
      <Container>
        <div className="flex flex-col gap-8 rounded-[28px] bg-brand-blue px-6 py-12 md:p-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-[574px] flex-col gap-3.5">
            <p className="text-sm font-black tracking-[0.14em] text-brand-green uppercase">
              {view.eyebrow}
            </p>
            <h2 className="text-3xl leading-[1.15] font-black text-white md:text-[40px]">
              {view.heading}
            </h2>
            <p className="text-base leading-[1.6] text-white/85">{view.copy}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={view.primary.href}
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "gap-2 max-sm:w-full"
              )}
            >
              {view.primary.label}
              <Upload aria-hidden className="size-[18px]" />
            </a>
            <a
              href={view.secondary.href}
              className={buttonClassName(
                { variant: "brand-outline", size: "pill" },
                "max-sm:w-full"
              )}
            >
              {view.secondary.label}
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
