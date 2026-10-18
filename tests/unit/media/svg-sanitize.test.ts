import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { sanitizeSvg, SvgSanitizeError } from "@/server/lib/svg-sanitize"

const HOSTILE = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" onload="alert(1)">
  <script>alert(2)</script>
  <style>@import url(https://evil.example/x.css)</style>
  <a href="javascript:alert(3)"><rect width="24" height="24" fill="#0d1b36"/></a>
  <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>
  <use href="https://evil.example/sprite.svg#a"/>
  <image href="https://tracker.example/pixel.png" width="1" height="1"/>
  <image xlink:href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/>
  <set attributeName="onclick" to="alert(4)"/>
  <circle cx="12" cy="12" r="4" fill="url(#g)" onclick="alert(5)"/>
</svg>`

describe("sanitizeSvg (spec §11: SVG sanitised)", () => {
  it("removes scripts, handlers, styles, foreign content and remote references", () => {
    const out = sanitizeSvg(HOSTILE)
    for (const banned of [
      "<script",
      "onload",
      "onclick",
      "<style",
      "javascript:",
      "foreignObject",
      "<use",
      "evil.example",
      "tracker.example",
      "<set",
      "<a ",
    ])
      expect(out, banned).not.toContain(banned)
    expect(out).toContain('<rect width="24" height="24" fill="#0d1b36"/>')
    expect(out).toContain("data:image/png;base64,iVBORw0KGgo=")
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  })

  it("returns well-formed XML that sharp can read", async () => {
    const out = sanitizeSvg(
      '<svg viewBox="0 0 24 12"><text>a&#160;b &amp; c</text></svg>'
    )
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"><text>a b &amp; c</text></svg>'
    )
    const meta = await sharp(Buffer.from(out)).metadata()
    expect(meta.mediaType).toBe("image/svg+xml")
  })

  it("rejects documents that are not exactly one SVG", () => {
    expect(() => sanitizeSvg("<html><body>hi</body></html>")).toThrow(
      SvgSanitizeError
    )
    expect(() => sanitizeSvg("<svg></svg><svg></svg>")).toThrow(
      SvgSanitizeError
    )
    expect(() => sanitizeSvg("")).toThrow(SvgSanitizeError)
  })
})
