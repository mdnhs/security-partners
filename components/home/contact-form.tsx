"use client"

import { buttonClassName } from "@/components/ui/button"
import { interpolate } from "@/lib/interpolate"
import { cn } from "@/lib/utils"

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

export type ContactFormProps = {
  labels: {
    nameLabel: string
    namePlaceholder: string
    emailLabel: string
    emailPlaceholder: string
    phoneLabel: string
    phonePlaceholder: string
    messageLabel: string
    messagePlaceholder: string
    submitLabel: string
  }
  /** Until Phase 7 the enquiry opens the visitor's mail client. */
  mailto: { email: string; subject: string }
}

export function ContactForm({ labels, mailto }: ContactFormProps) {
  // No backend yet: hand the enquiry to the visitor's mail client.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get("name") ?? "")
    const body = [
      `Name: ${name}`,
      `Email: ${data.get("email") ?? ""}`,
      `Phone: ${data.get("phone") ?? ""}`,
      "",
      String(data.get("message") ?? ""),
    ].join("\n")
    const subject = interpolate(mailto.subject, { name })
    window.location.href = `mailto:${mailto.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        className={buttonClassName(
          { variant: "brand", size: "pill" },
          "w-full"
        )}
      >
        {labels.submitLabel}
      </button>
    </form>
  )
}
