import "server-only"

import sharp from "sharp"

import type { InspectableMime } from "./media-sniff"

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
  mime: InspectableMime
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

export type RasterMime = Exclude<
  InspectableMime,
  "image/svg+xml" | "application/pdf"
>

export const isRasterMime = (mime: InspectableMime): mime is RasterMime =>
  mime !== "image/svg+xml" && mime !== "application/pdf"

/**
 * Privacy: uploaded photos are re-encoded in their own format before they
 * are stored, so EXIF (GPS position, device, timestamps), XMP and IPTC never
 * reach the public file route. The EXIF orientation is applied to the
 * pixels first; only the ICC colour profile is kept. Returns the stored
 * bytes and their (now upright) size.
 */
export async function reencodeImage(
  bytes: Uint8Array,
  mime: RasterMime
): Promise<{ bytes: Uint8Array<ArrayBuffer>; width: number; height: number }> {
  const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
    .autoOrient()
    .keepIccProfile()
  const encoded =
    mime === "image/jpeg"
      ? image.jpeg({ quality: 90, mozjpeg: true })
      : mime === "image/png"
        ? image.png({ compressionLevel: 9 })
        : mime === "image/webp"
          ? image.webp({ quality: 90 })
          : image.avif({ quality: 80 })
  try {
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true })
    return {
      bytes: new Uint8Array(data),
      width: info.width,
      height: info.height,
    }
  } catch {
    throw new ImageReadError("This image could not be read.")
  }
}
