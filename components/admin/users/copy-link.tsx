"use client"

import { Check, Copy, MailCheck, MailX } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { FORM_ACTION } from "@/components/admin/page-header"
import { LABEL_CLASS } from "@/components/admin/schema-form/widgets/field-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * A one-time link the admin can pass on (spec §6: the UI always shows it,
 * so invites work without SMTP), plus whether the email went out.
 */
export function CopyLink({
  id,
  label,
  url,
  emailDelivered,
  email,
  expiry,
}: {
  id: string
  label: string
  url: string
  emailDelivered: boolean
  email: string
  /** e.g. "in 7 days" */
  expiry: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <p
        role="status"
        className={cn(
          "flex items-start gap-2 rounded-xl p-3 text-sm",
          emailDelivered
            ? "bg-success-soft text-success"
            : "bg-warning-soft text-warning"
        )}
      >
        {emailDelivered ? (
          <>
            <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              We emailed this link to {email}. You can also copy it below.
            </span>
          </>
        ) : (
          <>
            <MailX aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Email is not set up, so nothing was sent to {email}. Copy the link
              and send it yourself.
            </span>
          </>
        )}
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={LABEL_CLASS}>
          {label}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={id}
            readOnly
            value={url}
            className={cn(ADMIN_CONTROL, "font-mono text-xs md:text-xs")}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            type="button"
            variant="outline"
            className={cn(FORM_ACTION, "shrink-0")}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                setCopied(true)
                toast.success("Link copied")
              } catch {
                toast.error("Could not copy", {
                  description: "Select the link and copy it yourself.",
                })
              }
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          The link works once and expires {expiry}. Creating a new link stops
          the old one.
        </p>
      </div>
    </div>
  )
}
