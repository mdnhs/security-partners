import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { REDIRECT_SOURCES, type RedirectDto } from "@/lib/schemas/api/redirects"
import { getDb } from "@/server/db/client"
import { redirects, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { resolvePublicPath } from "@/server/modules/redirects/resolve"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let marketer: string
let editor: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  marketer = (await signedInUser(["marketer"])).cookie
  editor = (await signedInUser(["editor"])).cookie
})

const live = { draft: false }

const create = async (json: Record<string, unknown>) => {
  const res = await adminRequest("/redirects", {
    cookie: marketer,
    method: "POST",
    json: { code: 301, ...json },
  })
  expect(res.status, JSON.stringify(json)).toBe(201)
  return (await res.json()) as RedirectDto
}
const patch = (id: string, json: unknown, cookie = marketer) =>
  adminRequest(`/redirects/${id}`, { cookie, method: "PATCH", json })
const listed = async (q: string) => {
  const res = await adminRequest(`/redirects?q=${encodeURIComponent(q)}`, {
    cookie: marketer,
  })
  return ((await res.json()) as { items: RedirectDto[] }).items
}

describe("redirects admin (D1.7)", () => {
  it("a new redirect is manual, on, never hit, with its note", async () => {
    const dto = await create({
      fromPath: "/old-alarms",
      toPath: "/services/alarm-responses",
      note: "Old brochure link",
    })
    expect(dto).toMatchObject({
      isActive: true,
      note: "Old brochure link",
      source: "manual",
      lastHitAt: null,
      hits: 0,
    })
    const plain = await create({ fromPath: "/plain", toPath: "/" })
    expect(plain.note).toBe("")
  })

  it("an inactive redirect does not resolve", async () => {
    const dto = await create({ fromPath: "/gone", toPath: "/services" })
    const off = await patch(dto.id, { isActive: false })
    expect(off.status).toBe(200)
    expect(((await off.json()) as RedirectDto).isActive).toBe(false)
    expect(await resolvePublicPath("/gone", live)).toEqual({ kind: "pass" })
    // A missing detail page with only an inactive redirect is a real 404.
    await getDb().insert(redirects).values({
      fromPath: "/blog/nothing-here",
      toPath: "/blog",
      isActive: false,
    })
    expect(await resolvePublicPath("/blog/nothing-here", live)).toEqual({
      kind: "missing",
    })
    // Turning it back on resolves again.
    expect((await patch(dto.id, { isActive: true })).status).toBe(200)
    expect(await resolvePublicPath("/gone", live)).toMatchObject({
      kind: "redirect",
      to: "/services",
    })
  })

  it("a hit sets lastHitAt (and leaves updatedAt alone)", async () => {
    const dto = await create({ fromPath: "/hit-me", toPath: "/" })
    const before = Date.now()
    const outcome = await resolvePublicPath("/hit-me", live)
    if (outcome.kind !== "redirect") throw new Error("expected a redirect")
    await outcome.recordHit()
    const [row] = await listed("/hit-me")
    expect(row.hits).toBe(1)
    expect(row.lastHitAt).not.toBeNull()
    expect(new Date(row.lastHitAt!).getTime()).toBeGreaterThanOrEqual(
      before - 1000
    )
    expect(row.updatedAt).toBe(dto.updatedAt)
  })

  it("307 and 308 are stored and resolve with their own code", async () => {
    for (const code of [307, 308] as const) {
      const dto = await create({ fromPath: `/keep-${code}`, toPath: "/", code })
      expect(dto.code).toBe(code)
      expect(await resolvePublicPath(`/keep-${code}`, live)).toMatchObject({
        kind: "redirect",
        code,
      })
    }
    const switched = await patch((await listed("/keep-307"))[0].id, {
      code: 308,
    })
    expect(((await switched.json()) as RedirectDto).code).toBe(308)
  })

  it("rejects other codes, long notes and unknown sources (422)", async () => {
    for (const json of [
      { fromPath: "/x", toPath: "/", code: 303 },
      { fromPath: "/x", toPath: "/", code: 301, note: "n".repeat(201) },
      { fromPath: "/x", toPath: "/", code: 301, isActive: "yes" },
    ]) {
      const res = await adminRequest("/redirects", {
        cookie: marketer,
        method: "POST",
        json,
      })
      expect(res.status, JSON.stringify(json)).toBe(422)
    }
    // source is server-owned: a client cannot claim "auto", even alongside
    // a valid change (unknown keys are refused, not stripped).
    const dto = await create({ fromPath: "/claims-auto", toPath: "/" })
    const res = await patch(dto.id, { source: "auto", note: "x" })
    expect(res.status).toBe(422)
    const post = await adminRequest("/redirects", {
      cookie: marketer,
      method: "POST",
      json: {
        fromPath: "/claims-auto-2",
        toPath: "/",
        code: 301,
        source: "auto",
      },
    })
    expect(post.status).toBe(422)
    const [unchanged] = await listed("/claims-auto")
    expect(unchanged).toMatchObject({ source: "manual", note: "" })
    // Every listed source is allowed by the DB check (one list, REDIRECT_SOURCES).
    for (const source of REDIRECT_SOURCES)
      await getDb()
        .insert(redirects)
        .values({ fromPath: `/src-${source}`, toPath: "/", source })
    // The database refuses codes and sources outside the lists too.
    await expect(
      getDb()
        .insert(redirects)
        .values({ fromPath: "/db", toPath: "/", code: 303 })
    ).rejects.toThrow()
    await expect(
      getDb()
        .insert(redirects)
        // @ts-expect-error -- outside the column type on purpose
        .values({ fromPath: "/db", toPath: "/", source: "other" })
    ).rejects.toThrow()
  })

  it("turning on when `from` is now a published service gives 422; the page wins meanwhile", async () => {
    const dto = await create({
      fromPath: "/services/coming-soon",
      toPath: "/services",
    })
    expect((await patch(dto.id, { isActive: false })).status).toBe(200)
    // The address later becomes a live page.
    await getDb()
      .update(services)
      .set({ slug: "coming-soon" })
      .where(eq(services.slug, "event-security"))
    expect(await resolvePublicPath("/services/coming-soon", live)).toEqual({
      kind: "pass",
    })
    const [row] = await listed("coming-soon")
    expect(row.isActive).toBe(false)

    const res = await patch(dto.id, { isActive: true })
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { message: string; fieldErrors?: Record<string, string[]> }
    }
    expect(body.error.message).toBe("That address is a live page now")
    expect(body.error.fieldErrors?.isActive).toEqual([
      "That address is a live page now",
    ])
    const [still] = await listed("coming-soon")
    expect(still.isActive).toBe(false)
    // Editing the note of the Off redirect is still allowed.
    expect((await patch(dto.id, { note: "Keep for later" })).status).toBe(200)
  })

  it("a rename creates an automatic redirect (source auto)", async () => {
    const list = await adminRequest("/services?q=alarm-responses", {
      cookie: editor,
    })
    const s = (
      (await list.json()) as {
        items: { id: string; slug: string; version: number }[]
      }
    ).items.find((i) => i.slug === "alarm-responses")!
    // An inactive leftover at the old address is taken over and turned on.
    await getDb().insert(redirects).values({
      fromPath: "/services/alarm-responses",
      toPath: "/elsewhere",
      isActive: false,
      note: "kept",
    })
    const res = await adminRequest(`/services/${s.id}/slug`, {
      cookie: editor,
      method: "PATCH",
      json: { slug: "alarm-team", version: s.version },
    })
    expect(res.status).toBe(200)
    const [row] = await listed("/services/alarm-responses")
    expect(row).toMatchObject({
      fromPath: "/services/alarm-responses",
      toPath: "/services/alarm-team",
      code: 301,
      source: "auto",
      isActive: true,
      note: "kept",
    })
  })

  it("a marketer can toggle; an editor gets 403", async () => {
    const dto = await create({ fromPath: "/toggle", toPath: "/" })
    expect((await patch(dto.id, { isActive: false }, editor)).status).toBe(403)
    const off = await patch(dto.id, { isActive: false })
    expect(off.status).toBe(200)
    const on = await patch(dto.id, { isActive: true })
    expect(on.status).toBe(200)
    expect(((await on.json()) as RedirectDto).isActive).toBe(true)
  })

  it("turning on/off keeps updatedAt, so the row keeps its place in the list", async () => {
    const dto = await create({ fromPath: "/stays-put", toPath: "/" })
    const off = (await (
      await patch(dto.id, { isActive: false })
    ).json()) as RedirectDto
    expect(off.isActive).toBe(false)
    expect(off.updatedAt).toBe(dto.updatedAt)
    // Any other change still counts as an edit.
    const edited = (await (
      await patch(dto.id, { isActive: true, note: "edited" })
    ).json()) as RedirectDto
    expect(edited.updatedAt).not.toBe(dto.updatedAt)
  })
})
