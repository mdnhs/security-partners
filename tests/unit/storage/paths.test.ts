import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  decodeKeyPath,
  encodeKeyPath,
  isValidKey,
  keySegments,
  mediaFileUrl,
  mediaUrl,
  resolveInside,
} from "@/server/lib/storage/paths"

const KEY = "2026/10/0190a6e0-0000-7000-8000-000000000001.png"

describe("media keys (ledger: containment + per-segment encoding)", () => {
  it("accepts upload keys and rejects anything that could escape", () => {
    expect(isValidKey(KEY)).toBe(true)
    expect(keySegments(KEY)).toEqual(["2026", "10", KEY.split("/")[2]])
    for (const bad of [
      "",
      "../etc/passwd",
      "2026/../../x",
      "/abs/x.png",
      "a//b.png",
      "a/.hidden",
      "a\\b.png",
      "a/b c.png",
      "a/%2e%2e/x",
      "a..b/x",
      "1/2/3/4/5/6/7/8/9",
      "a/b\0.png",
      "a/b.png\0",
      "C:/x.png",
      "a/..",
      "./a.png",
      "a/b.png/",
    ])
      expect(isValidKey(bad), bad).toBe(false)
    expect(() => keySegments("../x")).toThrow(/Invalid media key/)
  })

  it("resolves inside the root only", () => {
    const root = resolve("/tmp/sp-uploads")
    expect(resolveInside(root, KEY)).toBe(`${root}/${KEY}`)
    expect(() => resolveInside(root, "../outside.png")).toThrow()
  })

  it("encodes per segment, keeping slashes", () => {
    expect(encodeKeyPath(KEY)).toBe(KEY)
    expect(encodeKeyPath("a/b")).not.toContain("%2F")
    expect(decodeKeyPath(KEY)).toBe(KEY)
    expect(decodeKeyPath("..%2Fetc/passwd")).toBeNull()
    expect(decodeKeyPath("%E0%A4%A")).toBeNull()
    for (const bad of [
      "%2e%2e/etc/passwd",
      "a/%2E%2E/x",
      "a%5Cb.png",
      "a%00b.png",
      "%2Fetc/passwd",
      "a/%252e%252e/x",
    ])
      expect(decodeKeyPath(bad), bad).toBeNull()
  })

  it("serves disk and R2 rows from our own origin; static rows keep their path", () => {
    expect(mediaFileUrl(KEY)).toBe(`/api/v1/media/file/${KEY}`)
    expect(mediaUrl({ driver: "disk", key: KEY })).toBe(
      `/api/v1/media/file/${KEY}`
    )
    expect(mediaUrl({ driver: "r2", key: KEY })).toBe(
      `/api/v1/media/file/${KEY}`
    )
    expect(mediaUrl({ driver: "static", key: "/images/hero.jpg" })).toBe(
      "/images/hero.jpg"
    )
  })
})
