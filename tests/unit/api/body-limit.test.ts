import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import type { AppEnv } from "@/server/api/context"
import {
  BODY_LIMITS,
  isUploadPath,
  limitAdminBody,
} from "@/server/api/middleware/body-limit"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"

const ID = "0190a6e0-0000-7000-8000-000000000001"

const app = new Hono<AppEnv>()
  .use("*", requestIdMiddleware)
  .use("*", limitAdminBody)
  .post("*", async (c) =>
    c.json({ size: (await c.req.arrayBuffer()).byteLength })
  )

const post = (path: string, bytes: number) =>
  app.request(path, { method: "POST", body: new Uint8Array(bytes) })

describe("admin body limit chosen by path (ledger Phase 1 ruling)", () => {
  it("recognises only the two upload paths", () => {
    expect(isUploadPath("/api/v1/admin/media/upload")).toBe(true)
    expect(isUploadPath(`/api/v1/admin/media/${ID}/replace`)).toBe(true)
    expect(isUploadPath("/api/v1/admin/media/upload/x")).toBe(false)
    expect(isUploadPath(`/api/v1/admin/media/${ID}`)).toBe(false)
    expect(isUploadPath("/api/v1/admin/pages/home/draft")).toBe(false)
  })

  it("uploads may exceed 1 MB up to 20 MB + envelope", async () => {
    expect(
      (await post("/api/v1/admin/media/upload", 2 * 1024 * 1024)).status
    ).toBe(200)
    expect(
      (await post("/api/v1/admin/media/upload", BODY_LIMITS.upload)).status
    ).toBe(200)
    const tooBig = await post(
      "/api/v1/admin/media/upload",
      BODY_LIMITS.upload + 1
    )
    expect(tooBig.status).toBe(413)
    expect((await tooBig.json()).error).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Files can be up to 20 MB",
    })
  })

  it("every other admin path keeps 1 MB", async () => {
    expect(
      (await post("/api/v1/admin/pages/home/draft", 1024 * 1024)).status
    ).toBe(200)
    expect(
      (await post("/api/v1/admin/pages/home/draft", 1024 * 1024 + 1)).status
    ).toBe(413)
    expect(
      (await post(`/api/v1/admin/media/${ID}`, 2 * 1024 * 1024)).status
    ).toBe(413)
  })
})
