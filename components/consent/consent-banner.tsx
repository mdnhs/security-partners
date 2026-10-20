"use client"

import { useEffect, useRef, useState } from "react"

import type { ConsentChoice } from "@/lib/analytics/consent"

import {
  type ConsentBannerCopy,
  ConsentBannerView,
} from "./consent-banner-view"
import { useConsent } from "./consent-provider"

export type { ConsentBannerCopy }

const NONE: ConsentChoice = { analytics: false, marketing: false }
const ALL: ConsentChoice = { analytics: true, marketing: true }

/**
 * Keeps focused content visible above the fixed banner (WCAG 2.4.11): while
 * it is open, <html> gets a bottom scroll padding of the banner's height,
 * so focusing (or scrolling to) an element never leaves it underneath.
 */
function useScrollPaddingFor(
  ref: React.RefObject<HTMLElement | null>,
  on: boolean
) {
  useEffect(() => {
    const el = ref.current
    if (!on || !el) return
    const root = document.documentElement
    const previous = root.style.scrollPaddingBottom
    const apply = () => {
      root.style.scrollPaddingBottom = `${Math.ceil(el.getBoundingClientRect().height)}px`
    }
    apply()
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.scrollPaddingBottom = previous
    }
  }, [ref, on])
}

/**
 * The cookie banner (spec §10): rendered only when tracking is enabled,
 * styled with the site's own tokens and buttons. Accept and Reject carry
 * equal weight; the page stays usable (not modal). After a choice a small
 * "Cookie settings" button lets the visitor change it; reopening shows the
 * categories with Reject / Accept / Save and a close button. Focus: the
 * heading on reopening, the "Cookie settings" button after a choice.
 */
export function ConsentBanner({ copy }: { copy: ConsentBannerCopy }) {
  const { choice, bannerOpen, reopen, close, save } = useConsent()
  const [customising, setCustomising] = useState(false)
  const [reopened, setReopened] = useState(false)
  const [draft, setDraft] = useState<ConsentChoice>(NONE)
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const manageRef = useRef<HTMLButtonElement>(null)
  /** Set by a choice or close: focus "Cookie settings" once it renders. */
  const focusManage = useRef(false)
  const open = choice !== "pending" && bannerOpen

  useScrollPaddingFor(sectionRef, open)
  useEffect(() => {
    if (open && reopened) headingRef.current?.focus()
  }, [open, reopened])
  useEffect(() => {
    if (open || !focusManage.current) return
    focusManage.current = false
    manageRef.current?.focus()
  }, [open])

  if (choice === "pending") return null

  const done = () => {
    focusManage.current = true
    setCustomising(false)
    setReopened(false)
  }
  const choose = (next: ConsentChoice) => {
    done()
    save(next)
  }

  return (
    <ConsentBannerView
      copy={copy}
      mode={!open ? "closed" : customising ? "custom" : "first"}
      choice={draft}
      reopened={open && reopened}
      sectionRef={sectionRef}
      headingRef={headingRef}
      manageRef={manageRef}
      onAccept={() => choose(ALL)}
      onReject={() => choose(NONE)}
      onCustomise={() => {
        if (open) return setCustomising(true)
        setDraft(choice ?? NONE)
        setCustomising(true)
        setReopened(true)
        reopen()
      }}
      onSave={() => choose(draft)}
      onToggle={(key, on) => setDraft({ ...draft, [key]: on })}
      onClose={() => {
        done()
        close()
      }}
    />
  )
}
