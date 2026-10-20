import { readFileSync } from "node:fs"

import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { MediaItem } from "@/lib/schemas/api/media"
import type { SettingsDto } from "@/lib/schemas/api/settings"
import { siteSettings } from "@/lib/schemas/settings/site"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import { diskStorage } from "@/server/lib/storage"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { buildDotLottie, buildZip } from "../../fixtures/lottie/zip"
import { resetDb } from "../db"
import { adminRequest, ORIGIN, signedInUser } from "../helpers/auth"

const LOGO = readFileSync(
  new URL("../../fixtures/lottie/logo.json", import.meta.url),
  "utf8"
)

let editor: string
const created: string[] = []

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
})

afterAll(async () => {
  const disk = diskStorage()
  for (const key of created) await disk.delete(key)
})

type Uploaded = MediaItem & {
  error?: { fieldErrors?: Record<string, string[]> }
}

async function upload(bytes: Uint8Array | string, name: string, type = "") {
  const form = new FormData()
  form.append(
    "file",
    new File(
      [typeof bytes === "string" ? bytes : new Uint8Array(bytes)],
      name,
      { type }
    )
  )
  const res = await app.request("/api/v1/admin/media/upload", {
    method: "POST",
    headers: { origin: ORIGIN, cookie: editor },
    body: form,
  })
  const body = (await res.json()) as Uploaded
  if (res.status === 201)
    created.push(body.url.replace("/api/v1/media/file/", ""))
  return { status: res.status, body }
}

const fileError = (body: Uploaded) => body.error?.fieldErrors?.file?.[0]

async function list(kind?: string) {
  const res = await adminRequest(
    `/media?pageSize=100${kind ? `&kind=${kind}` : ""}`,
    { cookie: editor }
  )
  expect(res.status).toBe(200)
  return ((await res.json()) as { items: MediaItem[] }).items
}

async function saveSite(patch: Record<string, unknown>) {
  const current = (await (
    await adminRequest("/settings/site", { cookie: editor })
  ).json()) as SettingsDto
  return adminRequest("/settings/site/draft", {
    cookie: editor,
    method: "PUT",
    json: {
      draft: { ...(current.draft as Record<string, unknown>), ...patch },
      version: current.version,
    },
  })
}

let json: MediaItem
let dotLottie: MediaItem
let png: MediaItem

describe("Lottie uploads", () => {
  it("accepts a Lottie JSON file and serves it hardened", async () => {
    const { status, body } = await upload(LOGO, "logo.json", "application/json")
    expect(status).toBe(201)
    expect(body).toMatchObject({
      mime: "video/lottie+json",
      width: 112,
      height: 68,
      originalName: "logo.json",
      driver: "disk",
    })
    expect(body.url).toMatch(/\.json$/)
    json = body
    const res = await app.request(body.url)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("video/lottie+json")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox"
    )
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/)
    expect(await res.text()).toBe(LOGO)
  })

  it("accepts a dotLottie file", async () => {
    const { status, body } = await upload(buildDotLottie(LOGO), "logo.lottie")
    expect(status).toBe(201)
    expect(body).toMatchObject({
      mime: "application/zip+dotlottie",
      width: 112,
      height: 68,
    })
    expect(body.url).toMatch(/\.lottie$/)
    dotLottie = body
    const res = await app.request(body.url)
    expect(res.headers.get("content-type")).toBe("application/zip+dotlottie")
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox"
    )
  })

  it("refuses JSON that is not a Lottie, a zip bomb and files over 2 MB", async () => {
    const notLottie = await upload('{"hello":"world"}', "data.json")
    expect(notLottie.status).toBe(422)
    expect(fileError(notLottie.body)).toMatch(/not a Lottie animation/)

    const bomb = buildZip([
      {
        name: "manifest.json",
        data: JSON.stringify({ animations: [{ id: "a" }] }),
      },
      { name: "animations/a.json", data: LOGO },
      {
        name: "images/bomb.png",
        data: new Uint8Array(20 * 1024 * 1024),
        declaredSize: 1024,
      },
    ])
    const bombRes = await upload(bomb, "bomb.lottie")
    expect(bombRes.status).toBe(422)
    expect(fileError(bombRes.body)).toMatch(/dotLottie/)

    const big = JSON.stringify({
      ...JSON.parse(LOGO),
      nm: "x".repeat(2 * 1024 * 1024),
    })
    const bigRes = await upload(big, "big.json")
    expect(bigRes.status).toBe(422)
    expect(fileError(bigRes.body)).toMatch(/up to 2 MB/)
  })

  it("lists Lottie files under kind=lottie only: image pickers never see them", async () => {
    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer()
    png = (await upload(image, "plain.png", "image/png")).body
    const ids = (items: MediaItem[]) => items.map((i) => i.id)
    const images = await list("image")
    expect(ids(images)).toContain(png.id)
    expect(ids(images)).not.toContain(json.id)
    expect(ids(images)).not.toContain(dotLottie.id)
    expect(images.every((i) => i.mime.startsWith("image/"))).toBe(true)
    const lotties = await list("lottie")
    expect(ids(lotties).sort()).toEqual([json.id, dotLottie.id].sort())
    const documents = await list("document")
    expect(ids(documents)).not.toContain(json.id)
    expect(ids(documents)).not.toContain(dotLottie.id)
    // Alt text is never "missing" on an animation.
    const missing = await adminRequest("/media?pageSize=100&missingAlt=true", {
      cookie: editor,
    })
    const missingIds = ids(
      ((await missing.json()) as { items: MediaItem[] }).items
    )
    expect(missingIds).not.toContain(json.id)
  })

  it("refuses replacing a Lottie with an image", async () => {
    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#654321" },
    })
      .png()
      .toBuffer()
    const form = new FormData()
    form.append("file", new File([new Uint8Array(image)], "x.png"))
    const res = await app.request(`/api/v1/admin/media/${json.id}/replace`, {
      method: "POST",
      headers: { origin: ORIGIN, cookie: editor },
      body: form,
    })
    expect(res.status).toBe(422)
    expect(fileError((await res.json()) as Uploaded)).toMatch(
      /Replace a Lottie animation/
    )
  })
})

