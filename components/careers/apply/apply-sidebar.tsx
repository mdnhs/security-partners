import {
  ArrowRight,
  Briefcase,
  Clock,
  Euro,
  Lock,
  Mail,
  MapPin,
  Phone,
} from "lucide-react"
import Link from "next/link"

import type { ApplyView } from "@/templates/careers/apply-view"

/** Apply page sidebar (Figma 550:493). */
export function ApplySidebar({
  view,
  jobHref,
}: {
  view: ApplyView["sidebar"]
  jobHref: string
}) {
  const meta = [
    { icon: MapPin, text: view.meta.location },
    { icon: Briefcase, text: view.meta.employmentType },
    { icon: Clock, text: view.meta.shift },
    { icon: Euro, text: view.meta.pay },
  ]
  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
      <section className="flex flex-col gap-4 rounded-3xl bg-brand-navy p-7 text-white">
        <p className="text-[13px] font-black tracking-[0.06em] text-brand-green uppercase">
          {view.applyingFor}
        </p>
        <h2 className="text-2xl leading-[1.2] font-black">{view.jobTitle}</h2>
        <ul className="flex flex-col gap-3 text-[15px] text-white/85">
          {meta.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5">
              <Icon
                aria-hidden
                className="size-[18px] shrink-0 text-brand-green"
              />
              {text}
            </li>
          ))}
        </ul>
        <Link
          href={jobHref}
          className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-bold text-brand-green hover:underline"
        >
          {view.viewJob}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border border-brand-line bg-white p-7">
        <h2 className="text-xl font-black text-brand-navy">
          {view.nextHeading}
        </h2>
        <ol className="flex flex-col gap-5">
          {view.nextSteps.map((step) => (
            <li key={step.number} className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-mint text-sm font-black text-brand-green-dark"
              >
                {step.number}
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-base font-bold text-brand-navy">
                  {step.title}
                </p>
                <p className="text-sm leading-normal text-brand-muted">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-brand-green/30 bg-brand-mint p-7">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-green text-white">
            <Lock aria-hidden className="size-4" />
          </span>
          <h2 className="text-lg font-black text-brand-navy">
            {view.dataHeading}
          </h2>
        </div>
        <p className="text-[15px] leading-[1.6] text-brand-ink">
          {view.dataCopy}
        </p>
      </section>

      <section className="flex flex-col gap-3.5 rounded-3xl border border-brand-line bg-brand-surface p-7">
        <h2 className="text-lg font-black text-brand-navy">
          {view.helpHeading}
        </h2>
        {[
          { icon: Phone, text: view.phone, href: view.phoneHref },
          { icon: Mail, text: view.email, href: `mailto:${view.email}` },
        ].map(({ icon: Icon, text, href }) => (
          <a
            key={href}
            href={href}
            className="flex min-h-11 items-center gap-3 font-bold break-all text-brand-navy hover:text-brand-blue"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-green text-white">
              <Icon aria-hidden className="size-4" />
            </span>
            {text}
          </a>
        ))}
      </section>
    </aside>
  )
}
