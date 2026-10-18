import {
  NoSuchKey,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { R2Config } from "@/lib/schemas/integrations"
import {
  createR2Client,
  r2Endpoint,
  resetR2Client,
  sharedR2Client,
} from "@/server/lib/r2-client"
import { r2Storage } from "@/server/lib/storage/r2"

const config: R2Config = {
  accountId: "0123456789abcdef0123456789abcdef",
  jurisdiction: "default",
  bucket: "sp-media",
  accessKeyId: "AKID",
  secretAccessKey: "SECRET",
}
const KEY = "2026/10/0190a6e0-0000-7000-8000-000000000001.png"

function fakeClient(
  reply: (command: {
    constructor: { name: string }
    input: Record<string, unknown>
  }) => unknown
) {
  const send = vi.fn(async (command) => reply(command))
  return { client: { send, destroy: vi.fn() } as unknown as S3Client, send }
}

describe("createR2Client (libraries notes §5.5)", () => {
  it("targets the account endpoint with checksums only when required", async () => {
    const client = createR2Client(config)
    expect(await client.config.requestChecksumCalculation()).toBe(
      "WHEN_REQUIRED"
    )
    expect(await client.config.responseChecksumValidation()).toBe(
      "WHEN_REQUIRED"
    )
    expect((await client.config.endpoint!()).hostname).toBe(
      "0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com"
    )
    expect(r2Endpoint({ ...config, jurisdiction: "eu" })).toBe(
      "https://0123456789abcdef0123456789abcdef.eu.r2.cloudflarestorage.com"
    )
    client.destroy()
  })
})

describe("r2Storage", () => {
  it("puts objects with type, length and immutable caching", async () => {
    const { client, send } = fakeClient(() => ({}))
    const r2 = r2Storage(config, client)
    expect(r2.name).toBe("r2")
    await r2.put(KEY, new Uint8Array([1, 2]), "image/png")
    const command = send.mock.calls[0][0]
    expect(command.constructor.name).toBe("PutObjectCommand")
    expect(command.input).toMatchObject({
      Bucket: "sp-media",
      Key: KEY,
      ContentType: "image/png",
      ContentLength: 2,
      CacheControl: "public, max-age=31536000, immutable",
    })
    expect(r2.url(KEY)).toBe(`/api/v1/media/file/${KEY}`)
  })

  it("reads bytes; a missing key reads as null", async () => {
    const { client } = fakeClient((command) => {
      if (command.input.Key === KEY)
        return {
          Body: { transformToByteArray: async () => new Uint8Array([7]) },
        }
      throw new NoSuchKey({
        message: "missing",
        $metadata: { httpStatusCode: 404 },
      })
    })
    const r2 = r2Storage(config, client)
    expect([...((await r2.read(KEY)) ?? [])]).toEqual([7])
    expect(await r2.read("2026/10/missing.png")).toBeNull()
  })

  it("streams with GetObject, passing a byte range through as Range", async () => {
    const web = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([3, 4]))
          controller.close()
        },
      })
    const { client, send } = fakeClient((command) => {
      if (command.input.Key !== KEY)
        throw new NoSuchKey({
          message: "missing",
          $metadata: { httpStatusCode: 404 },
        })
      return command.input.Range
        ? {
            ContentLength: 2,
            ContentRange: "bytes 3-4/10",
            Body: { transformToWebStream: web },
          }
        : { ContentLength: 10, Body: { transformToWebStream: web } }
    })
    const r2 = r2Storage(config, client)

    const part = await r2.stream(KEY, { start: 3, end: 4 })
    expect(send.mock.calls[0][0].constructor.name).toBe("GetObjectCommand")
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "sp-media",
      Key: KEY,
      Range: "bytes=3-4",
    })
    expect(part?.size).toBe(10) // total, from Content-Range
    expect(part?.partial).toBe(true)
    expect([
      ...new Uint8Array(await new Response(part!.body).arrayBuffer()),
    ]).toEqual([3, 4])

    const whole = await r2.stream(KEY)
    expect(send.mock.calls[1][0].input).toEqual({
      Bucket: "sp-media",
      Key: KEY,
    })
    expect(whole?.size).toBe(10)
    expect(whole?.partial).toBe(false)

    expect(await r2.stream("2026/10/missing.png")).toBeNull()
    await expect(r2.stream("../x")).rejects.toThrow()
  })

  it("a refused range (InvalidRange / 416) falls back to the whole object, marked not partial", async () => {
    const { client, send } = fakeClient((command) => {
      if (command.input.Range)
        throw new S3ServiceException({
          name: "InvalidRange",
          $fault: "client",
          message: "The requested range is not satisfiable",
          $metadata: { httpStatusCode: 416 },
        })
      return {
        ContentLength: 4,
        Body: {
          transformToWebStream: () =>
            new Response(new Uint8Array([1, 2, 3, 4])).body!,
        },
      }
    })
    const out = await r2Storage(config, client).stream(KEY, {
      start: 5,
      end: 9,
    })
    expect(send.mock.calls.map((c) => c[0].input.Range)).toEqual([
      "bytes=5-9",
      undefined,
    ])
    expect(out).toMatchObject({ size: 4, partial: false })
    expect([
      ...new Uint8Array(await new Response(out!.body).arrayBuffer()),
    ]).toEqual([1, 2, 3, 4])

    // A bare 416 status (no InvalidRange name) is treated the same way.
    const bare = fakeClient((command) => {
      if (command.input.Range)
        throw new S3ServiceException({
          name: "Unknown",
          $fault: "client",
          message: "",
          $metadata: { httpStatusCode: 416 },
        })
      return {
        ContentLength: 4,
        Body: { transformToWebStream: () => new Response("abcd").body! },
      }
    })
    expect(
      await r2Storage(config, bare.client).stream(KEY, { start: 5, end: 9 })
    ).toMatchObject({ size: 4, partial: false })
  })

  it("maps stream failures to fixed messages", async () => {
    const { client } = fakeClient(() => {
      throw new Error("getaddrinfo ENOTFOUND SECRET")
    })
    await expect(r2Storage(config, client).stream(KEY)).rejects.toThrow(
      /^Could not reach R2\.$/
    )
  })

  it("deletes, tests with HeadBucket and validates keys", async () => {
    const { client, send } = fakeClient(() => ({}))
    const r2 = r2Storage(config, client)
    await r2.delete(KEY)
    await r2.test()
    expect(send.mock.calls.map((c) => c[0].constructor.name)).toEqual([
      "DeleteObjectCommand",
      "HeadBucketCommand",
    ])
    await expect(
      r2.put("../x", new Uint8Array(), "image/png")
    ).rejects.toThrow()
  })

  it("maps other R2 failures to fixed messages (no provider text, no secrets)", async () => {
    const denied = new S3ServiceException({
      name: "AccessDenied",
      $fault: "client",
      message: "Access Denied for AKID SECRET",
      $metadata: { httpStatusCode: 403 },
    })
    const timeout = Object.assign(new Error("socket SECRET"), {
      name: "TimeoutError",
    })
    const network = new Error("getaddrinfo ENOTFOUND SECRET")
    const cases: [unknown, string][] = [
      [denied, "R2 answered with HTTP 403."],
      [timeout, "R2 did not respond in time."],
      [network, "Could not reach R2."],
    ]
    for (const [error, message] of cases) {
      const { client } = fakeClient(() => {
        throw error
      })
      const r2 = r2Storage(config, client)
      for (const call of [
        () => r2.read(KEY),
        () => r2.put(KEY, new Uint8Array([1]), "image/png"),
        () => r2.delete(KEY),
        () => r2.test(),
      ]) {
        const err = await call().then(
          () => null,
          (e: unknown) => e as Error
        )
        expect(err?.message).toBe(message)
        expect(err?.message).not.toMatch(/SECRET|AKID|Denied|ENOTFOUND/)
        expect((err as Error & { cause?: unknown }).cause).toBeUndefined()
      }
    }
  })

  it("a missing bucket is a failure, not a missing file", async () => {
    const { client } = fakeClient(() => {
      throw new S3ServiceException({
        name: "NoSuchBucket",
        $fault: "client",
        message: "The specified bucket does not exist",
        $metadata: { httpStatusCode: 404 },
      })
    })
    await expect(r2Storage(config, client).read(KEY)).rejects.toThrow(
      /^R2 answered with HTTP 404\.$/
    )
  })
})

describe("sharedR2Client (one keep-alive client per R2 settings)", () => {
  afterEach(() => {
    resetR2Client()
    vi.restoreAllMocks()
  })

  it("reuses the client while account and keys stay the same", () => {
    const first = sharedR2Client(config)
    expect(sharedR2Client({ ...config })).toBe(first)
    expect(sharedR2Client({ ...config, bucket: "other" })).toBe(first)
    expect(r2Storage(config)).toBeDefined()
    expect(sharedR2Client(config)).toBe(first)
  })

  it("destroys the old client when the settings change or R2 is reset", () => {
    const first = sharedR2Client(config)
    const destroyFirst = vi.spyOn(first, "destroy")
    const second = sharedR2Client({ ...config, secretAccessKey: "NEW" })
    expect(second).not.toBe(first)
    expect(destroyFirst).toHaveBeenCalledOnce()
    const destroySecond = vi.spyOn(second, "destroy")
    resetR2Client()
    expect(destroySecond).toHaveBeenCalledOnce()
    expect(sharedR2Client(config)).not.toBe(second)
  })
})
