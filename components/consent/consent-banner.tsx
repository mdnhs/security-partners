"use client"

import { useId, useState } from "react"

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

/**
 * The cookie banner (spec §10): rendered only when tracking is enabled,
 * styled with the site's own tokens and buttons. Accept and Reject carry
 * equal weight; the page stays usable (not modal). After a choice a small
 * "Cookie settings" button lets the visitor change it.
 */
export function ConsentBanner({ copy }: { copy: ConsentBannerCopy }) {
  const { choice, bannerOpen, reopen, save } = useConsent()
  const [customising, setCustomising] = useState(false)
  const [draft, setDraft] = useState<ConsentChoice>(NONE)
  const titleId = useId()
  if (choice === "pending") return null
  if (!bannerOpen)
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(choice ?? NONE)
          setCustomising(true)
          reopen()
        }}
        className={buttonClassName(
          { variant: "brand", size: "pill-sm" },
          "fixed bottom-4 left-4 z-40 shadow-lg"
        )}
      >
        {copy.manageLabel}
      </button>
    )
  const pill = buttonClassName({ variant: "brand", size: "pill-sm" })
  const outline = buttonClassName({ variant: "brand-outline", size: "pill-sm" })
  return (
    <section
      aria-labelledby={titleId}
      data-consent-banner
      className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-5 rounded-2xl bg-brand-navy p-6 text-white shadow-2xl md:p-8">
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-lg font-black md:text-xl">
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
          {customising ? (
            <button type="button" className={pill} onClick={() => save(draft)}>
              {copy.saveLabel}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={pill}
                onClick={() => save({ analytics: true, marketing: true })}
              >
                {copy.acceptLabel}
              </button>
              <button type="button" className={pill} onClick={() => save(NONE)}>
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
