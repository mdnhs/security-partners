import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { RedirectDto } from "@/lib/schemas/api/redirects"
import { getDb } from "@/server/db/client"
import { auditLog, redirects } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let marketer: string
let editor: string
let viewer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  marketer = (await signedInUser(["marketer"])).cookie
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
})

const create = (cookie: string, json: unknown) =>
  adminRequest("/redirects", { cookie, method: "POST", json })
const rows = () => getDb().select().from(redirects)
const errorsOf = async (res: Response) =>
  ((await res.json()) as { error: { fieldErrors?: Record<string, string[]> } })
    .error.fieldErrors ?? {}

async function serviceRow(cookie: string, slug: string) {
  const res = await adminRequest(`/services?q=${slug}`, { cookie })
  const { items } = (await res.json()) as {
    items: { id: string; slug: string; version: number }[]
  }
  return items.find((i) => i.slug === slug)!
}

describe("redirects API (master 8.2)", () => {
  it("marketer creates, lists, edits and deletes; every change audited", async () => {
    const created = await create(marketer, {
      fromPath: "/old-alarms",
      toPath: "/services/alarm-responses",
      code: 301,
    })
    expect(created.status).toBe(201)
    const dto = (await created.json()) as RedirectDto
    expect(dto).toMatchObject({ fromPath: "/old-alarms", code: 301, hits: 0 })

    const list = await adminRequest("/redirects?q=alarms", { cookie: viewer })
    expect(list.status).toBe(200)
    expect(((await list.json()) as { total: number }).total).toBe(1)

    const patched = await adminRequest(`/redirects/${dto.id}`, {
      cookie: marketer,
      method: "PATCH",
      json: { code: 302 },
    })
    expect(((await patched.json()) as RedirectDto).code).toBe(302)

    const deleted = await adminRequest(`/redirects/${dto.id}`, {
      cookie: marketer,
      method: "DELETE",
    })
    expect(deleted.status).toBe(200)
    expect(await rows()).toHaveLength(0)
    const actions = (
      await getDb()
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(eq(auditLog.entityType, "redirect"))
    ).map((r) => r.action)
    expect(actions.sort()).toEqual([
      "redirect.created",
      "redirect.deleted",
      "redirect.updated",
    ])
  })

  it("permissions: viewers read, editors have no redirect access", async () => {
    expect((await adminRequest("/redirects", { cookie: editor })).status).toBe(
      403
    )
    expect(
      (await create(viewer, { fromPath: "/x", toPath: "/", code: 301 })).status
    ).toBe(403)
  })

  it("refuses unsafe or reserved paths and live pages (422)", async () => {
    for (const [fromPath, toPath, field] of [
      ["/admin/x", "/", "fromPath"],
      ["/about", "/", "fromPath"],
      ["/services/alarm-responses", "/", "fromPath"],
      ["/old/", "/", "fromPath"],
      ["/old.html", "/", "fromPath"],
      ["/old", "javascript:alert(1)", "toPath"],
      ["/old", "//evil.example", "toPath"],
    ] as const) {
      const res = await create(marketer, { fromPath, toPath, code: 301 })
      expect(res.status, `${fromPath} → ${toPath}`).toBe(422)
      expect(Object.keys(await errorsOf(res))).toContain(field)
    }
  })

  it("a second redirect from the same address → 409", async () => {
    await create(marketer, { fromPath: "/x", toPath: "/", code: 301 })
    const res = await create(marketer, {
      fromPath: "/x",
      toPath: "/blog",
      code: 301,
    })
    expect(res.status).toBe(409)
    expect(Object.keys(await errorsOf(res))).toEqual(["fromPath"])
  })

  it("loops are rejected on create and on edit (422)", async () => {
    await create(marketer, { fromPath: "/a", toPath: "/b", code: 301 })
    const loop = await create(marketer, {
      fromPath: "/b",
      toPath: "/a",
      code: 301,
    })
    expect(loop.status).toBe(422)
    expect((await errorsOf(loop)).toPath?.[0]).toMatch(
      /\/a → \/b → \/a|\/b → \/a → \/b/
    )
    expect(
      (await create(marketer, { fromPath: "/c", toPath: "/c", code: 301 }))
        .status
    ).toBe(422)

    const c = (await (
      await create(marketer, { fromPath: "/c", toPath: "/blog", code: 301 })
    ).json()) as RedirectDto
    await create(marketer, { fromPath: "/d", toPath: "/c", code: 301 })
    const edit = await adminRequest(`/redirects/${c.id}`, {
      cookie: marketer,
      method: "PATCH",
      json: { toPath: "/d" },
    })
    expect(edit.status).toBe(422)
  })

  it("renaming a published service adds a 301 and re-points older redirects", async () => {
    await create(marketer, {
      fromPath: "/old-alarms",
      toPath: "/services/alarm-responses",
      code: 301,
    })
    const s = await serviceRow(editor, "alarm-responses")
    const renamed = await adminRequest(`/services/${s.id}/slug`, {
      cookie: editor,
      method: "PATCH",
      json: { slug: "alarm-response-team", version: s.version },
    })
    expect(renamed.status).toBe(200)
    const map = new Map((await rows()).map((r) => [r.fromPath, r]))
    expect(map.get("/services/alarm-responses")).toMatchObject({
      toPath: "/services/alarm-response-team",
      code: 301,
    })
    expect(map.get("/old-alarms")?.toPath).toBe("/services/alarm-response-team")

    // Renaming back must not leave a loop.
    const again = await serviceRow(editor, "alarm-response-team")
    await adminRequest(`/services/${again.id}/slug`, {
      cookie: editor,
      method: "PATCH",
      json: { slug: "alarm-responses", version: again.version },
    })
    const after = new Map((await rows()).map((r) => [r.fromPath, r.toPath]))
    expect(after.has("/services/alarm-responses")).toBe(false)
    expect(after.get("/services/alarm-response-team")).toBe(
      "/services/alarm-responses"
    )
    expect(after.get("/old-alarms")).toBe("/services/alarm-responses")
  })

  it("deleting a published service redirects its address to /services", async () => {
    const s = await serviceRow(editor, "event-security")
    const res = await adminRequest(`/services/${s.id}?version=${s.version}`, {
      cookie: (await signedInUser(["admin"])).cookie,
      method: "DELETE",
    })
    expect(res.status).toBe(200)
    const [row] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.fromPath, "/services/event-security"))
    expect(row?.toPath).toBe("/services")
  })

  it("renaming an unpublished service adds no redirect", async () => {
    const created = await adminRequest("/services", {
      cookie: editor,
      method: "POST",
      json: {
        slug: "draft-only",
        draft: (
          (await (
            await adminRequest(
              `/services/${(await serviceRow(editor, "alarm-responses")).id}`,
              { cookie: editor }
            )
          ).json()) as { draft: unknown }
        ).draft,
      },
    })
    const dto = (await created.json()) as { id: string; version: number }
    await adminRequest(`/services/${dto.id}/slug`, {
      cookie: editor,
      method: "PATCH",
      json: { slug: "draft-only-2", version: dto.version },
    })
    expect(await rows()).toHaveLength(0)
  })

  it("renaming a published article adds a 301 under /blog", async () => {
    const list = await adminRequest("/articles?q=key-holding", {
      cookie: editor,
    })
    const { items } = (await list.json()) as {
      items: { id: string; slug: string; version: number }[]
    }
    const a = items.find((i) => i.slug === "key-holding-explained")!
    const res = await adminRequest(`/articles/${a.id}/meta`, {
      cookie: editor,
      method: "PATCH",
      json: { version: a.version, slug: "key-holding-guide" },
    })
    expect(res.status).toBe(200)
    const [row] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.fromPath, "/blog/key-holding-explained"))
    expect(row?.toPath).toBe("/blog/key-holding-guide")
  })
})
