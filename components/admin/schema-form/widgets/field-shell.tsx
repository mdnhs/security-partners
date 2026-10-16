"use client"

import type { ReactNode } from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

/**
 * Label, help and error around one input. Ids follow `${id}-help` /
 * `${id}-error`; widgets pass `describedBy(id, …)` to their input.
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
  /** Under the input, before help (e.g. a character counter). */
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">(optional)</span>
        ) : null}
      </FieldLabel>
      {children}
      {extra}
      {help ? (
        <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}

/** aria-describedby for an input inside FieldShell. */
export function describedBy(
  id: string,
  opts: { help?: string; error?: string; extraId?: string }
): string | undefined {
  const ids = [
    opts.extraId,
    opts.help ? `${id}-help` : null,
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
