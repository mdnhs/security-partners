import "server-only"

/**
 * The AI module's two ways of shortening text, named by behaviour (final
 * review minor 4): one cut for input caps, one for text shown to the model.
 */

/**
 * At most `max` UTF-16 units, never ending inside a surrogate pair, no
 * marker. For input caps measured like `string.length` (redaction).
 */
export function clipUnits(text: string, max: number): string {
  if (text.length <= max) return text
  const end = /[\ud800-\udbff]/.test(text[max - 1]!) ? max - 1 : max
  return text.slice(0, end)
}

/**
 * At most `max` code points; a cut text ends with "…" (counted in `max`).
 * For record text put into the model's context or tool results.
 */
export function clipWithEllipsis(text: string, max: number): string {
  const chars = [...text]
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text
}
