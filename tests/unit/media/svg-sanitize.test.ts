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

  it("drops style attributes and any url() that is not a local #id", () => {
    const out = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g"/><filter id="f"/><mask id="m"/><clipPath id="c"/><marker id="k"/></defs>
  <rect fill="url(#g)" filter="url('#f')" mask="url(#m)" clip-path="url(#c)" marker-end="url(#k)" width="1" height="1"/>
  <rect fill="url(https://evil.example/a.svg#g)" filter="url(//evil.example/f)" mask="url('http://evil.example/m')" clip-path="url(data:image/svg+xml,x)" marker-end="url(#k) url(https://evil.example/k)" width="2" height="2"/>
  <rect fill="u\\72l(https://evil.example/e)" width="3" height="3"/>
  <circle style="fill:url(https://evil.example/s)" r="1"/>
  <circle style="fill:red" r="2"/>
</svg>`)
    expect(out).toContain(
      '<rect fill="url(#g)" filter="url(\'#f\')" mask="url(#m)" clip-path="url(#c)" marker-end="url(#k)" width="1" height="1"/>'
    )
    expect(out).toContain('<rect width="2" height="2"/>')
    expect(out).toContain('<rect width="3" height="3"/>')
    expect(out).not.toContain("evil.example")
    expect(out).not.toContain("style")
    expect(out).toContain('<circle r="2"/>')
  })
})
