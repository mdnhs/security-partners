import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { diskStorage } from "@/server/lib/storage"
import { insertMediaRow } from "@/server/modules/media/repo"

import { resetDb } from "../db"

// 1000 bytes, each its own index mod 256: any slice is easy to check.
const BYTES = Uint8Array.from({ length: 1000 }, (_, i) => i % 256)
const KEY = "2026/10/0190a6e0-0000-7000-8000-00000000f11e.pdf"
const SVG_KEY = "2026/10/0190a6e0-0000-7000-8000-00000000f11f.svg"
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'
)
const URL_ = `/api/v1/media/file/${KEY}`

const get = (headers: Record<string, string> = {}, url = URL_) =>
  app.request(url, { headers })
const bytesOf = async (res: Response) => new Uint8Array(await res.arrayBuffer())

beforeAll(async () => {
  await resetDb()
  const disk = diskStorage()
  await disk.put(KEY, BYTES, "application/pdf")
  await disk.put(SVG_KEY, SVG, "image/svg+xml")
  await insertMediaRow(getDb(), {
    key: KEY,
    driver: "disk",
    mime: "application/pdf",
    size: BYTES.byteLength,
    originalName: "report.pdf",
  })
  await insertMediaRow(getDb(), {
    key: SVG_KEY,
    driver: "disk",
    mime: "image/svg+xml",
    size: SVG.byteLength,
    originalName: "logo.svg",
  })
})

afterAll(async () => {
  const disk = diskStorage()
  await disk.delete(KEY)
  await disk.delete(SVG_KEY)
})

describe("media file route: streaming, Range and ETag", () => {
  it("200: whole file, Accept-Ranges, ETag and the existing protections", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get("accept-ranges")).toBe("bytes")
    expect(res.headers.get("content-length")).toBe("1000")
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("content-disposition")).toBe(
      "inline; filename*=UTF-8''report.pdf"
    )
    expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]{32}"$/)
    expect(res.body).toBeInstanceOf(ReadableStream)
    expect(await bytesOf(res)).toEqual(BYTES)
  })

  it("206: a single range, closed, open-ended or suffix", async () => {
    const cases: [string, number, number][] = [
      ["bytes=0-9", 0, 9],
      ["bytes=990-", 990, 999],
      ["bytes=-5", 995, 999],
      ["bytes=500-5000", 500, 999], // end past the file is clamped
    ]
    for (const [range, start, end] of cases) {
      const res = await get({ range })
      expect(res.status, range).toBe(206)
      expect(res.headers.get("content-range"), range).toBe(
        `bytes ${start}-${end}/1000`
      )
      expect(res.headers.get("content-length"), range).toBe(
        String(end - start + 1)
      )
      expect(res.headers.get("content-type")).toBe("application/pdf")
      expect(res.headers.get("x-content-type-options")).toBe("nosniff")
      expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]{32}"$/)
      expect(await bytesOf(res), range).toEqual(BYTES.slice(start, end + 1))
    }
  })

  it("416: unsatisfiable ranges name the full size", async () => {
    for (const range of ["bytes=1000-", "bytes=5000-6000", "bytes=-0"]) {
      const res = await get({ range })
      expect(res.status, range).toBe(416)
      expect(res.headers.get("content-range"), range).toBe("bytes */1000")
    }
  })

  it("200: multi-range, malformed or non-byte ranges get the whole file", async () => {
    for (const range of [
      "bytes=0-1,5-6",
      "bytes=abc",
      "bytes=9-3",
      "items=0-1",
    ]) {
      const res = await get({ range })
      expect(res.status, range).toBe(200)
      expect(res.headers.get("content-range")).toBeNull()
      expect((await bytesOf(res)).byteLength, range).toBe(1000)
    }
  })

  it("304: If-None-Match with the current ETag (also in a list or as W/)", async () => {
    const etag = (await get()).headers.get("etag")!
    for (const value of [etag, `"nope", ${etag}`, `W/${etag}`, "*"]) {
      const res = await get({ "if-none-match": value })
      expect(res.status, value).toBe(304)
      expect(res.headers.get("etag")).toBe(etag)
      expect(await res.text()).toBe("")
    }
    expect((await get({ "if-none-match": '"other"' })).status).toBe(200)
    // If-None-Match wins over Range.
    expect(
      (await get({ "if-none-match": etag, range: "bytes=0-1" })).status
    ).toBe(304)
  })

  it("If-Range: the range applies only while the ETag still matches", async () => {
    const etag = (await get()).headers.get("etag")!
    expect((await get({ range: "bytes=0-1", "if-range": etag })).status).toBe(
      206
    )
    expect(
      (await get({ range: "bytes=0-1", "if-range": '"stale"' })).status
    ).toBe(200)
  })

  it("SVG keeps its sandbox CSP and DB content type on 206", async () => {
    const res = await get(
      { range: "bytes=0-3" },
      `/api/v1/media/file/${SVG_KEY}`
    )
    expect(res.status).toBe(206)
    expect(res.headers.get("content-type")).toBe("image/svg+xml")
    expect(res.headers.get("content-security-policy")).toMatch(/; sandbox$/)
    expect(new TextDecoder().decode(await bytesOf(res))).toBe("<svg")
  })

  it("HEAD answers with the same headers and no body", async () => {
    const res = await app.request(URL_, { method: "HEAD" })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-length")).toBe("1000")
    expect(res.headers.get("accept-ranges")).toBe("bytes")
    expect(await res.text()).toBe("")
    const part = await app.request(URL_, {
      method: "HEAD",
      headers: { range: "bytes=0-9" },
    })
    expect(part.status).toBe(206)
    expect(part.headers.get("content-range")).toBe("bytes 0-9/1000")
  })

  it("still 404s keys without a servable row, Range or not", async () => {
    const res = await get(
      { range: "bytes=0-1" },
      "/api/v1/media/file/2026/10/missing.pdf"
    )
    expect(res.status).toBe(404)
  })
})
