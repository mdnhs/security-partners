import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { sendMediaFile } from "@/components/admin/media/upload-request"
import { ApiError } from "@/lib/api-client"
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/api/media"

/** A scripted XMLHttpRequest: each test decides how the request ends. */
class FakeXhr {
  static last: FakeXhr | null = null
  method = ""
  url = ""
  body: FormData | null = null
  status = 0
  response: unknown = null
  responseType = ""
  upload: {
    onprogress:
      | ((e: {
          lengthComputable: boolean
          loaded: number
          total: number
        }) => void)
      | null
  } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  aborted = false
  constructor() {
    FakeXhr.last = this
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  send(body: FormData) {
    this.body = body
  }
  abort() {
    this.aborted = true
    this.onabort?.()
  }
  finish(status: number, response: unknown) {
    this.status = status
    this.response = response
    this.onload?.()
  }
}

const png = (size = 1) =>
  new File([new Uint8Array(size)], "hero.png", { type: "image/png" })

beforeEach(() => {
  FakeXhr.last = null
  vi.stubGlobal("XMLHttpRequest", FakeXhr)
})
afterEach(() => vi.unstubAllGlobals())

describe("sendMediaFile (master 6.3)", () => {
  it("posts the file as multipart and reports upload progress", async () => {
    const progress: number[] = []
    const done = sendMediaFile("/api/v1/admin/media/upload", png(), {
      alt: "Gate",
      onProgress: (p) => progress.push(p),
    })
    const xhr = FakeXhr.last!
    expect([xhr.method, xhr.url]).toEqual([
      "POST",
      "/api/v1/admin/media/upload",
    ])
    expect((xhr.body!.get("file") as File).name).toBe("hero.png")
    expect(xhr.body!.get("alt")).toBe("Gate")
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 50, total: 200 })
    xhr.finish(201, { id: "m1" })
    await expect(done).resolves.toEqual({ id: "m1" })
    expect(progress).toEqual([0.25])
  })

  it("rejects with the server's message (422, 413)", async () => {
    const done = sendMediaFile("/u", png())
    FakeXhr.last!.finish(422, {
      error: {
        code: "VALIDATION_FAILED",
        message: "This file type is not supported.",
      },
    })
    const error = await done.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(422)
    expect((error as ApiError).message).toBe("This file type is not supported.")
  })

  it("refuses a file over 20 MB without sending it", async () => {
    const big = {
      name: "huge.png",
      size: MAX_UPLOAD_BYTES + 1,
    } as unknown as File
    const error = await sendMediaFile("/u", big).catch((e: unknown) => e)
    expect(FakeXhr.last).toBeNull()
    expect((error as ApiError).message).toBe("“huge.png” is larger than 20 MB.")
  })

  it("aborts on the signal", async () => {
    const controller = new AbortController()
    const done = sendMediaFile("/u", png(), { signal: controller.signal })
    controller.abort()
    await expect(done).rejects.toMatchObject({ name: "AbortError" })
    expect(FakeXhr.last!.aborted).toBe(true)
  })
})
