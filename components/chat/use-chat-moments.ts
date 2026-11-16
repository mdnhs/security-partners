"use client"

import { gsap } from "gsap"
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

import { reducedMotion } from "./use-widget-motion"

// Port of JW features/chat/use-chat-moments.ts (live chat plan §3.2, §3.4,
// §3.5).

// A history restored in one go is part of the panel's opening, not news.
const MAX_ANIMATED = 3

export function takeNewIds(known: Set<string>, ids: string[]): string[] {
  const fresh = ids.filter((id) => !known.has(id))
  for (const id of fresh) known.add(id)
  return fresh
}

function animateMessage(element: HTMLElement, delay: number) {
  if (element.dataset.sender === "system") {
    gsap.fromTo(
      element,
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 0.3, delay, clearProps: "all" }
    )
    return
  }
  // The visitor's own message rises from the composer; a reply slides in
  // from its side.
  const mine = element.dataset.sender === "visitor"
  gsap.fromTo(
    element,
    {
      opacity: 0,
      x: mine ? 0 : -12,
      y: mine ? 44 : 16,
      scale: mine ? 0.82 : 0.92,
      transformOrigin: mine ? "100% 100%" : "0% 100%",
    },
    {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.44,
      delay,
      ease: "back.out(1.5)",
      clearProps: "all",
    }
  )
}

// The small events inside the open panel, each animated only when it
// happens. Everything renders in its finished look and only a `fromTo`
// moves it, so with reduced motion nothing is ever hidden.
export function usePanelMoments({
  messageIds,
  agentName,
  online,
  log,
}: {
  messageIds: number[]
  agentName: string | null
  online: boolean
  log: RefObject<HTMLElement | null>
}) {
  const avatar = useRef<HTMLSpanElement>(null)
  const statusLine = useRef<HTMLParagraphElement>(null)
  const onlineDot = useRef<HTMLSpanElement>(null)
  const known = useRef<Set<string> | null>(null)
  const previousAgent = useRef<string | null | undefined>(undefined)

  const messageKey = messageIds.join(",")
  useLayoutEffect(() => {
    const ids = messageKey.split(",").filter(Boolean)
    // Messages already there when the panel mounts are part of its opening.
    if (!known.current) {
      known.current = new Set(ids)
      return
    }
    const fresh = takeNewIds(known.current, ids)
    if (!log.current || reducedMotion() || fresh.length > MAX_ANIMATED) return
    fresh.forEach((id, index) => {
      const element = log.current?.querySelector<HTMLElement>(
        `[data-message-id="${id}"]`
      )
      if (element) animateMessage(element, index * 0.07)
    })
  }, [messageKey, log])

  useLayoutEffect(() => {
    const before = previousAgent.current
    previousAgent.current = agentName
    // The first run is the panel opening, not someone joining.
    const joined = before !== undefined && agentName && agentName !== before
    if (!joined || reducedMotion()) return
    gsap.fromTo(
      avatar.current,
      { scale: 0.3, rotate: -25 },
      { scale: 1, rotate: 0, duration: 0.55, ease: "back.out(2.2)" }
    )
    gsap.fromTo(
      statusLine.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
    )
  }, [agentName])

  useEffect(() => {
    if (!online || !onlineDot.current || reducedMotion()) return
    const pulse = gsap.to(onlineDot.current, {
      scale: 1.35,
      duration: 1.1,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    })
    return () => void pulse.revert()
  }, [online])

  return { avatar, statusLine, onlineDot }
}

// A new reply while the panel is closed: the launcher wiggles and the badge
// pops in.
export function useUnreadMoment(
  unread: boolean,
  launcher: RefObject<HTMLButtonElement | null>
) {
  const badge = useRef<HTMLSpanElement>(null)
  const previous = useRef(false)
  useLayoutEffect(() => {
    const rose = unread && !previous.current
    previous.current = unread
    if (!rose || !launcher.current || reducedMotion()) return
    gsap.to(launcher.current, {
      keyframes: { rotate: [0, -14, 11, -7, 4, 0] },
      duration: 0.6,
      ease: "power1.inOut",
    })
    if (badge.current)
      gsap.fromTo(
        badge.current,
        { scale: 0 },
        { scale: 1, duration: 0.5, ease: "back.out(3)" }
      )
  }, [unread, launcher])
  return badge
}
