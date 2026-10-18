"use client"

import { useEffect, useId, useRef, useState } from "react"

import { buttonClassName } from "@/components/ui/button"
import type { ConsentChoice } from "@/lib/analytics/consent"
import type { Link } from "@/lib/schemas/common"

import { useConsent } from "./consent-provider"

export type ConsentBannerCopy = {
  title: string
  body: string
  acceptLabel: string
  rejectLabel: string
  customiseLabel: string
  saveLabel: string
  manageLabel: string
  /** Already through linkView (placeholders filled, href re-checked). */
  policyLink: Link
  categories: Record<
    "necessary" | "analytics" | "marketing",
    { label: string; description: string }
  >
}

const OPTIONAL = ["analytics", "marketing"] as const
const NONE: ConsentChoice = { analytics: false, marketing: false }
const ALL: ConsentChoice = { analytics: true, marketing: true }
/**
 * White on brand green is 2.36:1 (WCAG 1.4.3 needs 4.5:1 at this size): the
 * banner's green pills use navy text (7.25:1; 4.86:1 on the hover green).
 */
const ON_GREEN = "text-brand-navy hover:text-brand-navy"

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
  const titleId = useId()
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

  if (!open)
    return (
      <button
        ref={manageRef}
        type="button"
        onClick={() => {
          setDraft(choice ?? NONE)
          setCustomising(true)
          setReopened(true)
          reopen()
        }}
        className={buttonClassName(
          { variant: "brand", size: "pill-sm" },
          `${ON_GREEN} fixed bottom-4 left-4 z-40 shadow-lg`
        )}
      >
        {copy.manageLabel}
      </button>
    )
  const pill = buttonClassName({ variant: "brand", size: "pill-sm" }, ON_GREEN)
  const outline = buttonClassName({ variant: "brand-outline", size: "pill-sm" })
  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      data-consent-banner
      className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6"
      onKeyDown={(event) => {
        if (event.key === "Escape" && reopened) {
          done()
          close()
        }
      }}
    >
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-5 rounded-2xl bg-brand-navy p-6 text-white shadow-2xl md:p-8">
        {reopened ? (
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              done()
              close()
            }}
            className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-2xl leading-none text-white/85 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:outline-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
        <div className="flex flex-col gap-2">
          <h2
            ref={headingRef}
            id={titleId}
            tabIndex={-1}
            className="text-lg font-black outline-none md:text-xl"
          >
            {copy.title}
          </h2>
          <p className="text-[15px] leading-[1.6] text-white/85">
            {copy.body}{" "}
            <a
              href={copy.policyLink.href}
              className="font-bold text-brand-green underline underline-offset-4"
            >
              {copy.policyLink.label}
            </a>
          </p>
        </div>
        {customising ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">{copy.customiseLabel}</legend>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-1 size-4 accent-brand-green"
              />
              <span className="flex flex-col">
                <span className="font-bold">
                  {copy.categories.necessary.label}
                </span>
                <span className="text-sm text-white/75">
                  {copy.categories.necessary.description}
                </span>
              </span>
            </label>
            {OPTIONAL.map((key) => (
              <label key={key} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.checked })
                  }
                  className="mt-1 size-4 accent-brand-green"
                />
                <span className="flex flex-col">
                  <span className="font-bold">
                    {copy.categories[key].label}
                  </span>
                  <span className="text-sm text-white/75">
                    {copy.categories[key].description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {customising && !reopened ? (
            <button
              type="button"
              className={pill}
              onClick={() => choose(draft)}
            >
              {copy.saveLabel}
            </button>
          ) : reopened ? (
            <>
              <button
                type="button"
                className={pill}
                onClick={() => choose(NONE)}
              >
                {copy.rejectLabel}
              </button>
              <button
                type="button"
                className={pill}
                onClick={() => choose(ALL)}
              >
                {copy.acceptLabel}
              </button>
              <button
                type="button"
                className={outline}
                onClick={() => choose(draft)}
              >
                {copy.saveLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={pill}
                onClick={() => choose(ALL)}
              >
                {copy.acceptLabel}
              </button>
              <button
                type="button"
                className={pill}
                onClick={() => choose(NONE)}
              >
                {copy.rejectLabel}
              </button>
              <button
                type="button"
                className={outline}
                onClick={() => setCustomising(true)}
              >
                {copy.customiseLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
