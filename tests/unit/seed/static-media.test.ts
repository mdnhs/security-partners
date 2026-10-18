import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { MEDIA } from "@/server/db/seed/fixtures/media"
import { readStaticMedia } from "@/server/db/seed/media"
import { staticFilePath } from "@/server/lib/storage/static"

describe("readStaticMedia (sharp)", () => {
  it("measures every library image", { timeout: 30_000 }, async () => {
    const rows = await readStaticMedia()
    expect(rows.map((r) => r.key)).toEqual(MEDIA.map((m) => m.key))
    for (const row of rows) {
      expect(row.driver).toBe("static")
      expect(row.size).toBeGreaterThan(0)
      expect(row.width).toBeGreaterThan(0)
      expect(row.height).toBeGreaterThan(0)
    }
    const byKey = new Map(rows.map((r) => [r.key, r]))
    expect(byKey.get("/images/hero.jpg")).toMatchObject({
      mime: "image/jpeg",
      width: 1440,
      height: 748,
      originalName: "hero.jpg",
    })
    expect(byKey.get("/images/logo.png")).toMatchObject({
      mime: "image/png",
      width: 140,
      height: 85,
      alt: "Security Partners Ltd.",
    })
    expect(byKey.get("/images/hero.jpg")?.blurDataUrl).toMatch(
      /^data:image\/webp;base64,/
    )
    expect(byKey.get("/images/icon-shield.svg")).toMatchObject({
      mime: "image/svg+xml",
      width: 24,
      height: 24,
      blurDataUrl: null,
      originalName: "icon-shield.svg",
    })
  })
})

describe("staticFilePath (ledger: containment before keys come from the DB)", () => {
  const publicDir = resolve("public")

  it("maps /images/<file> into public/", () => {
    expect(staticFilePath("/images/hero.jpg", publicDir)).toBe(
      resolve(publicDir, "images/hero.jpg")
    )
  })

  it("rejects keys outside /images/ or escaping public/", () => {
    for (const key of [
      "/images/../../etc/passwd",
      "/images/../.env.development",
      "images/hero.jpg",
      "/api/x.png",
      "/images/",
      "/images/%2e%2e/x.png",
      "/images/a\\b.png",
      "/images/a\0.png",
      "/images//etc/passwd",
    ])
      expect(() => staticFilePath(key, publicDir), key).toThrow()
  })
})
