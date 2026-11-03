"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

type Client = { name: string; logo: string }

/** One logo card plus the gap after it, in px: the loop's unit of width. */
const CARD = 240
const GAP = 20
/** One group is at least this wide, so a short list still fills a wide screen. */
const GROUP_MIN = 1920
/** px per second: slow enough to read the logos. */
const SPEED = 55
/** What an arrow key moves the strip by, in px. */
const KEY_STEP = 240
/** A touch that moves less than this (px) and ends quickly is a tap. */
const TAP_SLOP = 8
const TAP_MS = 350
/** True when focus got here by keyboard (not by a pointer press). */
function keyboardFocus(element: Element) {
  try {
    return element.matches(":focus-visible")
  } catch {
    // A browser that does not know :focus-visible: stay safe and stop it.
    return true
  }
}
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

/**
 * The clients' logos as a full-width strip that drifts sideways on its own, a
 * seamless loop: the list is laid out twice and the track slides one group's
 * width, then starts again from the same picture. The second copy is hidden
 * from assistive technology and the keyboard.
 *
 * You can take hold of it. A mouse stops it while it is over the strip (and
 * holding the button drags it); a finger drags it, and a tap stops it, the
 * next tap starts it again. Keyboard focus stops it and the arrow keys move
 * it. Dragging wraps round the loop in both directions, so there is no end.
 * Vertical swipes still scroll the page.
 *
 * Visitors who ask for reduced motion (and anyone before the script runs, or
 * without it) get the logos standing still, wrapped into rows inside the page
 * width, so nothing is cut off and nothing needs scrolling.
 */
export function ClientsCarousel({
  label,
  clients,
}: {
  /** The carousel's accessible name. */
  label: string
  clients: Client[]
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<Animation | null>(null)
  /** Width of one group (px) and the time one loop takes (ms). */
  const loopRef = useRef({ width: 0, duration: 0 })
  const dragRef = useRef<{
    id: number
    startX: number
    startTime: number
    startAt: number
    moved: boolean
    pointerType: string
  } | null>(null)
  const [hovering, setHovering] = useState(false)
  const [holding, setHolding] = useState(false)
  const [focused, setFocused] = useState(false)
  /** Stopped by a tap on a touch screen. */
  const [tapStopped, setTapStopped] = useState(false)

  const repeat = Math.max(
    1,
    Math.ceil(GROUP_MIN / (Math.max(clients.length, 1) * (CARD + GAP)))
  )
  const group = Array.from({ length: repeat }, (_, copy) =>
    clients.map((client) => ({ client, copy, key: `${copy}-${client.name}` }))
  ).flat()

  // Start the loop once, unless the visitor prefers no motion.
  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track || typeof track.animate !== "function") return
    const query = window.matchMedia(REDUCED_MOTION)
    if (query.matches) return
    const width = track.firstElementChild?.getBoundingClientRect().width
    if (!width) return

    // Past this point the strip is a window onto a moving track.
    viewport.style.overflow = "hidden"
    const duration = (width / SPEED) * 1000
    loopRef.current = { width, duration }
    const animation = track.animate(
      [
        { transform: "translateX(0)" },
        { transform: `translateX(-${width}px)` },
      ],
      { duration, iterations: Infinity, easing: "linear" }
    )
    animationRef.current = animation
    const stop = () => animation.cancel()
    query.addEventListener?.("change", stop)
    return () => {
      query.removeEventListener?.("change", stop)
      animation.cancel()
      animationRef.current = null
      viewport.style.overflow = ""
    }
  }, [])

  // Running only while nothing holds it.
  useEffect(() => {
    const animation = animationRef.current
    if (!animation) return
    if (hovering || holding || focused || tapStopped) animation.pause()
    else animation.play()
  }, [hovering, holding, focused, tapStopped])

  /** Moves the loop to a time, wrapped into [0, one loop). */
  function seek(time: number) {
    const animation = animationRef.current
    const { duration } = loopRef.current
    if (!animation || !duration) return
    animation.currentTime = ((time % duration) + duration) % duration
  }

  const now = () => Number(animationRef.current?.currentTime ?? 0)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!animationRef.current) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startTime: now(),
      startAt: event.timeStamp,
      moved: false,
      pointerType: event.pointerType,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setHolding(true)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const { width, duration } = loopRef.current
    if (!drag || drag.id !== event.pointerId || !width) return
    const dx = event.clientX - drag.startX
    if (Math.abs(dx) > TAP_SLOP) drag.moved = true
    // Pulling the strip left shows what is further along the loop.
    seek(drag.startTime - (dx / width) * duration)
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setHolding(false)
    const quick = event.timeStamp - drag.startAt < TAP_MS
    if (event.type === "pointerup" && drag.pointerType !== "mouse") {
      if (!drag.moved && quick) setTapStopped((stopped) => !stopped)
      // A swipe leaves it running again.
      else setTapStopped(false)
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const { width, duration } = loopRef.current
    if (!width) return
    const step = (KEY_STEP / width) * duration
    if (event.key === "ArrowRight") seek(now() + step)
    else if (event.key === "ArrowLeft") seek(now() - step)
    else return
    event.preventDefault()
  }

  const cards = group.map(({ client, copy, key }) => (
    // Past the first pass the logos only fill the strip: not read out, not
    // focusable, and not shown when the strip stands still.
    <li
      key={key}
      aria-hidden={copy > 0 ? "true" : undefined}
      inert={copy > 0}
      className={cn(
        "flex h-[120px] w-[240px] shrink-0 items-center justify-center rounded-[20px] border border-brand-line bg-white px-7 py-5 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_14px_30px_0px_rgba(13,26,51,0.12)] motion-safe:hover:scale-105",
        copy > 0 && "motion-reduce:hidden"
      )}
    >
      <div className="relative h-[76px] w-[200px] max-w-full">
        <Image
          src={client.logo}
          alt={client.name}
          fill
          sizes="200px"
          loading="eager"
          draggable={false}
          className="object-contain select-none"
        />
      </div>
    </li>
  ))

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      // Only keyboard focus stops it: a mouse click also focuses a tabbable
      // element, and that must not hold the strip after the pointer leaves.
      onFocus={(event) => setFocused(keyboardFocus(event.currentTarget))}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={cn(
        // py-12 / -mb-12: the box clips what leaves it (it must, to hide the rest of
        // the loop), so it is padded to hold a card's hover lift and its shadow
        // (about 45px below); the negative margin gives that room back, so the
        // page around the strip does not move. mt-2 is the 56px gap above
        // the cards (8px + 48px of padding).
        "mt-2 -mb-12 w-full touch-pan-y [scrollbar-width:none] overflow-x-auto py-12",
        "cursor-grab select-none active:cursor-grabbing",
        "[mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-green",
        "motion-reduce:cursor-auto motion-reduce:overflow-visible motion-reduce:[mask-image:none]"
      )}
    >
      <div
        ref={trackRef}
        className="flex w-max motion-reduce:mx-auto motion-reduce:block motion-reduce:w-auto motion-reduce:max-w-[1200px] motion-reduce:px-6 md:motion-reduce:px-10"
      >
        <ul className="flex shrink-0 gap-5 pr-5 motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0">
          {cards}
        </ul>
        <ul
          aria-hidden="true"
          inert
          className="flex shrink-0 gap-5 pr-5 motion-reduce:hidden"
        >
          {cards}
        </ul>
      </div>
    </div>
  )
}
