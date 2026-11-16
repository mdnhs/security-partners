"use client"

import { gsap } from "gsap"
import { useEffect, useLayoutEffect, useRef } from "react"

// Port of JW features/chat/use-widget-motion.ts (live chat plan §3.1, §3.3).

// jsdom and some embedded browsers have no matchMedia: treat that as "no".
export const prefers = (query: string) =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(query).matches
export const reducedMotion = () => prefers("(prefers-reduced-motion: reduce)")
export const finePointer = () => prefers("(hover: hover) and (pointer: fine)")
export const touchOnly = () => prefers("(hover: none)")

// About eight frames: a healthy opening has moved well before this.
const SAFETY_MS = 140

// Opening plays this forwards and closing plays it backwards, so a visitor who
// changes their mind halfway sees the panel turn around from where it is.
function buildPanelTimeline(panel: HTMLElement, onClosed: () => void) {
  gsap.set(panel, { transformOrigin: "100% 100%" })
  return gsap
    .timeline({ paused: true, onReverseComplete: onClosed })
    .fromTo(
      panel,
      { opacity: 0, scale: 0.72, y: 36 },
      { opacity: 1, scale: 1, y: 0, duration: 0.46, ease: "back.out(1.6)" }
    )
    .fromTo(
      panel.querySelectorAll("[data-chat-part]"),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.06, ease: "power2.out" },
      0.16
    )
}

// The panel outlives `open` so it can animate away; `onClosed` tells the
// launcher it may unmount it. With reduced motion it goes at once.
export function usePanelMotion(open: boolean, onClosed: () => void) {
  const panel = useRef<HTMLDivElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const closed = useRef(onClosed)
  useEffect(() => {
    closed.current = onClosed
  })

  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    if (reducedMotion()) {
      if (!open) closed.current()
      return
    }
    const finish = () => {
      timeline.current?.kill()
      timeline.current = null
      closed.current()
    }
    timeline.current ??= buildPanelTimeline(el, finish)
    if (open) {
      const opening = timeline.current.timeScale(1).play()
      // Safety net: if the opening has not moved shortly after (a stalled
      // ticker, a throttled tab), show the finished panel instead.
      const check = setTimeout(() => {
        if (timeline.current === opening && opening.progress() === 0)
          opening.progress(1)
      }, SAFETY_MS)
      return () => clearTimeout(check)
    }
    // Reversing from the very start never completes: that would strand an
    // invisible panel.
    else if (timeline.current.time() === 0) finish()
    else timeline.current.timeScale(2.2).reverse()
  }, [open])

  // Drop the killed timeline too: React's dev StrictMode remounts effects,
  // and a kept dead timeline would leave the panel at its hidden from-state.
  useEffect(
    () => () => {
      timeline.current?.kill()
      timeline.current = null
    },
    []
  )

  return panel
}

export function useLauncherMotion(ready: boolean, open: boolean) {
  const launcher = useRef<HTMLButtonElement>(null)
  const chatIcon = useRef<HTMLSpanElement>(null)
  const closeIcon = useRef<HTMLSpanElement>(null)

  // The button arrives first; the hint beside it waits before it opens.
  useLayoutEffect(() => {
    if (!ready || !launcher.current || reducedMotion()) return
    const arrival = gsap.fromTo(
      launcher.current,
      { scale: 0 },
      { scale: 1, duration: 0.5, ease: "back.out(2)" }
    )
    return () => void arrival.revert()
  }, [ready])

  // The chat and X icons swap with a turn.
  useLayoutEffect(() => {
    if (!ready || !chatIcon.current || !closeIcon.current) return
    const duration = reducedMotion() ? 0 : 0.34
    const [shown, hidden] = open
      ? [closeIcon.current, chatIcon.current]
      : [chatIcon.current, closeIcon.current]
    gsap.to(shown, {
      opacity: 1,
      scale: 1,
      rotate: 0,
      duration,
      ease: "back.out(2)",
      overwrite: true,
    })
    gsap.to(hidden, {
      opacity: 0,
      scale: 0.4,
      rotate: open ? 90 : -90,
      duration: duration * 0.7,
      ease: "power2.in",
      overwrite: true,
    })
  }, [ready, open])

  // A press springs back elastically; on a mouse the button leans a few
  // pixels towards the pointer. The resting centre is measured on entry,
  // since measuring while it moves would feed its own motion back in.
  useEffect(() => {
    const button = launcher.current
    if (!ready || !button || reducedMotion()) return
    const press = () =>
      gsap.to(button, {
        scale: 0.88,
        duration: 0.12,
        ease: "power2.out",
        overwrite: "auto",
      })
    const release = () =>
      gsap.to(button, {
        scale: 1,
        duration: 0.55,
        ease: "elastic.out(1, 0.45)",
        overwrite: "auto",
      })
    const releases = ["pointerup", "pointercancel", "pointerleave"] as const
    button.addEventListener("pointerdown", press)
    for (const name of releases) button.addEventListener(name, release)

    const magnetic = finePointer()
    const toX = magnetic
      ? gsap.quickTo(button, "x", { duration: 0.35, ease: "power3" })
      : null
    const toY = magnetic
      ? gsap.quickTo(button, "y", { duration: 0.35, ease: "power3" })
      : null
    let centre = { x: 0, y: 0 }
    const enter = () => {
      const rect = button.getBoundingClientRect()
      centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    const move = (event: PointerEvent) => {
      toX?.((event.clientX - centre.x) * 0.18)
      toY?.((event.clientY - centre.y) * 0.18)
    }
    const leave = () => {
      toX?.(0)
      toY?.(0)
    }
    if (magnetic) {
      button.addEventListener("pointerenter", enter)
      button.addEventListener("pointermove", move)
      button.addEventListener("pointerleave", leave)
    }
    return () => {
      button.removeEventListener("pointerdown", press)
      for (const name of releases) button.removeEventListener(name, release)
      button.removeEventListener("pointerenter", enter)
      button.removeEventListener("pointermove", move)
      button.removeEventListener("pointerleave", leave)
      gsap.killTweensOf(button)
    }
  }, [ready])

  return { launcher, chatIcon, closeIcon }
}
