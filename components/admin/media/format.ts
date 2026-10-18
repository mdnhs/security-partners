import type { MediaDriverName, MediaItem } from "@/lib/schemas/api/media"

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const rounded =
    value >= 10 || Number.isInteger(value)
      ? Math.round(value)
      : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

export function mediaName(
  item: Pick<MediaItem, "originalName" | "alt" | "url">
): string {
  return item.originalName || item.alt || item.url.split("/").pop() || "File"
}

export const DRIVER_LABELS: Record<MediaDriverName, string> = {
  static: "Built in",
  disk: "Server disk",
  r2: "Cloudflare R2",
}

const TYPE_NAMES: Record<string, string> = {
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
  "image/webp": "WebP image",
  "image/avif": "AVIF image",
  "image/svg+xml": "SVG image",
  "application/pdf": "PDF document",
}

export function typeLabel(mime: string): string {
  return TYPE_NAMES[mime] ?? mime
}

export const isRaster = (mime: string) =>
  mime.startsWith("image/") && mime !== "image/svg+xml"
