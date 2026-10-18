import "server-only"

import sharp from "sharp"

import type { UploadMime } from "./media-sniff"

/** Larger images are refused (decompression bombs; notes §5.6 `limitInputPixels`). */
export const MAX_INPUT_PIXELS = 40_000_000

export class ImageReadError extends Error {}

export type ImageInfo = {
  width: number | null
  height: number | null
  blurDataUrl: string | null
}

/**
 * sharp metadata + blur placeholder (spec §11, notes §5.6). The decoded
 * type must equal the sniffed one; sizes are EXIF-oriented; raster images
 * get a 16 px WebP data URL for next/image placeholder="blur".
 */
export async function inspectImage(
  bytes: Uint8Array,
  mime: UploadMime
): Promise<ImageInfo> {
  if (mime === "application/pdf")
    return { width: null, height: null, blurDataUrl: null }
  const meta = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
    .metadata()
    .catch(() => {
      throw new ImageReadError("This image could not be read.")
    })
  if (meta.mediaType !== mime)
    throw new ImageReadError("The file content does not match its image type.")
  const width = meta.autoOrient?.width ?? meta.width ?? null
  const height = meta.autoOrient?.height ?? meta.height ?? null
  if (width && height && width * height > MAX_INPUT_PIXELS)
    throw new ImageReadError("Images can be up to 40 megapixels.")
  if (mime === "image/svg+xml") return { width, height, blurDataUrl: null }
  try {
    const tiny = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .autoOrient()
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer()
    return {
      width,
      height,
      blurDataUrl: `data:image/webp;base64,${tiny.toString("base64")}`,
    }
  } catch {
    throw new ImageReadError("This image could not be read.")
  }
}
