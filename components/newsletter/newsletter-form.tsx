"use client"

import { useRef, useState } from "react"

import { Container, Eyebrow } from "@/components/home/section"
import { useTurnstile } from "@/components/home/use-turnstile"
import { buttonClassName } from "@/components/ui/button"
import { track } from "@/lib/analytics/events"
import { NEWSLETTER_ENDPOINT } from "@/lib/schemas/api/newsletter"
import type { NewsletterPublicCopy } from "@/lib/schemas/settings/newsletter"
import { cn } from "@/lib/utils"

type Phase =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done" }
  | { kind: "error"; message: string }

const inputClass =
  "h-[54px] w-full rounded-xl border border-brand-line bg-white px-[18px] text-[15px] text-brand-navy outline-none placeholder:text-brand-placeholder focus-visible:border-brand-blue focus-visible:ring-3 focus-visible:ring-brand-blue/20"

/**
 * Public newsletter signup (D4.2). Rendered only where settings.newsletter
 * places it (NewsletterSection); the server answers every valid address
 * with the same 201, so the success copy never says whether it was new.
 */
export function NewsletterForm({
  id,
  copy,
}: {
  id: string
  copy: NewsletterPublicCopy
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  // State lags a tick behind; the ref blocks a double submit.
  const inFlight = useRef(false)
  const turnstileSlot = useRef<HTMLDivElement>(null)
  const turnstile = useTurnstile(turnstileSlot)
  const titleId = `${id}-title`
  const emailId = `${id}-email`
  const errorId = `${id}-error`
  const sending = phase.kind === "sending"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) ?? "")
    setPhase({ kind: "sending" })
    try {
      const turnstileToken = await turnstile.getToken()
      const res = await fetch(NEWSLETTER_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: field("email"),
          website: field("website"),
          sourcePath: window.location.pathname,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      })
      if (res.status === 201) {
        track({ event: "newsletter_sign_up", method: "newsletter" })
        setPhase({ kind: "done" })
        return
      }
      setPhase({
        kind: "error",
        message:
          res.status === 429
            ? copy.errors.rateLimited
            : res.status === 400 || res.status === 422
              ? copy.errors.email
              : copy.errors.generic,
      })
    } catch {
      setPhase({ kind: "error", message: copy.errors.generic })
    } finally {
      inFlight.current = false
      turnstile.reset()
    }
  }

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="relative bg-white px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col items-center gap-8 text-center">
        <div data-stagger className="flex flex-col items-center gap-3.5">
          {copy.eyebrow && <Eyebrow>{copy.eyebrow}</Eyebrow>}
          <h2
            id={titleId}
            className="text-4xl leading-[1.15] font-black tracking-[-0.01em] text-brand-navy md:text-[44px]"
          >
            {copy.title}
          </h2>
          {copy.subtitle && (
            <p className="max-w-[680px] text-lg leading-[1.6] text-brand-ink">
              {copy.subtitle}
            </p>
          )}
        </div>
        {phase.kind === "done" ? (
          <p
            role="status"
            className="text-[17px] leading-normal font-bold text-brand-green-dark"
          >
            {copy.success}
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            onFocus={() => void turnstile.prepare()}
            className="flex w-full max-w-[560px] flex-col gap-3 text-left"
          >
            <label
              htmlFor={emailId}
              className="text-sm leading-[normal] font-bold text-brand-navy"
            >
              {copy.emailLabel}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id={emailId}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={copy.placeholder}
                aria-invalid={phase.kind === "error" || undefined}
                aria-describedby={phase.kind === "error" ? errorId : undefined}
                className={cn(inputClass, "sm:flex-1")}
              />
              <button
                type="submit"
                disabled={sending}
                aria-busy={sending || undefined}
                className={buttonClassName(
                  { variant: "brand", size: "pill" },
                  "shrink-0"
                )}
              >
                {copy.button}
              </button>
            </div>
            {/* Honeypot: invisible to people and assistive tech, filled by bots. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 -left-[10000px] h-px w-px overflow-hidden opacity-0"
            >
              <label htmlFor={`${id}-website`}>Website</label>
              <input
                id={`${id}-website`}
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            {phase.kind === "error" && (
              <p
                id={errorId}
                role="alert"
                className="text-[15px] leading-normal font-bold text-red-700"
              >
                {phase.message}
              </p>
            )}
          </form>
        )}
        <div ref={turnstileSlot} className="absolute h-0 w-0 overflow-hidden" />
      </Container>
    </section>
  )
}
