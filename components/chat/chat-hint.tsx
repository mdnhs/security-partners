"use client"

import { gsap } from "gsap"
import { X } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import type { ChatSettings } from "@/lib/schemas/settings/chat"

import { finePointer, reducedMotion, touchOnly } from "./use-widget-motion"

// Port of JW features/chat/chat-hint.tsx (live chat plan §2.3, §3.7, §4).
// Every string comes from settings.chat; an empty preset message only opens
// the chat.

const ENTRANCE_DELAY_S = 0.5
const COLLAPSE_DELAY_MS = 320
const CLOSING_CIRCLE_RADIUS = 22
// A pill the height of the round launcher beside it; opening only makes it
// taller.
const PILL_RADIUS = 28
const CLIPPED = `inset(0% 0% 0% 100% round ${PILL_RADIUS}px)`
const REVEALED = `inset(0% 0% 0% 0% round ${PILL_RADIUS}px)`

export function ChatHint({
  hint,
  copy,
  online,
  skipEntrance,
  onEntered,
  onOpen,
  onGone,
}: {
  hint: ChatSettings["hint"]
  copy: Pick<ChatSettings["copy"], "hintGroup" | "hintDismiss">
  online: boolean
  skipEntrance: boolean
  onEntered: () => void
  onOpen: (message: string) => void
  onGone: () => void
}) {
  // Without presets there is no tray: the main row opens the chat.
  const hasTray = hint.presets.length > 0
  const [expanded, setExpanded] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLSpanElement>(null)
  const sheen = useRef<HTMLSpanElement>(null)
  const tray = useRef<HTMLDivElement>(null)
  const trayTimeline = useRef<gsap.core.Timeline | null>(null)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const hovering = useRef(false)
  const pressing = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  // Escape moves focus back to the trigger; that focus must not re-expand.
  const refocusing = useRef(false)
  const playEntrance = useRef(!skipEntrance)
  const announceEntered = useRef(onEntered)

  // Entrance: the pill unclips from the launcher side while a band of brand
  // colour sweeps across it, then the two lines rise into place.
  useLayoutEffect(() => {
    const card = root.current
    if (!card || !playEntrance.current || reducedMotion()) return
    const context = gsap.context(() => {
      gsap
        .timeline({
          delay: ENTRANCE_DELAY_S,
          onStart: () => announceEntered.current(),
        })
        .fromTo(
          card,
          { clipPath: CLIPPED },
          {
            clipPath: REVEALED,
            duration: 0.7,
            ease: "power4.inOut",
            clearProps: "clipPath",
          }
        )
        .fromTo(
          band.current,
          { xPercent: 100, opacity: 1 },
          { xPercent: -101, opacity: 1, duration: 0.85, ease: "power3.inOut" },
          0
        )
        .fromTo(
          card.querySelectorAll("[data-hint-rise]"),
          { yPercent: 110 },
          {
            yPercent: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
            clearProps: "all",
          },
          0.42
        )
    }, card)
    return () => context.revert()
  }, [])

  useLayoutEffect(() => {
    const panel = tray.current
    if (!panel) return
    const timeline = gsap
      .timeline({ paused: true })
      .fromTo(
        panel,
        { height: 0, autoAlpha: 0 },
        { height: "auto", autoAlpha: 1, duration: 0.4, ease: "power3.inOut" }
      )
      .fromTo(
        panel.querySelectorAll("li"),
        { x: 18, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: "power2.out" },
        0.12
      )
    trayTimeline.current = timeline
    return () => {
      timeline.kill()
      trayTimeline.current = null
    }
  }, [hasTray])

  useLayoutEffect(() => {
    const timeline = trayTimeline.current
    if (!timeline) return
    if (reducedMotion()) timeline.progress(expanded ? 1 : 0)
    else if (expanded) timeline.timeScale(1).play()
    else timeline.timeScale(1.5).reverse()
  }, [expanded])

  // On a mouse, a soft light follows the pointer and the pill leans into it.
  useEffect(() => {
    const card = root.current
    const light = sheen.current
    if (!card || !light || reducedMotion() || !finePointer()) return
    gsap.set(card, { transformPerspective: 800, transformOrigin: "100% 100%" })
    const tiltX = gsap.quickTo(card, "rotationX", {
      duration: 0.45,
      ease: "power3",
    })
    const tiltY = gsap.quickTo(card, "rotationY", {
      duration: 0.45,
      ease: "power3",
    })
    const move = (event: PointerEvent) => {
      const box = card.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = event.clientY - box.top
      light.style.setProperty("--sheen-x", `${x}px`)
      light.style.setProperty("--sheen-y", `${y}px`)
      tiltY((x / box.width - 0.5) * 7)
      tiltX((0.5 - y / box.height) * 6)
    }
    const enter = () =>
      gsap.to(light, { opacity: 1, duration: 0.3, overwrite: "auto" })
    const leave = () => {
      gsap.to(light, { opacity: 0, duration: 0.45, overwrite: "auto" })
      tiltX(0)
      tiltY(0)
    }
    card.addEventListener("pointerenter", enter)
    card.addEventListener("pointermove", move)
    card.addEventListener("pointerleave", leave)
    return () => {
      card.removeEventListener("pointerenter", enter)
      card.removeEventListener("pointermove", move)
      card.removeEventListener("pointerleave", leave)
      gsap.killTweensOf([card, light])
    }
  }, [])

  useEffect(() => () => clearTimeout(collapseTimer.current), [])

  // A tap elsewhere folds the options away; touch screens have no pointer to
  // leave.
  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setExpanded(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [expanded])

  const expandNow = () => {
    if (!hasTray) return
    clearTimeout(collapseTimer.current)
    setExpanded(true)
  }

  // The pill closes in on the spot that was clicked, holds there as a small
  // circle, then goes.
  const dismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
    const card = root.current
    if (!card || reducedMotion()) return onGone()
    const box = card.getBoundingClientRect()
    const button = event.currentTarget.getBoundingClientRect()
    // A keyboard press has no pointer position (detail is 0): close on the
    // button itself.
    const clientX = event.detail
      ? event.clientX
      : button.left + button.width / 2
    const clientY = event.detail
      ? event.clientY
      : button.top + button.height / 2
    const x = Math.round(clientX - box.left)
    const y = Math.round(clientY - box.top)
    const circle = (radius: number) => `circle(${radius}px at ${x}px ${y}px)`
    const covers = Math.ceil(
      Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y))
    )
    gsap.set(card, { pointerEvents: "none" })
    gsap
      .timeline({ onComplete: onGone })
      .fromTo(
        card,
        { clipPath: circle(covers) },
        {
          clipPath: circle(CLOSING_CIRCLE_RADIUS),
          duration: 0.34,
          ease: "power3.inOut",
          overwrite: "auto",
        }
      )
      .to(
        card,
        { clipPath: circle(0), duration: 0.16, ease: "power2.in" },
        "+=0.04"
      )
  }

  return (
    <div
      ref={root}
      role="group"
      aria-label={copy.hintGroup}
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return
        hovering.current = true
        expandNow()
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return
        hovering.current = false
        collapseTimer.current = setTimeout(() => {
          if (!root.current?.contains(document.activeElement))
            setExpanded(false)
        }, COLLAPSE_DELAY_MS)
      }}
      onPointerDownCapture={() => {
        pressing.current = true
      }}
      onPointerUpCapture={() => {
        pressing.current = false
      }}
      onFocusCapture={() => {
        // A tap focuses the button after pointerup and before click, so touch
        // screens are left to the click.
        if (refocusing.current) {
          refocusing.current = false
          return
        }
        if (!pressing.current && !touchOnly()) expandNow()
      }}
      onBlurCapture={(event) => {
        if (
          !hovering.current &&
          !root.current?.contains(event.relatedTarget as Node | null)
        )
          setExpanded(false)
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !expanded) return
        // The folded tray is hidden: focus on an option would drop to the
        // page, so it goes back to the trigger first.
        if (tray.current?.contains(document.activeElement)) {
          refocusing.current = true
          trigger.current?.focus()
          refocusing.current = false
        }
        setExpanded(false)
      }}
      className="relative w-[min(272px,calc(100vw-104px))] overflow-hidden rounded-[28px] border border-white/16 bg-brand-navy/50 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_18px_44px_-14px_rgb(0_0_0/0.5)] backdrop-blur-md backdrop-saturate-150 will-change-transform max-[339px]:hidden"
    >
      <span
        ref={sheen}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-0 [background:radial-gradient(220px_140px_at_var(--sheen-x,50%)_var(--sheen-y,50%),rgb(255_255_255/0.14),transparent_72%)]"
      />
      <span
        ref={band}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-brand-green opacity-0"
      />

      {hasTray ? (
        <div ref={tray} className="h-0 overflow-hidden">
          <ul className="border-b border-white/12 px-2 pt-3 pb-1.5">
            {hint.presets.map((preset, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => onOpen(preset.message)}
                  className="group/option relative flex min-h-11 w-full cursor-pointer items-center overflow-hidden rounded-full px-4 text-left text-[15px] text-white/90 outline-none"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 origin-left scale-x-0 rounded-full bg-brand-green transition-transform duration-300 ease-out group-hover/option:scale-x-100 group-focus-visible/option:scale-x-100 motion-reduce:transition-none"
                  />
                  <span className="relative transition-colors duration-300 group-hover/option:text-white group-focus-visible/option:text-white motion-reduce:transition-none">
                    {preset.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="relative flex items-center">
        <button
          ref={trigger}
          type="button"
          aria-label={hint.title}
          aria-expanded={hasTray ? expanded : undefined}
          // Only an option opens the chat. A tap toggles, as a touch screen
          // has no pointer to leave. With no options the row opens it.
          onClick={() =>
            hasTray
              ? setExpanded((was) => (touchOnly() ? !was : true))
              : onOpen("")
          }
          className="min-h-14 min-w-0 flex-1 cursor-pointer py-2 pr-1 pl-5 text-left outline-none focus-visible:bg-white/8"
        >
          <span className="block overflow-hidden">
            <span
              data-hint-rise
              className="flex items-center gap-2 font-heading text-base leading-6 font-semibold text-white"
            >
              {online ? (
                <span
                  aria-hidden
                  data-online-dot
                  className="size-2 shrink-0 rounded-full bg-emerald-500"
                />
              ) : null}
              {hint.title}
            </span>
          </span>
          <span className="block overflow-hidden">
            <span
              data-hint-rise
              className="block text-[13px] leading-5 text-white/80"
            >
              {hint.subtitle}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={copy.hintDismiss}
          className="mr-1.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-white/60 outline-none hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-white/70"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
