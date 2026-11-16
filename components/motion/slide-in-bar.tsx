"use client"

import { LazyMotion, MotionConfig, domAnimation } from "motion/react"
import * as m from "motion/react-m"
import { useEffect, useRef, useState } from "react"

/**
 * A fixed bottom bar that is not there on the first screen: it glides up
 * once the page has been scrolled (past the same 8px the navbar turns to
 * glass at) and back down at the top. While hidden it is off screen and
 * inert, so it cannot be tabbed to. While it is up, its height is published
 * as --sticky-cta-h on <html> so floating widgets (the chat launcher) sit
 * above it instead of over it. Props pass straight to the div.
 */
export function SlideInBar({
  children,
  ...props
}: Omit<
  React.ComponentProps<"div">,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
>) {
  const [scrolled, setScrolled] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])
  useEffect(() => {
    const bar = ref.current
    if (!bar) return
    const root = document.documentElement
    // 0 while hidden, and on widths where the bar is display: none.
    const publish = () =>
      root.style.setProperty(
        "--sticky-cta-h",
        scrolled ? `${bar.offsetHeight}px` : "0px"
      )
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty("--sticky-cta-h")
    }
  }, [scrolled])
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <m.div
          {...props}
          ref={ref}
          inert={!scrolled}
          initial={{ y: "110%" }}
          animate={{ y: scrolled ? 0 : "110%" }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        >
          {children}
        </m.div>
      </LazyMotion>
    </MotionConfig>
  )
}
