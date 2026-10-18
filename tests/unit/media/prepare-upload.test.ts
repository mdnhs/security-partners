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
