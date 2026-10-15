import { sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { writeAudit } from "@/server/lib/audit"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type Item = {
  action: string
  entityType: string | null
  entityId: string | null
  actor: { id: string; email: string | null } | null
  createdAt: string
}

const list = async (cookie: string, query = "") => {
  const res = await adminRequest(`/audit${query}`, { cookie })
  return { res, body: res.status === 200 ? await res.json() : null }
}

beforeEach(async () => {
  await resetDb()
})

/** Seeds 25 rows across two actors, three actions and known timestamps. */
async function seed() {
  const admin = await signedInUser(["admin"])
  const editor = await signedInUser(["editor"])
  // drop the sign-in rows so counts below are exact
  await resetAuditOnly()
  const db = getDb()
  const actorOf = (u: { id: string }) => ({
    userId: u.id,
    roles: [],
    ip: "192.0.2.1",
    userAgent: "seed",
    impersonatorId: null,
  })
  for (let i = 0; i < 25; i++) {
    const who = i % 5 === 0 ? editor.user : admin.user
    await writeAudit(db, actorOf(who), {
      action: i % 2 === 0 ? "page.publish" : "user.ban",
      entityType: i % 2 === 0 ? "page" : "user",
      entityId: i % 2 === 0 ? `page-${i}` : who.id,
      diff: { i },
    })
  }
  return { admin, editor }
}

async function resetAuditOnly() {
  await getDb().execute(sql`truncate table audit_log`)
}

describe("GET /api/v1/admin/audit", () => {
  it("requires audit:read (editor → 403, viewer → 403, no session → 401)", async () => {
    const editor = await signedInUser(["editor"])
    const viewer = await signedInUser(["viewer"])
    expect((await list(editor.cookie)).res.status).toBe(403)
    expect((await list(viewer.cookie)).res.status).toBe(403)
    expect((await adminRequest("/audit")).status).toBe(401)
  })

  it("paginates newest first with the list envelope", async () => {
    const { admin } = await seed()
    const first = await list(admin.cookie, "?pageSize=10")
    expect(first.res.status).toBe(200)
    expect(first.body).toMatchObject({ page: 1, pageSize: 10, total: 25 })
    expect(first.body.items).toHaveLength(10)
    expect(first.body.items[0].diff).toEqual({ i: 24 })
    const third = await list(admin.cookie, "?pageSize=10&page=3")
    expect(third.body.items).toHaveLength(5)
    expect(third.body.items.at(-1).diff).toEqual({ i: 0 })
    const items = first.body.items as Item[]
    const times = items.map((i) => Date.parse(i.createdAt))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it("defaults to pageSize 20 and rejects pageSize > 100", async () => {
    const { admin } = await seed()
    const page = await list(admin.cookie)
    expect(page.body.pageSize).toBe(20)
    expect(page.body.items).toHaveLength(20)
    const tooBig = await list(admin.cookie, "?pageSize=101")
    expect(tooBig.res.status).toBe(422)
  })

  it("filters by actor, action and entityType", async () => {
    const { admin, editor } = await seed()
    const byEditor = await list(admin.cookie, `?actor=${editor.user.id}`)
    expect(byEditor.body.total).toBe(5)
    for (const item of byEditor.body.items as Item[])
      expect(item.actor?.id).toBe(editor.user.id)
    expect((byEditor.body.items as Item[])[0].actor?.email).toBe(
      editor.user.email
    )

    const bans = await list(admin.cookie, "?action=user.ban")
    expect(bans.body.total).toBe(12)
    const pages = await list(admin.cookie, "?entityType=page")
    expect(pages.body.total).toBe(13)
    const both = await list(
      admin.cookie,
      `?entityType=page&actor=${editor.user.id}`
    )
    expect(both.body.total).toBe(3) // i = 0, 10, 20
  })

  it("filters by from/to (inclusive) and searches with q", async () => {
    const { admin } = await seed()
    const all = (await list(admin.cookie, "?pageSize=100&sort=createdAt:asc"))
      .body.items as Item[]
    // API dates have millisecond precision, Postgres stores microseconds:
    // widen `to` by 1 ms so row 9 itself is inside the window.
    const from = all[5].createdAt
    const to = new Date(Date.parse(all[9].createdAt) + 1).toISOString()
    const window = await list(
      admin.cookie,
      `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=100`
    )
    expect(window.body.total).toBeGreaterThanOrEqual(5)
    for (const item of window.body.items as Item[]) {
      expect(Date.parse(item.createdAt)).toBeGreaterThanOrEqual(
        Date.parse(from)
      )
      expect(Date.parse(item.createdAt)).toBeLessThanOrEqual(Date.parse(to))
    }
    const search = await list(admin.cookie, "?q=page-1")
    // page-10, page-12, page-14, page-16, page-18 (odd i are user.ban rows)
    expect(search.body.total).toBe(5)
  })

  it("sorts by action and rejects unknown sort fields or bad dates", async () => {
    const { admin } = await seed()
    const sorted = await list(admin.cookie, "?sort=action:asc&pageSize=100")
    const actions = (sorted.body.items as Item[]).map((i) => i.action)
    expect(actions).toEqual([...actions].sort())
    expect((await list(admin.cookie, "?sort=ip:asc")).res.status).toBe(422)
    expect((await list(admin.cookie, "?from=yesterday")).res.status).toBe(422)
    expect((await list(admin.cookie, "?actor=not-a-uuid")).res.status).toBe(422)
  })
})
