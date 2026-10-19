import { describe, expect, it } from "vitest"

import {
  CSV_BOM,
  csvCell,
  CsvError,
  parseCsv,
  toCsv,
  unguardCell,
} from "@/lib/csv"

describe("parseCsv (RFC 4180, D1.8)", () => {
  it("parses quoted commas, escaped quotes, CRLF and BOM", () =>
    expect(parseCsv('﻿from,to\r\n"/a,b","/c ""x"""\r\n').rows).toEqual([
      ["/a,b", '/c "x"'],
    ]))

  it("accepts LF, a missing final newline and quoted line breaks", () => {
    const parsed = parseCsv('a,b\n1,"two\nlines"\n3,4')
    expect(parsed.header).toEqual(["a", "b"])
    expect(parsed.rows).toEqual([
      ["1", "two\nlines"],
      ["3", "4"],
    ])
    // Physical line each record starts on (header is line 1).
    expect(parsed.lines).toEqual([2, 4])
  })

  it("skips blank lines but keeps line numbers true", () => {
    const parsed = parseCsv("a,b\r\n\r\n1,2\r\n   \r\n\r\n3,4\r\n\r\n")
    expect(parsed.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ])
    expect(parsed.lines).toEqual([3, 6])
  })

  it("keeps empty cells and short rows as they are", () => {
    expect(parseCsv("a,b,c\r\n1,,\r\n2\r\n").rows).toEqual([
      ["1", "", ""],
      ["2"],
    ])
  })

  it("an empty file has no header and no rows", () => {
    expect(parseCsv("")).toEqual({ header: [], rows: [], lines: [] })
    expect(parseCsv("﻿")).toEqual({ header: [], rows: [], lines: [] })
  })

  it("rejects an unterminated quote with the line it opened on", () => {
    let error: unknown
    try {
      parseCsv('a,b\r\n1,2\r\n3,"never closed\r\nmore')
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(CsvError)
    expect((error as CsvError).line).toBe(3)
    expect((error as CsvError).message).toMatch(/^Line 3: /)
  })

  it("rejects text after a closing quote", () => {
    expect(() => parseCsv('a\r\n"x"y\r\n')).toThrow(/^Line 2: /)
  })

  it("rejects > maxRows with the line number", () => {
    const text = ["from,to", "/a,/b", "", "/c,/d", "/e,/f"].join("\r\n")
    expect(parseCsv(text, { maxRows: 3 }).rows).toHaveLength(3)
    let error: unknown
    try {
      parseCsv(text, { maxRows: 2 })
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(CsvError)
    expect((error as CsvError).line).toBe(5)
    expect((error as CsvError).message).toBe(
      "Line 5: more than 2 rows. Split the file and import it in parts."
    )
  })

  it("does not evaluate or alter formula-looking cells", () => {
    expect(parseCsv('a\r\n"=HYPERLINK(""http://x"",""y"")"\r\n').rows).toEqual([
      ['=HYPERLINK("http://x","y")'],
    ])
  })

  it("round-trips toCsv output", () => {
    const rows = [
      ["/a,b", 'say "hi"', "multi\r\nline", ""],
      ["plain", "x", "y", "z"],
    ]
    const parsed = parseCsv(CSV_BOM + toCsv(["w", "x", "y", "z"], rows))
    expect(parsed.header).toEqual(["w", "x", "y", "z"])
    expect(parsed.rows).toEqual(rows)
  })
})

describe("unguardCell", () => {
  it("drops the apostrophe toCsv added before a formula character", () => {
    for (const value of ["=1+1", "+353", "-x", "@cmd", "|cmd", "\tTAB"])
      expect(unguardCell(csvCell(value).replace(/^"|"$/g, ""))).toBe(value)
    expect(unguardCell("'plain")).toBe("'plain")
    expect(unguardCell("plain")).toBe("plain")
  })
})

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

  it.each(["=SUM(A1)", "+353 85 000", "-2+3", "@cmd", "\tTAB", "\rCR", "|cmd"])(
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

  it("toCsv guards formulas", () =>
    expect(toCsv(["a"], [["=1+1"]])).toContain("'=1+1"))
})
