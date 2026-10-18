import "server-only"

import { uuidv7 } from "uuidv7"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  MAX_UPLOAD_BYTES,
  type MediaItem,
  type MediaListQuery,
} from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import {
  ImageReadError,
  type ImageInfo,
  inspectImage,
} from "@/server/lib/image"
import {
  sniffMime,
  UPLOAD_TYPES,
  type UploadMime,
} from "@/server/lib/media-sniff"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { getStorage, storageFor } from "@/server/lib/storage"
import { mediaUrl } from "@/server/lib/storage/paths"
import { sanitizeSvg, SvgSanitizeError } from "@/server/lib/svg-sanitize"

import {
  findMediaById,
  findServableMedia,
  insertMediaRow,
  listMediaRows,
  lockR2Settings,
  type R2SettingsStamp,
  readR2Settings,
} from "./repo"

type MediaRow = NonNullable<Awaited<ReturnType<typeof findMediaById>>>

export function toItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    url: mediaUrl(row),
    alt: row.alt,
    mime: row.mime,
    width: row.width,
    height: row.height,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    originalName: row.originalName,
    driver: row.driver,
    focalX: row.focalX,
    focalY: row.focalY,
  }
}

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const fileError = (message: string) =>
  new AppError("VALIDATION_FAILED", message, {
    fieldErrors: { file: [message] },
  })

const ALT_MAX = 500

function parseAlt(value: unknown): string {
  if (value === undefined || value === null || value === "") return ""
  if (typeof value !== "string" || value.length > ALT_MAX)
    throw new AppError("VALIDATION_FAILED", "Invalid input", {
      fieldErrors: { alt: [`Up to ${ALT_MAX} characters`] },
    })
  return value.trim()
}

/** Last path segment, no control characters, at most 200 characters. */
function cleanFileName(name: string, ext: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  // eslint-disable-next-line no-control-regex
  const clean = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200)
  return clean || `upload.${ext}`
}

export type PreparedUpload = {
  bytes: Uint8Array
  mime: UploadMime
  ext: string
  size: number
  originalName: string
} & ImageInfo

/** Spec §11 pipeline up to storage: size, sniffed type, SVG sanitising, sharp metadata + blur. */
export async function prepareUpload(file: unknown): Promise<PreparedUpload> {
  if (!(file instanceof File)) throw fileError("Choose a file to upload")
  if (file.size === 0) throw fileError("This file is empty")
  if (file.size > MAX_UPLOAD_BYTES) throw fileError("Files can be up to 20 MB")
  let bytes = new Uint8Array(await file.arrayBuffer())
  const mime = sniffMime(bytes)
  if (!mime) throw fileError("Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file")
  if (mime === "image/svg+xml") {
    try {
      bytes = new TextEncoder().encode(
        sanitizeSvg(new TextDecoder().decode(bytes))
      )
    } catch (err) {
      if (err instanceof SvgSanitizeError) throw fileError(err.message)
      throw err
    }
  }
  let info: ImageInfo
  try {
    info = await inspectImage(bytes, mime)
  } catch (err) {
    if (err instanceof ImageReadError) throw fileError(err.message)
    throw err
  }
  const ext = UPLOAD_TYPES[mime]
  return {
    bytes,
    mime,
    ext,
    size: bytes.byteLength,
    originalName: cleanFileName(file.name, ext),
    ...info,
  }
}

const sameR2Settings = (a: R2SettingsStamp | null, b: R2SettingsStamp | null) =>
  a !== null &&
  b !== null &&
  a.version === b.version &&
  a.updatedAt.getTime() === b.updatedAt.getTime()

/** "YYYY/MM/<uuid v7>.<ext>" (UTC). Never reused, so files are cached as immutable. */
export function newMediaKey(ext: string, now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}/${month}/${uuidv7()}.${ext}`
}

/** Library rows (picker + library screen). */
export async function listMedia(
  actor: Actor,
  query: MediaListQuery
): Promise<Paginated<MediaItem>> {
  assertCan(actor, { media: ["read"] })
  const { rows, total } = await listMediaRows(getDb(), {
    q: query.q || undefined,
    kind: query.kind,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getMediaItem(
  actor: Actor,
  id: string
): Promise<MediaItem> {
  assertCan(actor, { media: ["read"] })
  const row = await findMediaById(getDb(), id)
  if (!row) throw notFound("Media")
  return toItem(row)
}

/** POST /media/upload: stored with the active driver (R2 if configured, else disk). */
export async function uploadMedia(
  actor: Actor,
  input: { file: unknown; alt?: unknown }
): Promise<MediaItem> {
  assertCan(actor, { media: ["create"] })
  const alt = parseAlt(input.alt)
  const prepared = await prepareUpload(input.file)
  const db = getDb()
  const r2Before = await readR2Settings(db)
  const storage = await getStorage(db)
  const key = newMediaKey(prepared.ext)
  await storage.put(key, prepared.bytes, prepared.mime)
  try {
    const row = await db.transaction(async (tx) => {
      // An r2 row is only written while the R2 settings it was stored with
      // are still saved, held FOR SHARE so Disconnect waits for this commit.
      if (
        storage.name === "r2" &&
        !sameR2Settings(r2Before, await lockR2Settings(tx))
      )
        throw new AppError(
          "CONFLICT",
          "The storage settings changed during the upload. Try again."
        )
      const created = await insertMediaRow(tx, {
        key,
        driver: storage.name,
        mime: prepared.mime,
        size: prepared.size,
        width: prepared.width,
        height: prepared.height,
        blurDataUrl: prepared.blurDataUrl,
        alt,
        originalName: prepared.originalName,
        createdBy: actor.userId,
      })
      await writeAudit(tx, actor, {
        action: "media.uploaded",
        entityType: "media",
        entityId: created.id,
        diff: {
          name: prepared.originalName,
          mime: prepared.mime,
          size: prepared.size,
          driver: storage.name,
        },
      })
      return created
    })
    return toItem(row)
  } catch (err) {
    await storage.delete(key).catch(() => undefined)
    throw err
  }
}

/** Bytes of a disk/R2 file for the public file route; null = 404. */
export async function readMediaFile(
  key: string
): Promise<{ bytes: Uint8Array; mime: string; originalName: string } | null> {
  const db = getDb()
  // Twice: a migration may move the file between the lookup and the read.
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await findServableMedia(db, key)
    if (!row) return null
    const storage = await storageFor(row.driver, db)
    const bytes = storage ? await storage.read(key) : null
    if (bytes) return { bytes, mime: row.mime, originalName: row.originalName }
  }
  return null
}
