// CSV export (RFC 4180) with a spreadsheet formula-injection guard (OWASP).
export type CsvValue = string | number | boolean | null | undefined

/** Prepended to downloads so Excel reads UTF-8 ("Dinn Rí"). */
export const CSV_BOM = "\uFEFF"

const FORMULA_START = /^[=+\-@\t\r]/

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
