"use client"

import { gsap } from "gsap"
import { useLayoutEffect, useRef } from "react"

import { reducedMotion } from "./use-widget-motion"

const DOTS = [0, 1, 2]

// Port of JW features/chat/typing-indicator.tsx. A reply bubble with three
// bouncing dots, plus the words for screen readers (`label`, from settings
// copy). The dots rest visible; GSAP only adds the bounce.
export function TypingIndicator({ label }: { label: string }) {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el || reducedMotion()) return
    const context = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.2, clearProps: "opacity,transform" }
      )
      gsap.fromTo(
        el.querySelectorAll("[data-dot]"),
        { y: 0, opacity: 0.4 },
        {
          y: -4,
          opacity: 1,
          duration: 0.45,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          stagger: 0.15,
        }
      )
    }, el)
    return () => context.revert()
  }, [])

  return (
    <div ref={root} role="status" className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/12 px-4 py-3.5"
      >
        {DOTS.map((i) => (
          <span
            key={i}
            data-dot
            className="size-1.5 rounded-full bg-white opacity-70"
          />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  )
}
