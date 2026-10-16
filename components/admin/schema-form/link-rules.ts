import type { z } from "zod"

import { isSafeHref, WHOLE_PLACEHOLDER } from "@/lib/href"
import { contactPlaceholders } from "@/lib/interpolate"
import { link } from "@/lib/schemas/common"
import {
  type ContactSettings,
  contactSettings,
} from "@/lib/schemas/settings/contact"

import { unwrapSchema } from "./resolve-widget"

/**
 * Placeholders a link may use: every Settings › Contact field plus the
 * derived tel: hrefs — exactly what the public site fills in
 * (contactPlaceholders), so an unknown name can never render literally.
 */
export const CONTACT_PLACEHOLDERS: readonly string[] = Object.keys(
  contactPlaceholders(
    Object.fromEntries(
      Object.keys(contactSettings.shape).map((key) => [key, ""])
    ) as ContactSettings
  )
)
/** The ones that hold a whole URL (usable as a link's entire destination). */
const HREF_PLACEHOLDERS = CONTACT_PLACEHOLDERS.filter((name) =>
  name.endsWith("Href")
)
const PLACEHOLDER = /\{([A-Za-z]\w*)\}/g

function unknownPlaceholder(value: string): string | undefined {
  for (const match of value.matchAll(PLACEHOLDER))
    if (!CONTACT_PLACEHOLDERS.includes(match[1]))
      return `Unknown placeholder ${match[0]}. Use a Settings › Contact name such as {office} or {phone24hHref}.`
  return undefined
}

/**
 * Editor-side rules for one `link` on top of its schema: placeholders must
 * come from Settings › Contact, a whole-value destination must be a URL
 * placeholder ({officeHref}, not {office}) and the destination must pass
 * the href guard.
 */
export function linkProblems(value: { label?: unknown; href?: unknown }): {
  label?: string
  href?: string
} {
  const problems: { label?: string; href?: string } = {}
  if (typeof value.label === "string") {
    const label = unknownPlaceholder(value.label)
    if (label) problems.label = label
  }
  if (typeof value.href === "string" && value.href !== "") {
    const target = value.href
    const href =
      unknownPlaceholder(target) ??
      (WHOLE_PLACEHOLDER.test(target) &&
      !HREF_PLACEHOLDERS.includes(target.slice(1, -1))
        ? `Use a link placeholder: ${HREF_PLACEHOLDERS.map((n) => `{${n}}`).join(", ")}.`
        : undefined) ??
      (isSafeHref(target)
        ? undefined
        : "Use /path, #anchor, https://…, tel:, mailto: or {placeholder}")
    if (href) problems.href = href
  }
  return problems
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** [dot path, message] for every `link` in `value` that breaks linkProblems. */
export function linkErrors(
  schema: z.ZodType,
  value: unknown,
  path = ""
): [string, string][] {
  const { inner } = unwrapSchema(schema)
  const at = (key: string | number) => (path ? `${path}.${key}` : String(key))
  if (inner === link) {
    if (!isRecord(value)) return []
    return Object.entries(linkProblems(value)).map(
      ([key, message]) => [at(key), message] as [string, string]
    )
  }
  const type = (inner as unknown as { def: { type: string } }).def.type
  if (type === "object" && isRecord(value))
    return Object.entries((inner as z.ZodObject).shape).flatMap(
      ([key, child]) => linkErrors(child as z.ZodType, value[key], at(key))
    )
  if (type === "array" && Array.isArray(value)) {
    const element = (inner as z.ZodArray<z.ZodType>).element
    return value.flatMap((item, index) => linkErrors(element, item, at(index)))
  }
  return []
}
