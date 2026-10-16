"use client"

import { CircleAlert } from "lucide-react"
import type { ReactNode } from "react"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"

/** A field label: medium weight, small. */
export const LABEL_CLASS = "text-sm font-medium"

/** An error message with its icon (WCAG 1.4.1: not colour alone). */
export function ErrorText({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  return (
    <FieldError id={id} className="flex items-start gap-1.5">
      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </FieldError>
  )
}

/** The hint under a label (`${id}-help`). */
export function HelpText({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  return (
    <p id={id} className="text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * Label, hint and error around one input (JW field look): label and hint
 * above the control, `extra` (e.g. a counter) and the error below. Ids
 * follow `${id}-help` / `${id}-error`; widgets pass `describedBy(id, …)`.
 */
export function FieldShell({
  id,
  label,
  help,
  error,
  optional,
  extra,
  children,
}: {
  id: string
  label: string
  help?: string
  error?: string
  optional?: boolean
  /** Under the input, before the error (e.g. a character counter). */
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <Field data-invalid={error ? true : undefined} className="gap-2">
      <div className="flex flex-col gap-0.5">
        {/* JW: required is the default (the form says so once and the
            input has aria-required); only optional fields are marked. */}
        <FieldLabel htmlFor={id} className={LABEL_CLASS}>
          {label}
          {optional ? (
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          ) : null}
        </FieldLabel>
        {help ? <HelpText id={`${id}-help`}>{help}</HelpText> : null}
      </div>
      {children}
      {extra}
      {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
    </Field>
  )
}

/** aria-describedby for an input inside FieldShell. */
export function describedBy(
  id: string,
  opts: { help?: string; error?: string; extraId?: string }
): string | undefined {
  const ids = [
    opts.help ? `${id}-help` : null,
    opts.extraId,
    opts.error ? `${id}-error` : null,
  ].filter(Boolean)
  return ids.length ? ids.join(" ") : undefined
}

/** RHF error message of a field, including list/group "root" errors. */
export function errorText(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const e = error as { message?: string; root?: { message?: string } }
  return e.message || e.root?.message || undefined
}

/**
 * The field's own message, else the first message nested inside it — for
 * widgets that edit a whole object (media `{ mediaId }`, rich text) where a
 * server error may name an inner path ("hero.image.mediaId").
 */
export function deepErrorText(error: unknown): string | undefined {
  const own = errorText(error)
  if (own || !error || typeof error !== "object") return own
  for (const [key, child] of Object.entries(error))
    if (key !== "ref" && key !== "type" && typeof child === "object") {
      const nested = deepErrorText(child)
      if (nested) return nested
    }
  return undefined
}
