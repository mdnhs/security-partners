import { isSafeHref, WHOLE_PLACEHOLDER } from "@/lib/href"
import { TEL_FIELDS } from "@/lib/link-rules"
import type { ContactSettings } from "@/lib/schemas/settings/contact"

export type Placeholders = Record<string, string | number>

const PLACEHOLDER = /\{([A-Za-z]\w*)\}/g

/**
 * Fills "{name}" placeholders (docs/brief.md §14.3). Unknown placeholders
 * stay as written; values are inserted once (never re-expanded).
 */
export function interpolate(template: string, values: Placeholders): string {
  return template.replace(PLACEHOLDER, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  )
}

/**
 * Same as interpolate, but returns the literal text and each inserted value
 * as separate strings. Rendered as children they become separate text nodes,
 * exactly like JSX `Call {office}` — Chrome positions glyphs per text node,
 * so this keeps such labels pixel-identical.
 */
export function interpolateParts(
  template: string,
  values: Placeholders
): string[] {
  const parts: string[] = []
  let literal = ""
  let last = 0
  for (const match of template.matchAll(PLACEHOLDER)) {
    if (!Object.hasOwn(values, match[1])) continue
    literal += template.slice(last, match.index)
    if (literal) parts.push(literal)
    literal = ""
    parts.push(String(values[match[1]]))
    last = match.index + match[0].length
  }
  literal += template.slice(last)
  if (literal) parts.push(literal)
  return parts
}

/** Rendered instead of an href that fails the guard after interpolation. */
export const UNSAFE_HREF_FALLBACK = "#"

/**
 * Interpolates an href template, then re-checks the result with isSafeHref
 * (ruling): an inserted value can never produce javascript:, //host… An
 * unsafe result, or a whole-value placeholder left unresolved, renders "#".
 */
export function interpolateHref(
  template: string,
  values: Placeholders
): string {
  const result = interpolate(template, values)
  return isSafeHref(result) && !WHOLE_PLACEHOLDER.test(result)
    ? result
    : UNSAFE_HREF_FALLBACK
}

/**
 * Share-network href: {url} and {title} are filled in URI-encoded, exactly
 * as the static site's share links built them (ruling).
 */
export function shareHref(
  template: string,
  page: { url: string; title: string }
): string {
  return interpolateHref(template, {
    url: encodeURIComponent(page.url),
    title: encodeURIComponent(page.title),
  })
}

/** "(085) 8018746" → "tel:+353858018746" (Irish numbers; +/00 kept international). */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return `tel:${digits}`
  if (digits.startsWith("00")) return `tel:+${digits.slice(2)}`
  if (digits.startsWith("0")) return `tel:+353${digits.slice(1)}`
  return `tel:${digits}`
}

/** Every settings.contact field plus the derived tel: hrefs (ruling: all *Href except mapsHref). */
export function contactPlaceholders(contact: ContactSettings): Placeholders {
  return {
    ...contact,
    ...Object.fromEntries(
      TEL_FIELDS.map((name) => [`${name}Href`, telHref(contact[name])])
    ),
  }
}
