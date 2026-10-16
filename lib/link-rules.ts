// Placeholder rules for `link` values, shared by the server schema
// (lib/schemas/common.ts) and the admin editor. Kept free of zod and of the
// settings schemas (which import common.ts) so both sides can use it.

import { WHOLE_PLACEHOLDER } from "./href"

/** settings.contact field names (a unit test keeps this equal to the schema). */
export const CONTACT_FIELDS = [
  "phone24h",
  "office",
  "operationsMobile",
  "operationsExtension",
  "email",
  "operationsEmail",
  "hours",
  "addressLine1",
  "addressLine2",
  "mapsHref",
] as const

/** Contact numbers that also get a derived tel: placeholder ({officeHref}). */
export const TEL_FIELDS = ["phone24h", "office", "operationsMobile"] as const

/** Every placeholder the public site fills in a link (lib/interpolate.ts). */
export const CONTACT_PLACEHOLDERS: readonly string[] = [
  ...CONTACT_FIELDS,
  ...TEL_FIELDS.map((name) => `${name}Href`),
]

/** Placeholders holding a whole URL: the only ones usable as an entire href. */
export const URL_PLACEHOLDERS: readonly string[] = CONTACT_PLACEHOLDERS.filter(
  (name) => name.endsWith("Href")
)

const PLACEHOLDER = /\{([A-Za-z]\w*)\}/g

/** Message for the first {name} that is not a contact placeholder. */
export function unknownPlaceholder(value: string): string | undefined {
  for (const match of value.matchAll(PLACEHOLDER))
    if (!CONTACT_PLACEHOLDERS.includes(match[1]))
      return `Unknown placeholder ${match[0]}. Use a Settings › Contact name such as {office} or {phone24hHref}.`
  return undefined
}

/**
 * Placeholder problems of one link (the href guard itself is the `href`
 * schema's job): names must come from Settings › Contact, and a whole-value
 * destination must be a URL placeholder ({officeHref}, not {office}).
 */
export function linkPlaceholderProblems(value: {
  label: string
  href: string
}): { label?: string; href?: string } {
  const problems: { label?: string; href?: string } = {}
  const label = unknownPlaceholder(value.label)
  if (label) problems.label = label
  const href =
    unknownPlaceholder(value.href) ??
    (WHOLE_PLACEHOLDER.test(value.href) &&
    !URL_PLACEHOLDERS.includes(value.href.slice(1, -1))
      ? `Use a link placeholder: ${URL_PLACEHOLDERS.map((n) => `{${n}}`).join(", ")}.`
      : undefined)
  if (href) problems.href = href
  return problems
}
