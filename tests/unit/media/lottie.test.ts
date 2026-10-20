import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  LottieError,
  MAX_LOTTIE_UNCOMPRESSED_BYTES,
  validateDotLottie,
  validateLottieJson,
} from "@/server/lib/lottie"
import { sniffMime } from "@/server/lib/media-sniff"
import { prepareUpload } from "@/server/modules/media/service"

import { buildDotLottie, buildZip } from "../../fixtures/lottie/zip"

const LOGO = readFileSync(
  new URL("../../fixtures/lottie/logo.json", import.meta.url),
  "utf8"
)
const bytes = (text: string) => new TextEncoder().encode(text)
const logo = () => JSON.parse(LOGO) as Record<string, unknown>
const withLogo = (patch: Record<string, unknown>) =>
  bytes(JSON.stringify({ ...logo(), ...patch }))

const fieldError = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (err) {
    return (err as { details?: { fieldErrors?: Record<string, string[]> } })
      .details?.fieldErrors?.file?.[0]
  }
  throw new Error("expected a rejection")
}

describe("validateLottieJson", () => {
  it("accepts the fixture and reports its size", () => {
    expect(validateLottieJson(bytes(LOGO))).toEqual({ width: 112, height: 68 })
  })

  it("accepts a UTF-8 BOM", () => {
    expect(validateLottieJson(bytes(`﻿${LOGO}`)).width).toBe(112)
  })

  it.each([
    ["not JSON", bytes("{ nope")],
    ["an array", bytes("[1,2]")],
    ["no version", withLogo({ v: undefined })],
    ["a numeric version", withLogo({ v: 5 })],
    ["a version that is not x.y", withLogo({ v: "five" })],
    ["no frame rate", withLogo({ fr: undefined })],
    ["a zero frame rate", withLogo({ fr: 0 })],
    ["a string frame rate", withLogo({ fr: "30" })],
    ["no in point", withLogo({ ip: undefined })],
    ["out point before in point", withLogo({ op: -1 })],
    ["layers that are not a list", withLogo({ layers: {} })],
    ["no width", withLogo({ w: undefined })],
    ["a huge height", withLogo({ h: 1e9 })],
    ["invalid UTF-8", new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])],
  ])("refuses %s", (_name, input) => {
    expect(() => validateLottieJson(input)).toThrow(LottieError)
  })
})

