import { Phone, Upload } from "lucide-react"
import Image from "next/image"

import { ClosedJobCard } from "@/components/careers/job-card"
import { Container, SectionHeading } from "@/components/home/section"
import { buttonClassName } from "@/components/ui/button"
import type { CareersView } from "@/templates/careers/view"

/** "Why Join Security Partners" (548:293). */
export function WhyJoin({ view }: { view: CareersView["whyJoin"] }) {
  return (
    <section className="bg-white px-5 py-14 md:px-10 md:py-20 lg:py-28">
      <Container className="flex flex-col gap-6 md:gap-14">
        <SectionHeading
          eyebrow={view.eyebrow}
          title={view.title}
          description={view.description}
        />
        <ul className="grid gap-3 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {view.cards.map((card) => (
            <li
              key={card.title}
              data-card="light"
              className="group flex items-start gap-4 rounded-[20px] border border-brand-line bg-white p-5 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)] transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1 md:flex-col md:rounded-3xl md:px-7 md:py-8"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-green md:size-14 md:rounded-2xl">
                <Image
                  src={card.icon}
                  alt=""
                  width={24}
                  height={24}
                  className="size-[22px] md:size-6"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-4">
                <h3 className="text-lg leading-[23px] font-black text-brand-navy md:text-xl md:leading-[1.3]">
                  {card.title}
                </h3>
                <p className="text-[15px] leading-[22px] text-brand-ink md:leading-[1.6]">
                  {card.description}
                </p>
              </div>
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
    <section className="bg-white px-5 py-14 md:px-10 md:py-20 lg:py-28">
      <Container className="flex flex-col gap-6 md:gap-8">
        <SectionHeading
          align="start"
          eyebrow={view.eyebrow}
          title={view.title}
          description={view.description}
        />
        <ul className="flex flex-col gap-3 md:gap-4">
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
    <section className="bg-brand-surface px-5 py-14 md:px-10 md:py-20 lg:py-28">
      <Container className="flex flex-col gap-6 md:gap-14">
        <SectionHeading
          eyebrow={view.eyebrow}
          title={view.title}
          description={view.description}
        />
        <ol className="grid gap-6 max-md:gap-0 max-md:rounded-[20px] max-md:border max-md:border-brand-line max-md:bg-white max-md:p-5 sm:grid-cols-2 lg:grid-cols-4">
          {view.steps.map((step) => (
            <li
              key={step.number}
              data-card="light"
              className="group md:flex-col-[translate,box-shadow,border-color] relative flex items-start gap-4 rounded-3xl border border-brand-line bg-white px-7 py-8 transition duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:pb-6 max-md:last:pb-0"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-green text-base font-black text-white md:size-[52px] md:text-lg">
                {step.number}
              </span>
              <span
                aria-hidden
                className="absolute top-[46px] bottom-0 left-[19px] w-0.5 rounded-full bg-brand-line group-last:hidden md:hidden"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 max-md:pt-2 md:gap-4">
                <h3 className="text-lg leading-[23px] font-black text-brand-navy md:text-xl md:leading-[1.3]">
                  {step.title}
                </h3>
                <p className="text-[15px] leading-[22px] text-brand-ink md:leading-[1.6]">
                  {step.description}
                </p>
              </div>
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
    <section className="bg-white px-5 py-14 md:px-10 md:py-20 lg:py-28">
      <Container>
        <div className="flex flex-col gap-6 rounded-3xl bg-brand-blue px-6 py-7 md:gap-8 md:rounded-[28px] md:p-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-[574px] flex-col gap-2.5 md:gap-3.5">
            <p className="text-xs font-black tracking-[0.125em] text-brand-green uppercase md:text-sm md:tracking-[0.14em]">
              {view.eyebrow}
            </p>
            <h2 className="text-[26px] leading-8 font-black text-white md:text-[40px] md:leading-[1.15]">
              {view.heading}
            </h2>
            <p className="text-base leading-[1.6] text-white/85">{view.copy}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={view.primary.href}
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "gap-2 max-sm:h-[52px] max-sm:w-full max-sm:py-0"
              )}
            >
              {view.primary.label}
              <Upload aria-hidden className="size-[18px]" />
            </a>
            <a
              href={view.secondary.href}
              className={buttonClassName(
                { variant: "brand-outline", size: "pill" },
                "max-sm:h-[52px] max-sm:w-full max-sm:gap-2 max-sm:border-white/45 max-sm:bg-white/8 max-sm:py-0"
              )}
            >
              {view.secondary.href.startsWith("tel:") ? (
                <Phone aria-hidden className="size-5 sm:hidden" />
              ) : null}
              {view.secondary.label}
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
