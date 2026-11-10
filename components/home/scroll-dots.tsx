"use client"

import { LazyMotion, MotionConfig, domAnimation } from "motion/react"
import * as m from "motion/react-m"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Pagination dots for a horizontally swiped list (phones). `targetId` is the id
 * of the scrolling element; its children are the slides. Decorative: the list
 * itself stays scrollable and focusable.
 */
export function ScrollDots({
  targetId,
  className,
}: {
  targetId: string
  className?: string
}) {
  const [count, setCount] = useState(0)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const list = document.getElementById(targetId)
    if (!list) return
    const update = () => {
      const slides = Array.from(list.children) as HTMLElement[]
      setCount(slides.length)
      if (!slides.length) return
      const center = list.scrollLeft + list.clientWidth / 2
      let best = 0
      let distance = Infinity
      slides.forEach((slide, i) => {
        const d = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center)
        if (d < distance) {
          distance = d
          best = i
        }
      })
      // At the very end the last slide is the active one, even if not centred.
      if (list.scrollLeft + list.clientWidth >= list.scrollWidth - 2) {
        best = slides.length - 1
      }
      setActive(best)
    }
    update()
    list.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      list.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [targetId])

  if (count < 2) return null
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <div
          aria-hidden
          className={cn(
            "flex items-center justify-center gap-1.5 sm:hidden",
            className
          )}
        >
          {Array.from({ length: count }, (_, i) => (
            <m.span
              key={i}
              initial={false}
              animate={{
                width: i === active ? 24 : 8,
                backgroundColor: i === active ? "#2751a3" : "#e3e8f2",
              }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>
      </LazyMotion>
    </MotionConfig>
  )
}
