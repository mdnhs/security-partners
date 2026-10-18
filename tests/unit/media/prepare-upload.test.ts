import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { ImageReadError, inspectImage } from "@/server/lib/image"
import { newMediaKey, prepareUpload } from "@/server/modules/media/service"

const png = () =>
  sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } })
    .png()
    .toBuffer()

const fieldError = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (err) {
    return (err as { details?: { fieldErrors?: Record<string, string[]> } })
      .details?.fieldErrors
  }
  throw new Error("expected a rejection")
}

describe("prepareUpload (spec §11 pipeline before storage)", () => {
  it("keeps only a cleaned last path segment of the file name", async () => {
    const name = `..\\..//etc/ev\u0007il\u001b\u007f${"x".repeat(300)}.png`
    const prepared = await prepareUpload(new File([await png()], name))
    expect(prepared.originalName).toBe(`evil${"x".repeat(196)}`)
    expect(prepared.originalName).toHaveLength(200)
    expect(prepared).toMatchObject({ mime: "image/png", ext: "png" })
  })

  it("strips bidi, C1 and zero-width characters from the name", async () => {
    const name =
      "in\u202evoice\u2066\u2069\u202a\u200b\u200d\u200f\ufeff\u0085\u009f.png"
    const prepared = await prepareUpload(new File([await png()], name))
    expect(prepared.originalName).toBe("invoice.png")
  })

  it("names a file without a usable name after its type", async () => {
    const prepared = await prepareUpload(new File([await png()], " \u0001 "))
    expect(prepared.originalName).toBe("upload.png")
  })

  it("rejects anything that is not a file", async () => {
    expect(await fieldError(prepareUpload("not a file"))).toEqual({
      file: ["Choose a file to upload"],
    })
  })
})

describe("newMediaKey", () => {
  it("is YYYY/MM/<uuid v7>.<ext> in UTC and never reused", () => {
    const at = new Date("2026-01-31T23:30:00-05:00") // Feb 1st in UTC
    const key = newMediaKey("webp", at)
    expect(key).toMatch(
      /^2026\/02\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/
    )
    expect(newMediaKey("webp", at)).not.toBe(key)
  })
})

describe("inspectImage pixel limit (decompression bombs)", () => {
  it("rejects SVGs over 40 megapixels", async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="6000"/>'
    )
    await expect(inspectImage(svg, "image/svg+xml")).rejects.toThrow(
      ImageReadError
    )
  })

  it("rejects raster images over 40 megapixels", async () => {
    const big = new Uint8Array(
      await sharp({
        create: { width: 8000, height: 5001, channels: 3, background: "#000" },
      })
        .png({ compressionLevel: 1 })
        .toBuffer()
    )
    await expect(inspectImage(big, "image/png")).rejects.toThrow(ImageReadError)
  })
})

/** GPS IFD pointer tag 0x8825, little-endian as libvips writes it. */
const GPS_IFD = Buffer.from([0x25, 0x88])

const photo = (format: "jpeg" | "png" | "webp" | "avif") =>
  sharp({
    create: { width: 40, height: 30, channels: 3, background: "#336699" },
  })
    .toFormat(format)
    .withExif({
      IFD0: { Make: "PhoneCo", Model: "X1" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "53/1 20/1 0/1" },
    })
    .withMetadata({ orientation: 6 })
    .withIccProfile("p3")
    .toBuffer()

describe("prepareUpload re-encodes raster images (privacy: no EXIF/GPS)", () => {
  it("drops EXIF incl. GPS, applies the orientation and keeps the ICC profile (JPEG)", async () => {
    const input = await photo("jpeg")
    const before = await sharp(input).metadata()
    expect(before.exif?.includes(GPS_IFD)).toBe(true)
    expect(before.exif?.includes("PhoneCo")).toBe(true)
    expect(before.orientation).toBe(6)
    expect(before.icc).toBeDefined()

    const prepared = await prepareUpload(new File([input], "IMG_0001.jpg"))
    const after = await sharp(prepared.bytes).metadata()
    expect(after.exif).toBeUndefined()
    expect(after.xmp).toBeUndefined()
    expect(after.iptc).toBeUndefined()
    expect(after.orientation).toBeUndefined()
    expect(after.icc).toBeDefined()
    expect(after).toMatchObject({ format: "jpeg", width: 30, height: 40 })
    expect(Buffer.from(prepared.bytes).includes("PhoneCo")).toBe(false)
    expect(prepared).toMatchObject({
      mime: "image/jpeg",
      width: 30,
      height: 40,
      size: prepared.bytes.byteLength,
    })
  })

  it.each(["png", "webp", "avif"] as const)(
    "re-encodes %s in its own format without metadata",
    async (format) => {
      const prepared = await prepareUpload(
        new File([await photo(format)], `a.${format}`)
      )
      const after = await sharp(prepared.bytes).metadata()
      expect(after.format).toBe(format === "avif" ? "heif" : format)
      expect(after.exif).toBeUndefined()
      expect(after.icc).toBeDefined()
      expect(Buffer.from(prepared.bytes).includes("PhoneCo")).toBe(false)
    }
  )

  it("leaves PDFs untouched", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n")
    const prepared = await prepareUpload(new File([pdf], "a.pdf"))
    expect(Buffer.from(prepared.bytes).equals(Buffer.from(pdf))).toBe(true)
  })
})
