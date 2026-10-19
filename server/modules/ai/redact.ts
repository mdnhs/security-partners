/**
 * Best-effort removal of contact details typed into free text (enquiry
 * names, companies, messages and notes) before it reaches the AI provider.
 * The email and phone columns are never read for the assistant; this only
 * covers what people type into other fields, so it errs on the side of
 * removing too much.
 */

/** Email addresses (after NFKC, so fullwidth "＠" is "@"). */
const EMAIL = /[^\s@<>()[\]",;:]+@[^\s@<>()[\]",;:]+/gu

const AT = String.raw`(?:\s*[[({<]\s*at\s*[\])}>]\s*|\s+at\s+)`
const DOT = String.raw`(?:\s*[[({<]\s*dot\s*[\])}>]\s*|\s+dot\s+|\.)`
/** "john at gmail dot com", "john[at]gmail[dot]com", "john (at) gmail.com". */
const SPELLED_EMAIL = new RegExp(
  String.raw`[\p{L}\p{N}._%+-]+${AT}[\p{L}\p{N}-]+(?:${DOT}[\p{L}\p{N}-]+)+`,
  "giu"
)

/**
 * Digit runs with phone separators: spaces, dots, brackets, slashes, any
 * dash (\p{Pd}, minus sign) and middle dots or bullets.
 */
const PHONE_LIKE = /\+?\(?\d[\d\s().\/\p{Pd}−·•]{4,}\d/gu

/** Dates that are not phone numbers: 2024-10-12, 12/10/2024, 12.10.2024. */
const DATE = /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4})$/

const digits = (text: string) => text.replace(/\D/gu, "").length

export function redactContacts(text: string): string {
  return (
    text
      // Fullwidth digits and "＠", compatibility forms, odd spaces.
      .normalize("NFKC")
      .replace(EMAIL, "[email removed]")
      .replace(SPELLED_EMAIL, "[email removed]")
      .replace(PHONE_LIKE, (match) => {
        const run = match.trim()
        if (DATE.test(run)) return match
        return digits(run) >= 7 ? "[number removed]" : match
      })
      .replace(/\d{7,}/gu, "[number removed]")
      .replaceAll("@", " ")
  )
}
