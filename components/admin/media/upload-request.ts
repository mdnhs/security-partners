"use client"

import { ApiError, type ApiErrorBody } from "@/lib/api-client"
import { MAX_UPLOAD_BYTES, type MediaItem } from "@/lib/schemas/api/media"

export type UploadOptions = {
  alt?: string
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Multipart POST through XMLHttpRequest: fetch() reports no upload
 * progress. Same origin with the session cookie; the server answers with
 * the API envelope, turned into ApiError like `unwrap()`.
 */
export function sendMediaFile(
  url: string,
  file: File,
  opts: UploadOptions = {}
): Promise<MediaItem> {
  const tooLarge = () =>
    new ApiError(413, {
      error: {
        code: "VALIDATION_FAILED",
        message: `“${file.name}” is larger than 20 MB.`,
      },
    })
  // Checked here first, so a too-large file never starts a 20 MB request.
  if (file.size > MAX_UPLOAD_BYTES) return Promise.reject(tooLarge())
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.responseType = "json"
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) opts.onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      const body = xhr.response as Partial<ApiErrorBody> | null
      if (xhr.status >= 200 && xhr.status < 300)
        resolve(xhr.response as MediaItem)
      // A 413 without the API envelope (a proxy in front) reads like ours.
      else if (xhr.status === 413 && !body?.error) reject(tooLarge())
      else reject(new ApiError(xhr.status, body))
    }
    xhr.onerror = () => reject(new Error("Network error"))
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"))
    opts.signal?.addEventListener("abort", () => xhr.abort())
    const form = new FormData()
    form.append("file", file)
    if (opts.alt) form.append("alt", opts.alt)
    xhr.send(form)
  })
}

export const uploadMediaFile = (file: File, opts?: UploadOptions) =>
  sendMediaFile("/api/v1/admin/media/upload", file, opts)

export const replaceMediaFile = (
  id: string,
  file: File,
  opts?: UploadOptions
) => sendMediaFile(`/api/v1/admin/media/${id}/replace`, file, opts)
