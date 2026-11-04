import { describe, expect, it } from "vitest"

import { sniffDocument } from "@/server/lib/document-sniff"

const bytes = (...values: number[]) => new Uint8Array(values)
const text = (value: string) => new TextEncoder().encode(value)

/** A minimal ZIP whose central directory names every entry in `names`. */
function zipWithAll(names: string[]): Uint8Array {
  const central: number[] = []
  for (const name of names) {
    const n = text(name)
    central.push(
      0x50,
      0x4b,
      0x01,
      0x02,
      ...new Array(24).fill(0),
      n.length,
      0,
      ...new Array(16).fill(0),
      ...n
    )
  }
  const local = [0x50, 0x4b, 0x03, 0x04, ...new Array(26).fill(0)]
  const end = [
    0x50,
    0x4b,
    0x05,
    0x06,
    0,
    0,
    0,
    0,
    names.length,
    0,
    names.length,
    0,
    central.length & 0xff,
    central.length >> 8,
    0,
    0,
    local.length & 0xff,
    local.length >> 8,
    0,
    0,
    0,
    0,
  ]
  return new Uint8Array([...local, ...central, ...end])
}

/** A minimal ZIP: one local header + central directory entry named `name`, and the end record. */
function zipWith(name: string): Uint8Array {
  const n = text(name)
  const local = [
    0x50,
    0x4b,
    0x03,
    0x04,
    ...new Array(22).fill(0),
    n.length,
    0,
    0,
    0,
    ...n,
  ]
  const centralAt = local.length
  const central = [
    0x50,
    0x4b,
    0x01,
    0x02,
    ...new Array(24).fill(0),
    n.length,
    0,
    ...new Array(16).fill(0),
    ...n,
  ]
  const end = [
    0x50,
    0x4b,
    0x05,
    0x06,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    0,
    central.length & 0xff,
    central.length >> 8,
    0,
    0,
    centralAt & 0xff,
    centralAt >> 8,
    0,
    0,
    0,
    0,
  ]
  return new Uint8Array([...local, ...central, ...end])
}

describe("sniffDocument", () => {
  it("PDF by its %PDF- header", () => {
    expect(sniffDocument(text("%PDF-1.7\n..."))).toBe("application/pdf")
  })

  it("Word 97–2003 by the OLE compound file signature", () => {
    expect(
      sniffDocument(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0))
    ).toBe("application/msword")
  })

  it("DOCX: a ZIP whose central directory names word/document.xml", () => {
    expect(sniffDocument(zipWith("word/document.xml"))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  })

  it("JPEG and PNG by their signatures", () => {
    expect(sniffDocument(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe(
      "image/jpeg"
    )
    expect(
      sniffDocument(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))
    ).toBe("image/png")
  })

  it("refuses an HTML file named .docx, a ZIP without word/document.xml, and an exe", () => {
    expect(
      sniffDocument(text("<!doctype html><script>alert(1)</script>"))
    ).toBeNull()
    expect(sniffDocument(zipWith("xl/workbook.xml"))).toBeNull()
    // A macro-enabled document (.docm) also holds word/document.xml.
    expect(
      sniffDocument(zipWithAll(["word/document.xml", "word/vbaProject.bin"]))
    ).toBeNull()
    expect(sniffDocument(bytes(0x4d, 0x5a, 0x90, 0))).toBeNull()
    expect(sniffDocument(new Uint8Array())).toBeNull()
  })
})
