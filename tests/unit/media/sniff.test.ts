import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { sniffMime } from "@/server/lib/media-sniff"

const image = (format: "png" | "jpeg" | "webp" | "avif" | "gif" | "tiff") =>
  sharp({ create: { width: 8, height: 6, channels: 3, background: "#336699" } })
    .toFormat(format)
    .toBuffer()
const text = (s: string) => new TextEncoder().encode(s)

describe("sniffMime (ledger: MIME sniffed, not trusted)", () => {
  it.each([
    ["png", "image/png"],
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
    ["avif", "image/avif"],
  ] as const)("detects %s from its bytes", async (format, mime) => {
    expect(sniffMime(new Uint8Array(await image(format)))).toBe(mime)
  })

  it("rejects formats outside the allow-list", async () => {
    expect(sniffMime(new Uint8Array(await image("gif")))).toBeNull()
    expect(sniffMime(new Uint8Array(await image("tiff")))).toBeNull()
    expect(sniffMime(text("<html><body>hi</body></html>"))).toBeNull()
    expect(sniffMime(text("just text"))).toBeNull()
    expect(sniffMime(new Uint8Array())).toBeNull()
  })

  it("detects PDF and SVG (after BOM, XML declaration, comments, doctype)", () => {
    expect(sniffMime(text("%PDF-1.7\n%âãÏÓ\n"))).toBe("application/pdf")
    expect(sniffMime(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(
      "image/svg+xml"
    )
    expect(
      sniffMime(
        text(
          '﻿<?xml version="1.0"?>\n<!-- made by hand -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">\n<svg viewBox="0 0 1 1"></svg>'
        )
      )
    ).toBe("image/svg+xml")
    expect(sniffMime(text("<svgfoo/>"))).toBeNull()
  })
})
