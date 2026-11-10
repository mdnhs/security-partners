import { ArrowLeft, Info } from "lucide-react"
import Link from "next/link"

import { ApplicationForm } from "@/components/careers/apply/application-form"
import { ApplySidebar } from "@/components/careers/apply/apply-sidebar"
import { PageHero } from "@/components/home/page-hero"
import { Container } from "@/components/home/section"
import { HomeMotion } from "@/components/motion/home-motion"

import type { ApplyView } from "./apply-view"

/** "/careers/<slug>/apply" (Figma 550:285). */
export function ApplyTemplate({ view }: { view: ApplyView }) {
  return (
    <>
      <main>
        <div className="max-md:hidden">
          <PageHero {...view.hero} />
        </div>
        <section className="bg-white md:bg-brand-surface md:px-10 md:py-16 lg:py-28">
          <Container className="grid gap-8 lg:grid-cols-[minmax(0,776px)_384px] lg:justify-between lg:gap-10">
            <div className="flex min-w-0 flex-col md:gap-9 md:rounded-3xl md:border md:border-brand-line md:bg-white md:p-8 md:shadow-[0px_12px_30px_0px_rgba(13,26,51,0.06)] lg:p-12">
              <div className="flex flex-col gap-2.5 max-md:hidden">
                <Link
                  href={view.backHref}
                  className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-bold text-brand-green-dark hover:underline"
                >
                  <ArrowLeft aria-hidden className="size-4" />
                  {view.backLabel}
                </Link>
                <h2 className="text-[32px] leading-[1.2] font-black text-brand-navy md:text-[34px]">
                  {view.title}
                </h2>
                <p className="text-base leading-[1.6] text-brand-ink">
                  {view.intro}
                </p>
              </div>
              {view.closedNotice ? (
                <p
                  role="status"
                  className="m-5 flex items-start gap-3 rounded-2xl border border-brand-line bg-brand-surface px-5 py-4 text-base leading-normal text-brand-ink md:m-0"
                >
                  <Info
                    aria-hidden
                    className="mt-0.5 size-[22px] shrink-0 text-brand-blue"
                  />
                  <span>{view.closedNotice}</span>
                </p>
              ) : (
                <ApplicationForm
                  copy={view.copy}
                  jobSlug={view.jobSlug}
                  messages={view.messages}
                  backHref={view.backHref}
                  sidebar={view.sidebar}
                />
              )}
            </div>
            <div className="max-md:hidden lg:contents">
              <ApplySidebar view={view.sidebar} jobHref={view.backHref} />
            </div>
          </Container>
        </section>
      </main>
      <HomeMotion />
    </>
  )
}
