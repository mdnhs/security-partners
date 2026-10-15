// The href guard, kept free of zod so client components (share links) can
// re-check interpolated hrefs without shipping the schemas to the browser.
// lib/schemas/common.ts builds the `href` schema on it.

/** A whole-value placeholder such as "{phone24hHref}". */
export const WHOLE_PLACEHOLDER = /^\{[A-Za-z]\w*\}$/
const ABSOLUTE = /^(https?:\/\/|tel:|mailto:)\S+$/i
const CONTROL_CHAR = /[\u0000-\u001f\u007f-\u009f]/
/** Browsers treat "\" as "/" and skip tabs/newlines: "/\host" and "/\t/host" are protocol-relative. */
const UNSAFE_PREFIX = /[\\\s]/

/** Internal path, #anchor, http(s), tel:, mailto: or a {placeholder}. Never javascript: or //host. */
export function isSafeHref(value: string): boolean {
  if (CONTROL_CHAR.test(value)) return false
  if (UNSAFE_PREFIX.test(value.slice(0, 2))) return false
  if (WHOLE_PLACEHOLDER.test(value)) return true
  if (value.startsWith("/")) return !value.startsWith("//")
  if (value.startsWith("#")) return !/\s/.test(value)
  return ABSOLUTE.test(value)
}
