"use client"

import { MotionConfig } from "motion/react"
import * as m from "motion/react-m"
import { LazyMotion, domAnimation } from "motion/react"

/**
 * A template remounts on every navigation, so each page fades in as it
 * arrives. Opacity only: a transform here would become the containing block
 * of every sticky and fixed element on the page (and of GSAP's pins).
 * `reducedMotion="user"` turns the animation off for visitors who ask for it.
 */
export default function SiteTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </m.div>
      </LazyMotion>
    </MotionConfig>
  )
}
