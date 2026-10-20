import "server-only"

/** Upload allow-list (spec §11): MIME → stored file extension. */
export const UPLOAD_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  // Lottie animations (lib/schemas/api/media LOTTIE_MIMES): candidates by
  // their first bytes, validated by server/lib/lottie before storage.
  "video/lottie+json": "json",
  "application/zip+dotlottie": "lottie",
} as const
export type UploadMime = keyof typeof UPLOAD_TYPES
export type LottieUploadMime = "video/lottie+json" | "application/zip+dotlottie"
/** Types sharp inspects (images) or that need no inspection (PDF). */
export type InspectableMime = Exclude<UploadMime, LottieUploadMime>

export const isLottieUpload = (mime: UploadMime): mime is LottieUploadMime =>
  mime === "video/lottie+json" || mime === "application/zip+dotlottie"

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
/** ZIP local file header "PK\x03\x04" (dotLottie). */
const ZIP = [0x50, 0x4b, 0x03, 0x04]

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((value, i) => bytes[offset + i] === value)

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end))

/** ISO-BMFF `ftyp` box whose major or compatible brands include avif/avis. */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") return false
  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0)
  const end = Math.min(boxSize, bytes.length, 256)
  const brands = [ascii(bytes, 8, 12)]
  for (let at = 16; at + 4 <= end; at += 4)
    brands.push(ascii(bytes, at, at + 4))
  return brands.includes("avif") || brands.includes("avis")
}

const SVG_PROLOG =
  /^(?:\s+|<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)*/i

/** First element after an optional BOM, XML declaration, comments and doctype is <svg>. */
function isSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 4096))
    .replace(/^﻿/, "")
  return /^<svg[\s>/]/i.test(head.replace(SVG_PROLOG, ""))
}

/** The upload's real type from its bytes; the request's Content-Type is never trusted. */
export function sniffMime(bytes: Uint8Array): UploadMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(bytes, PNG)) return "image/png"
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  )
    return "image/webp"
  if (isAvif(bytes)) return "image/avif"
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-")
    return "application/pdf"
  if (isSvg(bytes)) return "image/svg+xml"
  // Only Lottie candidates: prepareUpload refuses JSON / ZIP files that
  // are not Lottie animations.
  if (startsWith(bytes, ZIP)) return "application/zip+dotlottie"
  if (
    /^\s*\{/.test(
      ascii(bytes, 0, Math.min(bytes.length, 64)).replace(/^\xef\xbb\xbf/, "")
    )
  )
    return "video/lottie+json"
  return null
}
