"use client"

import { motion } from "motion/react"
import { type MouseEvent, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * The admin's shared tab/menu motion: the active pill and bar slide to the
 * chosen item (motion layoutId), and the content fades and rises in. Wrap
 * a set in <MotionConfig reducedMotion="user"> so reduced motion jumps.
 */
export const INDICATOR_SPRING = {
  type: "spring",
  bounce: 0.15,
  duration: 0.35,
} as const

/** Content entering on a tab or menu change (replays on unhide/remount). */
export const PANEL_ENTER =
  "animate-in duration-200 ease-out fade-in slide-in-from-bottom-1 motion-reduce:animate-none"

/** The active item's background; the item itself drops its own bg. */
export function ActivePill({
  layoutId,
  className,
}: {
  layoutId: string
  className?: string
}) {
  return (
    <motion.span
      aria-hidden
      layoutId={layoutId}
      className={cn("absolute inset-0 rounded-md bg-sidebar-accent", className)}
      transition={INDICATOR_SPRING}
    />
  )
}

/** The active item's primary edge bar (position from `className`). */
export function ActiveBar({
  layoutId,
  className,
  slot,
}: {
  layoutId: string
  className: string
  /** data-slot, for tests and styling hooks. */
  slot?: string
}) {
  return (
    <motion.span
      aria-hidden
      data-slot={slot}
      layoutId={layoutId}
      className={cn("rounded-r-full bg-primary", className)}
      transition={INDICATOR_SPRING}
    />
  )
}

/**
 * A link set's current item, lit at once on click (the pill starts sliding
 * then, not when the next page lands); the routed item takes over once the
 * path changes. `mark(id)` is the link's onClick.
 */
export function useClickedCurrent<T extends string | undefined>(
  routed: T,
  pathname: string
): [current: string | T, mark: (id: string) => (event: MouseEvent) => void] {
  const [clicked, setClicked] = useState<{ id: string; from: string }>()
  const current = clicked && clicked.from === pathname ? clicked.id : routed
  const mark = (id: string) => (event: MouseEvent) => {
    // A new-tab/window click leaves this page where it is.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.button === 0) setClicked({ id, from: pathname })
  }
  return [current, mark]
}
