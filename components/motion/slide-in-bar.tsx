"use client"

import { LazyMotion, MotionConfig, domAnimation } from "motion/react"
import * as m from "motion/react-m"

/**
 * A fixed bottom bar that glides up into place once the page has settled,
 * instead of being there from the first paint. Props pass straight to the div.
 */
export function SlideInBar({
  children,
  ...props
}: Omit<
  React.ComponentProps<"div">,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
>) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <m.div
          {...props}
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 30,
            delay: 0.7,
          }}
        >
          {children}
        </m.div>
      </LazyMotion>
    </MotionConfig>
  )
}
