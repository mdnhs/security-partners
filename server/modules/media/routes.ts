import "server-only"

import { Hono } from "hono"

import { mediaListQuery, mediaUpdateInput } from "@/lib/schemas/api/media"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"
import { notFound } from "@/server/lib/errors"
import {
  decodeKeyPath,
  IMMUTABLE_CACHE,
  MEDIA_FILE_PATH,
} from "@/server/lib/storage/paths"

import * as service from "./service"

/** Multipart body; a malformed one reads as "no file" (422 from the service). */
const formOf = (c: {
  req: { parseBody(): Promise<Record<string, unknown>> }
}) => c.req.parseBody().catch(() => ({}) as Record<string, unknown>)

/** Admin media API (spec §7: media + /upload, /:id/usages). */
export const mediaRoutes = new Hono<AppEnv>()
  .get("/", can({ media: ["read"] }), zv("query", mediaListQuery), async (c) =>
    c.json(await service.listMedia(actorOf(c), c.req.valid("query")), 200)
  )
  .post("/upload", can({ media: ["create"] }), async (c) => {
    const form = await formOf(c)
    return c.json(
      await service.uploadMedia(actorOf(c), { file: form.file, alt: form.alt }),
      201
    )
  })
  .get("/:id", can({ media: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getMediaItem(actorOf(c), c.req.valid("param").id), 200)
  )
  .patch(
    "/:id",
    // The service narrows this: media:update for any file, otherwise only
    // the uploader's own files (alt text and focal point).
    can({ media: ["read"] }),
    zv("param", idParam),
    zv("json", mediaUpdateInput),
    async (c) =>
      c.json(
        await service.updateMedia(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete("/:id", can({ media: ["delete"] }), zv("param", idParam), async (c) =>
    c.json(await service.deleteMedia(actorOf(c), c.req.valid("param").id), 200)
  )
  .get(
    "/:id/usages",
    can({ media: ["read"] }),
    zv("param", idParam),
    async (c) =>
      c.json(await service.listUsages(actorOf(c), c.req.valid("param").id), 200)
  )
  .post(
    "/:id/replace",
    can({ media: ["update"] }),
    zv("param", idParam),
    async (c) => {
      const form = await formOf(c)
      return c.json(
        await service.replaceMedia(actorOf(c), c.req.valid("param").id, {
          file: form.file,
        }),
        200
      )
    }
  )

const SVG_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox"

/** RFC 8187 `filename*` value (encodeURIComponent leaves ' ( ) * ! as is). */
const rfc8187 = (name: string) =>
  encodeURIComponent(name).replace(
    /['()*!]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  )

/**
 * Response headers by the row's MIME type (never the stored object's or the
 * request's): raster images plain; SVG sandboxed (no script, no same-origin
 * access even when opened directly); PDF inline; anything else downloads.
 */
function fileHeaders(file: {
  mime: string
  originalName: string
  size: number
}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Content-Length": String(file.size),
    "Cache-Control": IMMUTABLE_CACHE,
    "X-Content-Type-Options": "nosniff",
  }
  if (file.mime === "image/svg+xml")
    headers["Content-Security-Policy"] = SVG_CSP
  else if (!file.mime.startsWith("image/")) {
    const disposition =
      file.mime === "application/pdf" ? "inline" : "attachment"
    headers["Content-Disposition"] =
      `${disposition}; filename*=UTF-8''${rfc8187(file.originalName || "download")}`
  }
  return headers
}

/**
 * Public file route for disk and R2 files (spec §11). Same origin, so the
 * default next/image optimizer can fetch it. Keys never change, so the
 * response is immutable. Only keys with a disk/r2 media row are served
 * (temp files, healthchecks and static rows are 404).
 */
export const mediaFileRoutes = new Hono<AppEnv>().get("/*", async (c) => {
  // The raw request path (the catch-all route hands Hono the undecoded URL),
  // decoded exactly once per segment and re-validated by decodeKeyPath.
  const pathname = new URL(c.req.url).pathname
  const key = pathname.startsWith(MEDIA_FILE_PATH)
    ? decodeKeyPath(pathname.slice(MEDIA_FILE_PATH.length))
    : null
  const file = key ? await service.readMediaFile(key) : null
  if (!file) throw notFound("File")
  return c.body(
    // fs/S3 bytes are backed by a plain ArrayBuffer, never a shared one.
    file.bytes as Uint8Array<ArrayBuffer>,
    200,
    fileHeaders({ ...file, size: file.bytes.byteLength })
  )
})
