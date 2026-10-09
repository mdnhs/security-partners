"use client"

import { buttonClassName } from "@/components/ui/button"
import { contact } from "@/components/home/data"
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
      <label htmlFor={htmlFor} className="text-sm font-bold text-brand-navy">
        {label}
      </label>
      {children}
    </div>
  )
}

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
  const subject = `Website enquiry from ${name}`
  window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function ContactForm() {
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Field label="Your Name" htmlFor="name" className="flex-1">
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            placeholder="John Smith"
            className={cn(inputClass, "h-[54px]")}
          />
        </Field>
        <Field label="Email" htmlFor="email" className="flex-1">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.ie"
            className={cn(inputClass, "h-[54px]")}
          />
        </Field>
      </div>
      <Field label="Phone" htmlFor="phone">
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="085 000 0000"
          className={cn(inputClass, "h-[54px]")}
        />
      </Field>
      <Field label="Message" htmlFor="message">
        <textarea
          id="message"
          name="message"
          required
          placeholder="Tell us about your security requirements..."
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
        Send Message
      </button>
    </form>
  )
}
