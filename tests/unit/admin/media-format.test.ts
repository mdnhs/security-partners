import { describe, expect, it } from "vitest"

import {
  DRIVER_LABELS,
  formatBytes,
  isRaster,
  mediaName,
  typeLabel,
} from "@/components/admin/media/format"

describe("media formatting", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB")
    expect(formatBytes(2.3 * 1024 * 1024)).toBe("2.3 MB")
  })

  it("names files and types", () => {
    expect(
      mediaName({ originalName: "hero.png", alt: "Hero", url: "/x/y.png" })
    ).toBe("hero.png")
    expect(mediaName({ originalName: "", alt: "Hero", url: "/x/y.png" })).toBe(
      "Hero"
    )
    expect(mediaName({ originalName: "", alt: "", url: "/x/y.png" })).toBe(
      "y.png"
    )
    expect(typeLabel("image/svg+xml")).toBe("SVG image")
    expect(typeLabel("image/jpeg")).toBe("JPEG image")
    expect(typeLabel("application/pdf")).toBe("PDF document")
  })

  it("labels storage and tells raster images apart", () => {
    expect(DRIVER_LABELS).toEqual({
      static: "Built in",
      disk: "Server disk",
      r2: "Cloudflare R2",
    })
    expect(isRaster("image/png")).toBe(true)
    expect(isRaster("image/svg+xml")).toBe(false)
    expect(isRaster("application/pdf")).toBe(false)
  })
})
