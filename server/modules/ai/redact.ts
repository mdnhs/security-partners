/**
 * Best-effort removal of contact details typed into free text (enquiry
 * names, companies, messages and notes) before it reaches the AI provider.
 * The email and phone columns are never read for the assistant; this only
 * covers what people type into other fields, so it errs on the side of
 * removing too much.
 */

/**
 * Email addresses (after NFKC, so fullwidth "＠" is "@"), also typed with
 * spaces around the "@" ("john @ gmail.com").
 */
const EMAIL = /[^\s@<>()[\]",;:]+\s*@\s*[^\s@<>()[\]",;:]+/gu

const AT = String.raw`(?:\s*[[({<]\s*at\s*[\])}>]\s*|\s+at\s+)`
const DOT = String.raw`(?:\s*[[({<]\s*dot\s*[\])}>]\s*|\s+dot\s+|\.)`
/** "john at gmail dot com", "john[at]gmail[dot]com", "john (at) gmail.com". */
const SPELLED_EMAIL = new RegExp(
  String.raw`[\p{L}\p{N}._%+-]+${AT}[\p{L}\p{N}-]+(?:${DOT}[\p{L}\p{N}-]+)+`,
  "giu"
)

/**
 * Digit runs with phone separators: spaces, dots, commas, underscores,
 * brackets, slashes, any dash (\p{Pd}, minus sign) and middle dots or
 * bullets. Digits are ASCII by then (see asciiDigits).
 */
const PHONE_LIKE = /\+?\(?\d[\d\s().,_\/\p{Pd}−·•]{4,}\d/gu

const DECIMAL = /\p{Nd}/u

/**
 * Every decimal digit of any script as 0-9. Unicode keeps each script's
 * digits 0-9 in one contiguous run that starts at zero, so a digit's value
 * is its distance from the start of its run (mod 10). NFKC already folds
 * fullwidth and mathematical digits; this covers Arabic-Indic, Devanagari
 * and the rest, which NFKC keeps.
 */
function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (digit) => {
    let cp = digit.codePointAt(0)!
    if (cp >= 0x30 && cp <= 0x39) return digit
    let offset = 0
    while (DECIMAL.test(String.fromCodePoint(cp - 1))) {
      cp -= 1
      offset += 1
    }
    return String(offset % 10)
  })
}

/** Dates that are not phone numbers: 2024-10-12, 12/10/2024, 12.10.2024. */
const DATE = /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4})$/

const digits = (text: string) => text.replace(/\D/gu, "").length

export function redactContacts(text: string): string {
  return (
    // Fullwidth digits and "＠", compatibility forms, odd spaces; then
    // digits of other scripts.
    asciiDigits(text.normalize("NFKC"))
      .replace(EMAIL, "[email removed]")
      .replace(SPELLED_EMAIL, "[email removed]")
      .replace(PHONE_LIKE, (match) => {
        const run = match.trim()
        // A date, or a list of dates ("2024-10-12, 12/10/2024").
        if (run.split(/[\s,]+/).every((part) => DATE.test(part))) return match
        return digits(run) >= 7 ? "[number removed]" : match
      })
      .replace(/\d{7,}/gu, "[number removed]")
      .replaceAll("@", " ")
  )
}
