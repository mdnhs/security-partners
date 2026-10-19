"use client"

import { useRef, useState } from "react"

import { buttonClassName } from "@/components/ui/button"
import { track } from "@/lib/analytics/events"
import {
  analyticsConsent,
  readAttribution,
  sessionStore,
} from "@/lib/leads/attribution"
import { LEADS_ENDPOINT } from "@/lib/schemas/api/leads"
import { cn } from "@/lib/utils"

import { useTurnstile } from "./use-turnstile"

const inputClass =
  "w-full rounded-xl border border-brand-line bg-brand-surface px-[18px] text-[15px] text-brand-navy outline-none placeholder:text-brand-placeholder focus-visible:border-brand-blue focus-visible:ring-3 focus-visible:ring-brand-blue/20"

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm leading-[normal] font-bold text-brand-navy"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

export type ContactFormLabels = {
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  messageLabel: string
  messagePlaceholder: string
  submitLabel: string
  sendingLabel: string
  successMessage: string
  errorMessage: string
  rateLimitedMessage: string
}

export type ContactFormProps = { labels: ContactFormLabels }

type Feedback = { kind: "success" | "error"; message: string }

/**
 * Enquiry form (spec §9): posts to the leads API. Everything added for the
 * API is absolutely positioned (outside the flex flow) so the form looks
 * exactly as before until it is submitted.
 */
export function ContactForm({ labels }: ContactFormProps) {
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  // State is read from a stale closure until React re-renders; the ref
  // blocks a second submit fired in the same tick.
  const inFlight = useRef(false)
  const turnstileSlot = useRef<HTMLDivElement>(null)
  const turnstile = useTurnstile(turnstileSlot)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    const form = event.currentTarget
    const data = new FormData(form)
    const field = (name: string) => String(data.get(name) ?? "")
    setSending(true)
    setFeedback(null)
    try {
      const turnstileToken = await turnstile.getToken()
      // First touch (D3.1), only with analytics consent; never part of
      // analytics events.
      const attribution =
        analyticsConsent() === true ? readAttribution(sessionStore()) : null
      const res = await fetch(LEADS_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: field("name"),
          email: field("email"),
          phone: field("phone"),
          message: field("message"),
          consent: true,
          sourcePage: window.location.pathname,
          website: field("website"),
          ...(turnstileToken ? { turnstileToken } : {}),
          ...(attribution ? { attribution } : {}),
        }),
      })
      if (res.ok) {
        form.reset()
        // Typed event; sent only if the visitor consented (lib/analytics).
        track({
          event: "lead_submitted",
          source_page: window.location.pathname,
        })
        setFeedback({ kind: "success", message: labels.successMessage })
      } else {
        setFeedback({
          kind: "error",
          message:
            res.status === 429
              ? labels.rateLimitedMessage
              : labels.errorMessage,
        })
      }
    } catch {
      setFeedback({ kind: "error", message: labels.errorMessage })
    } finally {
      inFlight.current = false
      setSending(false)
      turnstile.reset()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={() => void turnstile.prepare()}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <Field label={labels.nameLabel} htmlFor="name" className="flex-1">
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            placeholder={labels.namePlaceholder}
            className={cn(inputClass, "h-[54px]")}
          />
        </Field>
        <Field label={labels.emailLabel} htmlFor="email" className="flex-1">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={labels.emailPlaceholder}
            className={cn(inputClass, "h-[54px]")}
          />
        </Field>
      </div>
      <Field label={labels.phoneLabel} htmlFor="phone">
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder={labels.phonePlaceholder}
          className={cn(inputClass, "h-[54px]")}
        />
      </Field>
      <Field label={labels.messageLabel} htmlFor="message">
        <textarea
          id="message"
          name="message"
          required
          placeholder={labels.messagePlaceholder}
          className={cn(inputClass, "h-[130px] resize-y pt-4")}
        />
      </Field>
      <button
        type="submit"
        disabled={sending}
        className={buttonClassName(
          { variant: "brand", size: "pill" },
          "w-full"
        )}
      >
        {sending ? labels.sendingLabel : labels.submitLabel}
      </button>
      {/* Honeypot: invisible to people and assistive tech, filled by bots. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -left-[10000px] h-px w-px overflow-hidden opacity-0"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div ref={turnstileSlot} className="absolute h-0 w-0 overflow-hidden" />
      <p
        role="status"
        aria-live="polite"
        className={
          feedback
            ? cn(
                "text-[15px] leading-normal font-bold",
                feedback.kind === "success"
                  ? "text-brand-green-dark"
                  : "text-red-700"
              )
            : "sr-only"
        }
      >
        {feedback?.message ?? ""}
      </p>
    </form>
  )
}
