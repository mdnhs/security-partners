import { OpenPositions } from "@/components/careers/open-positions"
import {
  HiringProcess,
  PreviousOpenings,
  TalentPoolCta,
  WhyJoin,
} from "@/components/careers/sections"
import { PageHero } from "@/components/home/page-hero"
import { HomeMotion } from "@/components/motion/home-motion"

import type { CareersView } from "./view"

/** "/careers" (Figma 548:18). */
export function CareersTemplate({ view }: { view: CareersView }) {
  return (
    <>
      <main>
        <PageHero {...view.hero} />
        <WhyJoin view={view.whyJoin} />
        <OpenPositions view={view.openings} />
        {view.previous ? <PreviousOpenings view={view.previous} /> : null}
        <HiringProcess view={view.process} />
        <TalentPoolCta view={view.cta} />
      </main>
      <HomeMotion />
    </>
  )
}
