import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { ImageReadError, inspectImage } from "@/server/lib/image"

const make = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#123456" } })

describe("inspectImage (sharp metadata + blur, notes §5.6)", () => {
  it("measures raster images and makes a WebP blur placeholder", async () => {
    const png = new Uint8Array(await make(40, 30).png().toBuffer())
    const info = await inspectImage(png, "image/png")
    expect(info).toMatchObject({ width: 40, height: 30 })
    expect(info.blurDataUrl).toMatch(/^data:image\/webp;base64,/)
  })

  it("uses the EXIF-oriented size", async () => {
    const jpeg = new Uint8Array(
      await make(40, 30).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    )
    expect(await inspectImage(jpeg, "image/jpeg")).toMatchObject({
      width: 30,
      height: 40,
    })
  })

  it("measures SVG without a blur; PDFs have no size", async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"/>'
    )
    expect(await inspectImage(svg, "image/svg+xml")).toEqual({
      width: 24,
      height: 12,
      blurDataUrl: null,
    })
    expect(await inspectImage(new Uint8Array([37]), "application/pdf")).toEqual(
      {
        width: null,
        height: null,
        blurDataUrl: null,
      }
    )
  })

  it("rejects unreadable images and type mismatches", async () => {
    const jpeg = new Uint8Array(await make(4, 4).jpeg().toBuffer())
    await expect(inspectImage(jpeg, "image/png")).rejects.toThrow(
      ImageReadError
    )
    await expect(
      inspectImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]), "image/png")
    ).rejects.toThrow(ImageReadError)
  })
})
