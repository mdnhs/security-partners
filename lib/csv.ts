// CSV (RFC 4180): export with a spreadsheet formula-injection guard (OWASP),
// and a strict in-house parser for imports (no dependency).
export type CsvValue = string | number | boolean | null | undefined

/** Prepended to downloads so Excel reads UTF-8 ("Dinn Rí"). */
export const CSV_BOM = "\uFEFF"

/** = + - @ start formulas; TAB/CR and | (DDE) are abused the same way. */
const FORMULA_START = /^[=+\-@\t\r|]/

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  let text = String(value)
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(
  header: readonly string[],
  rows: readonly (readonly CsvValue[])[]
): string {
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .map((line) => `${line}\r\n`)
    .join("")
}

/** An import file that is not valid CSV; `line` is the physical line (1-based). */
export class CsvError extends Error {
  readonly line: number

  constructor(line: number, message: string) {
    super(`Line ${line}: ${message}`)
    this.name = "CsvError"
    this.line = line
  }
}

/**
 * The value toCsv exported: a leading "'" it added before a formula
 * character is dropped, so export → import round-trips.
 */
export function unguardCell(value: string): string {
  return /^'[=+\-@\t\r|]/.test(value) ? value.slice(1) : value
}

const isBreak = (ch: string | undefined) => ch === "\r" || ch === "\n"

/**
 * RFC 4180: quoted fields (with "" for a quote, commas and line breaks
 * inside), CRLF, LF or CR line ends, a leading BOM stripped. The first
 * non-blank record is the header. Blank records (every cell empty or
 * spaces) are skipped; `lines[i]` is the line `rows[i]` starts on. Cells
 * are returned as written: nothing is evaluated or trimmed. Throws
 * CsvError on an unclosed quote, text after a closing quote, or more than
 * `maxRows` data rows.
 */
export function parseCsv(
  text: string,
  opts: { maxRows?: number } = {}
): { header: string[]; rows: string[][]; lines: number[] } {
  const src = text.startsWith(CSV_BOM) ? text.slice(CSV_BOM.length) : text
  const max = opts.maxRows ?? Number.POSITIVE_INFINITY
  const n = src.length
  let header: string[] | null = null
  const rows: string[][] = []
  const lines: number[] = []
  let i = 0
  let line = 1

  const quoted = (): string => {
    const openLine = line
    let cell = ""
    i++ // opening quote
    for (;;) {
      if (i >= n)
        throw new CsvError(
          openLine,
          "a quoted value is never closed. Check its quotes."
        )
      const ch = src[i]
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        i++
        break
      }
      if (ch === "\r" && src[i + 1] === "\n") {
        cell += "\r\n"
        i += 2
        line++
      } else {
        if (isBreak(ch)) line++
        cell += ch
        i++
      }
    }
    if (i < n && src[i] !== "," && !isBreak(src[i]))
      throw new CsvError(
        line,
        "text after a closing quote. Put the whole value in quotes and double any quotes inside it."
      )
    return cell
  }

  while (i < n) {
    const start = line
    const cells: string[] = []
    for (;;) {
      if (src[i] === '"') cells.push(quoted())
      else {
        let j = i
        while (j < n && src[j] !== "," && !isBreak(src[j])) j++
        cells.push(src.slice(i, j))
        i = j
      }
      if (i >= n) break
      if (src[i] === ",") {
        i++
        if (i >= n) {
          cells.push("")
          break
        }
        continue
      }
      i += src[i] === "\r" && src[i + 1] === "\n" ? 2 : 1
      line++
      break
    }
    if (cells.every((cell) => cell.trim() === "")) continue
    if (header === null) {
      header = cells
      continue
    }
    if (rows.length >= max)
      throw new CsvError(
        start,
        `more than ${max} rows. Split the file and import it in parts.`
      )
    rows.push(cells)
    lines.push(start)
  }
  return { header: header ?? [], rows, lines }
}