describe("settings.site.logoAnimation", () => {
  it("defaults to null for values saved before the field existed", () => {
    const parsed = siteSettings.parse({
      name: "n",
      legalName: "n",
      logo: { mediaId: png.id },
      logoAlt: "a",
      logoOnDark: null,
      favicon: null,
      productionUrl: null,
      timezone: "Europe/Dublin",
      locale: "en",
      copyright: "c",
    })
    expect(parsed.logoAnimation).toBeNull()
  })

  it("saves a Lottie, loads it back and records its usage", async () => {
    const res = await saveSite({ logoAnimation: { mediaId: json.id } })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as SettingsDto
    expect((dto.draft as { logoAnimation: unknown }).logoAnimation).toEqual({
      mediaId: json.id,
    })
    const loaded = (await (
      await adminRequest("/settings/site", { cookie: editor })
    ).json()) as SettingsDto
    expect((loaded.draft as { logoAnimation: unknown }).logoAnimation).toEqual({
      mediaId: json.id,
    })
    const usages = await listMediaUsagesFor(getDb(), "settings", "site")
    expect(usages).toContainEqual({ mediaId: json.id, field: "logoAnimation" })
    // In use: the file cannot be deleted.
    const del = await adminRequest(`/media/${json.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(del.status).toBe(409)
  })

  it("accepts a dotLottie and clears back to null", async () => {
    expect(
      (await saveSite({ logoAnimation: { mediaId: dotLottie.id } })).status
    ).toBe(200)
    const cleared = await saveSite({ logoAnimation: null })
    expect(cleared.status).toBe(200)
    expect(
      ((await cleared.json()) as { draft: { logoAnimation: unknown } }).draft
        .logoAnimation
    ).toBeNull()
  })

  it("refuses an image in the animation field and a Lottie in an image field", async () => {
    const imageAsAnimation = await saveSite({
      logoAnimation: { mediaId: png.id },
    })
    expect(imageAsAnimation.status).toBe(422)
    const body = (await imageAsAnimation.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(body.error.fieldErrors.logoAnimation?.[0]).toMatch(
      /not a Lottie animation/
    )

    const lottieAsLogo = await saveSite({ favicon: { mediaId: json.id } })
    expect(lottieAsLogo.status).toBe(422)
    const logoBody = (await lottieAsLogo.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(logoBody.error.fieldErrors.favicon?.[0]).toMatch(/not an image/)
  })
})
