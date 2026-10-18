import { describe, expect, it } from "vitest"

import { CSV_BOM, csvCell, toCsv } from "@/lib/csv"

describe("CSV (RFC 4180 + formula-injection guard, master 7.4)", () => {
  it("quotes only when needed and doubles quotes", () => {
    expect(csvCell("plain")).toBe("plain")
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell("a,b")).toBe('"a,b"')
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"')
    expect(csvCell("cr\r\nlf")).toBe('"cr\r\nlf"')
    expect(csvCell(null)).toBe("")
    expect(csvCell(undefined)).toBe("")
    expect(csvCell(true)).toBe("true")
    expect(csvCell(-5)).toBe("-5")
  })

  it.each(["=SUM(A1)", "+353 85 000", "-2+3", "@cmd", "\tTAB", "\rCR"])(
    "prefixes %j with an apostrophe",
    (value) => {
      expect(csvCell(value).replace(/^"|"$/g, "").startsWith("'")).toBe(true)
    }
  )

  it("guards before quoting", () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(
      `"'=HYPERLINK(""http://x"",""y"")"`
    )
  })

  it("joins rows with CRLF and ends with CRLF; BOM is exported separately", () => {
    expect(
      toCsv(
        ["A", "B"],
        [
          ["1", "x,y"],
          [null, "=1"],
        ]
      )
    ).toBe('A,B\r\n1,"x,y"\r\n,\'=1\r\n')
    expect(CSV_BOM).toBe("\uFEFF")
  })
})
