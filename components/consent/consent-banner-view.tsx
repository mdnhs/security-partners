"use client"

import { type JSX, type Ref, useId } from "react"

import { buttonClassName } from "@/components/ui/button"
import type { ConsentChoice } from "@/lib/analytics/consent"
import type { Link } from "@/lib/schemas/common"

export type ConsentBannerCopy = {
  title: string
  body: string
  acceptLabel: string
  rejectLabel: string
  customiseLabel: string
  saveLabel: string
  manageLabel: string
  /** Accessible name of the reopened banner's × button. */
  closeLabel: string
  /** Already through linkView (placeholders filled, href re-checked). */
  policyLink: Link
  categories: Record<
    "necessary" | "analytics" | "marketing",
    { label: string; description: string }
  >
  /** A stored choice counts only under this consent version. */
  version: number
  /** How long a choice is kept (30-day months; the cookie's Max-Age). */
  reconsentMonths: number
}

export type ConsentBannerViewProps = {
  copy: ConsentBannerCopy
  /** first: Accept / Reject / Customise. custom: the categories. closed: the reopen button. */
  mode: "first" | "custom" | "closed"
  /** The categories' checkboxes (custom mode). */
  choice: ConsentChoice
  onAccept(): void
  onReject(): void
  /** Customise on the first layer, and the reopen button when closed. */
  onCustomise(): void
  onSave(): void
  onToggle(category: "analytics" | "marketing", on: boolean): void
  /** The × and Escape of a reopened banner. */
  onClose(): void
  /** In the page flow (position: static) for the admin preview; default fixed. */
  inline?: boolean
  /**
   * Custom mode reached through the reopen button: a × button, and Reject /
   * Accept / Save instead of Save alone.
   */
  reopened?: boolean
  sectionRef?: Ref<HTMLElement>
  headingRef?: Ref<HTMLHeadingElement>
  manageRef?: Ref<HTMLButtonElement>
}

const OPTIONAL = ["analytics", "marketing"] as const
/**
 * White on brand green is 2.36:1 (WCAG 1.4.3 needs 4.5:1 at this size): the
 * banner's green pills use navy text (7.25:1; 4.86:1 on the hover green).
 */
const ON_GREEN = "text-brand-navy hover:text-brand-navy"

/**
 * The cookie banner's markup (spec §10), with no state of its own: the
 * public ConsentBanner and the admin preview both render it. Styled with the
 * site's own tokens and buttons; Accept and Reject carry equal weight.
 */
export function ConsentBannerView({
  copy,
  mode,
  choice,
  onAccept,
  onReject,
  onCustomise,
  onSave,
  onToggle,
  onClose,
  inline = false,
  reopened = false,
  sectionRef,
  headingRef,
  manageRef,
}: ConsentBannerViewProps): JSX.Element {
  const titleId = useId()

  if (mode === "closed")
    return (
      <button
        ref={manageRef}
        type="button"
        onClick={onCustomise}
        className={buttonClassName(
          { variant: "brand", size: "pill-sm" },
          `${ON_GREEN} ${inline ? "static" : "fixed bottom-4 left-4 z-40"} shadow-lg`
        )}
      >
        {copy.manageLabel}
      </button>
    )
  const customising = mode === "custom"
  const pill = buttonClassName({ variant: "brand", size: "pill-sm" }, ON_GREEN)
  const outline = buttonClassName({ variant: "brand-outline", size: "pill-sm" })
  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      data-consent-banner
      className={`${inline ? "static" : "fixed inset-x-0 bottom-0 z-50"} p-4 md:p-6`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && reopened) onClose()
      }}
    >
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-5 rounded-2xl bg-brand-navy p-6 text-white shadow-2xl md:p-8">
        {reopened ? (
          <button
            type="button"
            aria-label={copy.closeLabel}
            onClick={onClose}
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
                  checked={choice[key]}
                  onChange={(event) => onToggle(key, event.target.checked)}
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
            <button type="button" className={pill} onClick={onSave}>
              {copy.saveLabel}
            </button>
          ) : reopened ? (
            <>
              <button type="button" className={pill} onClick={onReject}>
                {copy.rejectLabel}
              </button>
              <button type="button" className={pill} onClick={onAccept}>
                {copy.acceptLabel}
              </button>
              <button type="button" className={outline} onClick={onSave}>
                {copy.saveLabel}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={pill} onClick={onAccept}>
                {copy.acceptLabel}
              </button>
              <button type="button" className={pill} onClick={onReject}>
                {copy.rejectLabel}
              </button>
              <button type="button" className={outline} onClick={onCustomise}>
                {copy.customiseLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
