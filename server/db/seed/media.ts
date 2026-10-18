import "server-only"

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import sharp from "sharp"

import { staticFilePath } from "@/server/lib/storage/static"

import { MEDIA, type MediaKey } from "./fixtures/media"

export type StaticMediaRow = {
  key: MediaKey
  driver: "static"
  mime: string
  size: number
  width: number | null
  height: number | null
  blurDataUrl: string | null
  alt: string
}

/**
 * Reads every library image from public/ (key "/images/x.png" →
 * public/images/x.png, contained in public/) and measures it with sharp. Raster images get a
 * 16px WebP blur placeholder; SVGs do not.
 */
export async function readStaticMedia(
  publicDir = resolve(process.cwd(), "public")
): Promise<StaticMediaRow[]> {
  return Promise.all(
    MEDIA.map(async ({ key, alt }) => {
      const file = await readFile(staticFilePath(key, publicDir))
      const meta = await sharp(file).metadata()
      const raster = meta.format !== "svg"
      const blur = raster
        ? await sharp(file)
            .resize(16, 16, { fit: "inside" })
            .webp({ quality: 40 })
            .toBuffer()
        : null
      return {
        key,
        driver: "static" as const,
        mime: meta.mediaType ?? `image/${meta.format}`,
        size: file.byteLength,
        width: meta.autoOrient?.width ?? meta.width ?? null,
        height: meta.autoOrient?.height ?? meta.height ?? null,
        blurDataUrl: blur
          ? `data:image/webp;base64,${blur.toString("base64")}`
          : null,
        alt,
      }
    })
  )
}