describe("validateDotLottie", () => {
  it("accepts a dotLottie and reports its first animation's size", () => {
    expect(validateDotLottie(buildDotLottie(LOGO))).toEqual({
      width: 112,
      height: 68,
    })
  })

  it("accepts stored (uncompressed) entries", () => {
    const zip = buildZip([
      {
        name: "manifest.json",
        data: JSON.stringify({ animations: [{ id: "a" }] }),
        method: 0,
      },
      { name: "animations/a.json", data: LOGO, method: 0 },
    ])
    expect(validateDotLottie(zip).width).toBe(112)
  })

  it("refuses a zip without manifest.json", () => {
    const zip = buildZip([{ name: "animations/a.json", data: LOGO }])
    expect(() => validateDotLottie(zip)).toThrow(/manifest/)
  })

  it("refuses a manifest without animations", () => {
    const zip = buildZip([
      { name: "manifest.json", data: JSON.stringify({ animations: [] }) },
      { name: "animations/a.json", data: LOGO },
    ])
    expect(() => validateDotLottie(zip)).toThrow(LottieError)
  })

  it("refuses a manifest naming an animation the file does not hold", () => {
    const zip = buildZip([
      {
        name: "manifest.json",
        data: JSON.stringify({ animations: [{ id: "missing" }] }),
      },
      { name: "animations/a.json", data: LOGO },
    ])
    expect(() => validateDotLottie(zip)).toThrow(LottieError)
  })

  it("refuses an animation that is not a Lottie", () => {
    expect(() =>
      validateDotLottie(buildDotLottie(JSON.stringify({ hello: "world" })))
    ).toThrow(LottieError)
  })

  it.each([
    ["a path outside the archive", "../evil.json"],
    ["an absolute path", "/etc/passwd"],
    ["a backslash path", "animations\\a.json"],
  ])("refuses %s", (_name, name) => {
    const zip = buildZip([
      {
        name: "manifest.json",
        data: JSON.stringify({ animations: [{ id: "a" }] }),
      },
      { name: "animations/a.json", data: LOGO },
      { name, data: "x" },
    ])
    expect(() => validateDotLottie(zip)).toThrow(LottieError)
  })

  it("refuses encrypted entries", () => {
    const zip = buildZip([
      {
        name: "manifest.json",
        data: JSON.stringify({ animations: [{ id: "a" }] }),
        flags: 1,
      },
      { name: "animations/a.json", data: LOGO },
    ])
    expect(() => validateDotLottie(zip)).toThrow(LottieError)
  })

  it("refuses a zip bomb: declared sizes over the cap", () => {
    const zip = buildZip([
      {
        name: "manifest.json",
        data: JSON.stringify({ animations: [{ id: "a" }] }),
      },
      { name: "animations/a.json", data: LOGO },
      {
        name: "images/bomb.png",
        data: new Uint8Array(1024),
        declaredSize: MAX_LOTTIE_UNCOMPRESSED_BYTES + 1,
      },
    ])
    expect(() => validateDotLottie(zip)).toThrow(/too large/)
  })

  it("refuses a zip bomb that lies about its size", () => {
    // 20 MB of zeros deflate to ~20 KB; the headers claim 1 KB.
    const zip = buildZip([
      {
        name: "manifest.json",
        data: JSON.stringify({ animations: [{ id: "a" }] }),
      },
      { name: "animations/a.json", data: LOGO },
      {
        name: "images/bomb.png",
        data: new Uint8Array(20 * 1024 * 1024),
        declaredSize: 1024,
      },
    ])
    expect(() => validateDotLottie(zip)).toThrow(LottieError)
  })

  it("refuses too many entries", () => {
    const zip = buildZip([
      {
        name: "manifest.json",
        data: JSON.stringify({ animations: [{ id: "a" }] }),
      },
      { name: "animations/a.json", data: LOGO },
      ...Array.from({ length: 300 }, (_, i) => ({
        name: `images/${i}.png`,
        data: "x",
      })),
    ])
    expect(() => validateDotLottie(zip)).toThrow(LottieError)
  })

  it("refuses bytes that are not a zip", () => {
    expect(() => validateDotLottie(bytes("PK\u0003\u0004garbage"))).toThrow(
      LottieError
    )
  })
})

describe("sniffMime: Lottie candidates", () => {
  it("JSON text and zip archives are Lottie candidates", () => {
    expect(sniffMime(bytes(LOGO))).toBe("video/lottie+json")
    expect(sniffMime(bytes(`  \n${LOGO}`))).toBe("video/lottie+json")
    expect(sniffMime(buildDotLottie(LOGO))).toBe("application/zip+dotlottie")
  })
})

describe("prepareUpload: Lottie files", () => {
  it("accepts a Lottie JSON file", async () => {
    const prepared = await prepareUpload(new File([LOGO], "logo.json"))
    expect(prepared).toMatchObject({
      mime: "video/lottie+json",
      ext: "json",
      width: 112,
      height: 68,
      blurDataUrl: null,
      originalName: "logo.json",
    })
    expect(new TextDecoder().decode(prepared.bytes)).toBe(LOGO)
  })

  it("accepts a dotLottie file", async () => {
    const prepared = await prepareUpload(
      new File([buildDotLottie(LOGO)], "logo.lottie")
    )
    expect(prepared).toMatchObject({
      mime: "application/zip+dotlottie",
      ext: "lottie",
      width: 112,
      height: 68,
    })
  })

  it("refuses JSON that is not a Lottie", async () => {
    expect(
      await fieldError(prepareUpload(new File(['{"a":1}'], "data.json")))
    ).toMatch(/not a Lottie animation/)
  })

  it("refuses a zip that is not a dotLottie", async () => {
    const zip = buildZip([{ name: "readme.txt", data: "hi" }])
    expect(await fieldError(prepareUpload(new File([zip], "x.zip")))).toMatch(
      /not a dotLottie/
    )
  })

  it("refuses Lottie files over 2 MB", async () => {
    const big = JSON.stringify({ ...logo(), nm: "x".repeat(2 * 1024 * 1024) })
    expect(
      await fieldError(prepareUpload(new File([big], "big.json")))
    ).toMatch(/up to 2 MB/)
  })
})
