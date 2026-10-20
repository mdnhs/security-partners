import "server-only"

/**
 * Best-effort removal of contact details typed into free text (enquiry
 * names, companies, messages and notes) before it reaches the AI provider.
 * The email and phone columns are never read for the assistant; this only
 * covers what people type into other fields, so it errs on the side of
 * removing too much.
 *
 * Every pattern here runs in linear time (C9 re-review N4): a run of
 * address characters is only tried from its first character (the
 * lookbehinds), so a long run with no "@" is scanned once, not once per
 * position. The input is clipped first as well.
 */
import { AI_MAX_FIELD_CHARS } from "@/lib/schemas/api/ai"

import { clipUnits } from "./clip"

/** Longest text redacted (the screen field's cap); the rest is dropped. */
export const REDACT_MAX = AI_MAX_FIELD_CHARS
/** A one-line enquiry field: name, company, service (the form's cap). */
export const REDACT_LINE_MAX = 200

/**
 * Email addresses (after NFKC, so fullwidth "＠" is "@"), also typed with
 * spaces around the "@" ("john @ gmail.com"). Brackets (including "{}")
 * end an address, so a bracketed "@" is left to SPELLED_EMAIL (C9 N5).
 */
const EMAIL =
  /(?<![^\s@<>()[\]{}",;:])[^\s@<>()[\]{}",;:]+\s*@\s*[^\s@<>()[\]{}",;:]+/gu

/**
 * " at ", "[at]", "(at)" and a bracketed "@": "(@)", "[@]", "{@}", "<@>",
 * with or without spaces; also with only one bracket ("(@", "@)", "(at",
 * " at]"; C9 N5). Errs on removing too much.
 */
const AT = String.raw`(?:\s*[[({<]\s*(?:at|@)\s*[\])}>]\s*|\s*[[({<]\s*(?:at|@)\s*|(?:\s+at|\s*@)\s*[\])}>]\s*|\s+at\s+)`
const DOT = String.raw`(?:\s*[[({<]\s*dot\s*[\])}>]\s*|\s+dot\s+|\.)`
/** "john at gmail dot com", "john[at]gmail[dot]com", "john (@) gmail.com". */
const SPELLED_EMAIL = new RegExp(
  String.raw`(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+${AT}[\p{L}\p{N}-]+(?:${DOT}[\p{L}\p{N}-]+)+`,
  "giu"
)

/**
 * Digit runs with phone separators: spaces, dots, commas, underscores,
 * brackets, slashes, colons, apostrophes, asterisks, pipes, tildes, plus
 * signs, any dash (\p{Pd}, minus sign) and middle dots or bullets. Digits
 * are ASCII by then (see asciiDigits).
 */
const PHONE_LIKE = /\+?\(?\d[\d\s().,_\/:'*|~+\p{Pd}−·•]{4,}\d/gu

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

const ISO_DATE = /^\d{4}-(\d{2})-(\d{2})$/
const DAY_MONTH_YEAR = /^(\d{1,2})([/.])(\d{1,2})\2\d{4}$/
const TIME = /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/

const inRange = (value: string, max: number) =>
  Number(value) >= 1 && Number(value) <= max

/**
 * A real calendar date (2024-10-12, 12/10/2024, 10.12.2024; day first or
 * month first) or a time of day (09:00). 08/71/2345 is neither, so its
 * digits count toward a phone number (C9 re-review N3).
 */
function isDateOrTime(part: string): boolean {
  if (TIME.test(part)) return true
  const iso = ISO_DATE.exec(part)
  if (iso) return inRange(iso[1]!, 12) && inRange(iso[2]!, 31)
  const dmy = DAY_MONTH_YEAR.exec(part)
  if (!dmy) return false
  const [a, b] = [dmy[1]!, dmy[3]!]
  return inRange(a, 31) && inRange(b, 31) && (inRange(a, 12) || inRange(b, 12))
}

const digits = (text: string) => text.replace(/\D/gu, "").length

/**
 * @param max longest input looked at (pass the field's own cap when it is
 *   shorter); anything after it is dropped, never sent unredacted.
 */
export function redactContacts(text: string, max = REDACT_MAX): string {
  // Fullwidth digits and "＠", compatibility forms, odd spaces; then format
  // characters (zero-width spaces and joiners, bidi marks, word joiner,
  // BOM: NFKC keeps them), then digits of other scripts.
  const plain = asciiDigits(
    clipUnits(
      clipUnits(text, max)
        .normalize("NFKC")
        .replace(/\p{Cf}/gu, ""),
      max
    )
  )
  return plain
    .replace(EMAIL, "[email removed]")
    .replace(SPELLED_EMAIL, "[email removed]")
    .replace(PHONE_LIKE, (match) => {
      // Real dates and times in the run ("2024-10-12, 12/10/2024",
      // "09:00 - 17:30") are not part of a number.
      const rest = match
        .trim()
        .split(/[\s,]+/)
        .filter((part) => !isDateOrTime(part))
      return digits(rest.join(" ")) >= 7 ? "[number removed]" : match
    })
    .replace(/\d{7,}/gu, "[number removed]")
    .replaceAll("@", " ")
}
