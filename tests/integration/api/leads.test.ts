import { and, eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import type {
  LeadAssignee,
  LeadDto,
  LeadListItem,
} from "@/lib/schemas/api/leads"
import type { Paginated } from "@/lib/schemas/api/list"
import { getDb } from "@/server/db/client"
import {
  aiConversations,
  aiMessages,
  auditLog,
  leadEvents,
  leads,
  users,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const DAY = 86_400_000
let intake: { cookie: string; userId: string; name: string }
let admin: { cookie: string; userId: string; name: string }
let editor: string
let viewer: string

type NewLead = Partial<typeof leads.$inferInsert>
async function addLead(over: NewLead = {}) {
  const [row] = await getDb()
    .insert(leads)
    .values({
      name: "Visitor",
      email: "visitor@example.ie",
      message: "Hello",
      consent: true,
      ...over,
    })
    .returning()
  return row
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status)
  return (await res.json()) as T
}

const list = async (cookie: string, query = "") =>
  json<Paginated<LeadListItem>>(
    await adminRequest(`/leads${query}`, { cookie })
  )

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  const i = await signedInUser(["intake"])
  intake = { cookie: i.cookie, userId: i.user.id, name: i.user.name }
  const a = await signedInUser(["admin"])
  admin = { cookie: a.cookie, userId: a.user.id, name: a.user.name }
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
})

describe("GET /leads (inbox list)", () => {
  it("lists newest first, hides spam unless asked, filters by status, assignee and text", async () => {
    const now = Date.now()
    await addLead({ name: "Old", createdAt: new Date(now - 3 * DAY) })
    await addLead({
      name: "Assigned",
      status: "contacted",
      assigneeId: intake.userId,
      createdAt: new Date(now - 2 * DAY),
    })
    await addLead({
      name: "Spammy",
      status: "spam",
      createdAt: new Date(now - DAY),
    })
    await addLead({
      name: "Won deal",
      status: "won",
      company: "Acme Ltd",
      createdAt: new Date(now),
    })

    const all = await list(intake.cookie)
    expect(all.items.map((l) => l.name)).toEqual([
      "Won deal",
      "Assigned",
      "Old",
    ])
    expect(all.total).toBe(3)
    expect(all.items[1].assignee).toEqual({
      id: intake.userId,
      name: intake.name,
    })

    expect(
      (await list(intake.cookie, "?status=spam")).items.map((l) => l.name)
    ).toEqual(["Spammy"])
    expect((await list(intake.cookie, "?status=all")).total).toBe(4)
    expect(
      (await list(intake.cookie, "?status=open")).items.map((l) => l.name)
    ).toEqual(["Assigned", "Old"])
    expect(
      (await list(intake.cookie, "?assignee=me")).items.map((l) => l.name)
    ).toEqual(["Assigned"])
    expect(
      (await list(intake.cookie, "?assignee=none")).items.map((l) => l.name)
    ).toEqual(["Won deal", "Old"])
    expect(
      (await list(intake.cookie, "?q=acme")).items.map((l) => l.name)
    ).toEqual(["Won deal"])
    expect(
      (await list(intake.cookie, "?sort=name:asc")).items.map((l) => l.name)
    ).toEqual(["Assigned", "Old", "Won deal"])
    const paged = await list(intake.cookie, "?page=2&pageSize=2")
    expect(paged).toMatchObject({ page: 2, pageSize: 2, total: 3 })
    expect(paged.items.map((l) => l.name)).toEqual(["Old"])
  })

  it("is for lead readers only; intake reaches nothing else", async () => {
    expect((await adminRequest("/leads", { cookie: editor })).status).toBe(403)
    expect((await adminRequest("/leads", { cookie: viewer })).status).toBe(403)
    expect((await adminRequest("/leads")).status).toBe(401)
    for (const path of ["/pages", "/services", "/settings", "/users", "/audit"])
      expect((await adminRequest(path, { cookie: intake.cookie })).status).toBe(
        403
      )
  })
})

describe("GET /leads/:id", () => {
  it("returns the full lead with its timeline", async () => {
    const lead = await addLead({ phone: "085", sourcePage: "/contact" })
    await getDb()
      .insert(leadEvents)
      .values([
        {
          leadId: lead.id,
          type: "created",
          body: "Sent from /contact",
          actorId: null,
          createdAt: new Date(Date.now() - 1000),
        },
        {
          leadId: lead.id,
          type: "note",
          body: "Called back",
          actorId: admin.userId,
        },
      ])
    const dto = await json<LeadDto>(
      await adminRequest(`/leads/${lead.id}`, { cookie: intake.cookie })
    )
    expect(dto).toMatchObject({
      id: lead.id,
      message: "Hello",
      consent: true,
      phone: "085",
      sourcePage: "/contact",
      status: "new",
    })
    expect(
      dto.events.map((e) => [e.type, e.body, e.actor?.name ?? null])
    ).toEqual([
      ["created", "Sent from /contact", null],
      ["note", "Called back", admin.name],
    ])
  })

  it("404 for an unknown id, 422 for a malformed one", async () => {
    expect(
      (
        await adminRequest("/leads/0190a6e0-0000-7000-8000-000000000999", {
          cookie: intake.cookie,
        })
      ).status
    ).toBe(404)
    expect(
      (await adminRequest("/leads/not-a-uuid", { cookie: intake.cookie }))
        .status
    ).toBe(422)
  })
})

describe("PATCH /leads/:id (status workflow + assignee)", () => {
  it("moves the status, assigns, records events and audits", async () => {
    const lead = await addLead()
    const dto = await json<LeadDto>(
      await adminRequest(`/leads/${lead.id}`, {
        cookie: intake.cookie,
        method: "PATCH",
        json: { status: "contacted", assigneeId: admin.userId },
      })
    )
    expect(dto.status).toBe("contacted")
    expect(dto.assignee).toEqual({ id: admin.userId, name: admin.name })
    expect(dto.events.map((e) => [e.type, e.body, e.actor?.id])).toEqual([
      ["status", "New → Contacted", intake.userId],
      ["assigned", `Assigned to ${admin.name}`, intake.userId],
    ])
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.action, "lead.updated"), eq(auditLog.entityId, lead.id))
      )
    expect(audit.diff).toEqual({
      status: { from: "new", to: "contacted" },
      assigneeId: { from: null, to: admin.userId },
    })

    const cleared = await json<LeadDto>(
      await adminRequest(`/leads/${lead.id}`, {
        cookie: intake.cookie,
        method: "PATCH",
        json: { assigneeId: null, status: "contacted" },
      })
    )
    expect(cleared.assignee).toBeNull()
    expect(cleared.events.at(-1)?.body).toBe("Unassigned")
    expect(cleared.events.filter((e) => e.type === "status")).toHaveLength(1)
  })

  it("rejects assignees who cannot work on leads (editor, banned) and empty changes", async () => {
    const lead = await addLead()
    const editorUser = await signedInUser(["editor"])
    const patch = (json: unknown) =>
      adminRequest(`/leads/${lead.id}`, {
        cookie: admin.cookie,
        method: "PATCH",
        json,
      })
    const bad = await patch({ assigneeId: editorUser.user.id })
    expect(bad.status).toBe(422)
    expect(
      Object.keys(
        ((await bad.json()) as { error: { fieldErrors: object } }).error
          .fieldErrors
      )
    ).toEqual(["assigneeId"])
    const bannedIntake = await signedInUser(["intake"])
    await getDb()
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, bannedIntake.user.id))
    expect((await patch({ assigneeId: bannedIntake.user.id })).status).toBe(422)
    expect((await patch({})).status).toBe(422)
    expect((await patch({ status: "maybe" })).status).toBe(422)
    expect(
      (
        await adminRequest(`/leads/${lead.id}`, {
          cookie: viewer,
          method: "PATCH",
          json: { status: "won" },
        })
      ).status
    ).toBe(403)
  })
})

describe("POST /leads/:id/events (notes)", () => {
  it("adds a note to the timeline", async () => {
    const lead = await addLead()
    const dto = await json<LeadDto>(
      await adminRequest(`/leads/${lead.id}/events`, {
        cookie: intake.cookie,
        method: "POST",
        json: { body: "  Left a voicemail  " },
      }),
      201
    )
    expect(dto.events.at(-1)).toMatchObject({
      type: "note",
      body: "Left a voicemail",
      actor: { id: intake.userId, name: intake.name },
    })
    expect(
      (
        await adminRequest(`/leads/${lead.id}/events`, {
          cookie: intake.cookie,
          method: "POST",
          json: { body: " " },
        })
      ).status
    ).toBe(422)
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "lead.note_added"))
    expect(audit.entityId).toBe(lead.id)
  })
})

describe("DELETE /leads/:id (GDPR erasure)", () => {
  it("is owner/admin only, removes the lead and its events, audits without personal data", async () => {
    const lead = await addLead({ email: "erase-me@example.ie" })
    await getDb()
      .insert(leadEvents)
      .values({ leadId: lead.id, type: "note", body: "x", actorId: null })
    expect(
      (
        await adminRequest(`/leads/${lead.id}`, {
          cookie: intake.cookie,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
    expect(
      await json(
        await adminRequest(`/leads/${lead.id}`, {
          cookie: admin.cookie,
          method: "DELETE",
        })
      )
    ).toEqual({ ok: true })
    expect(await getDb().select().from(leads)).toHaveLength(0)
    expect(await getDb().select().from(leadEvents)).toHaveLength(0)
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "lead.deleted"))
    expect(audit.entityId).toBe(lead.id)
    expect(JSON.stringify(audit.diff ?? null)).not.toContain("erase-me")
    expect(
      (
        await adminRequest(`/leads/${lead.id}`, {
          cookie: admin.cookie,
          method: "DELETE",
        })
      ).status
    ).toBe(404)
  })

  it("also erases the AI conversations opened on that lead, with their messages (final review I3)", async () => {
    const lead = await addLead({ name: "Erase Me" })
    const other = await addLead({ name: "Keep Me" })
    const conversation = (entityId: string | null) =>
      getDb()
        .insert(aiConversations)
        .values({
          userId: admin.userId,
          title: "Summary",
          context:
            entityId === null
              ? { screen: "Dashboard", entityType: null, entityId: null }
              : { screen: "Lead details", entityType: "lead", entityId },
        })
        .returning()
        .then(([row]) => row)
    const erased = await conversation(lead.id)
    const kept = await conversation(other.id)
    const unrelated = await conversation(null)
    await getDb().insert(aiMessages).values([
      { conversationId: erased.id, role: "user", content: "Summarise" },
      {
        conversationId: erased.id,
        role: "assistant",
        content: "Erase Me wants guarding",
      },
      { conversationId: kept.id, role: "user", content: "Summarise" },
    ])
    expect(
      (
        await adminRequest(`/leads/${lead.id}`, {
          cookie: admin.cookie,
          method: "DELETE",
        })
      ).status
    ).toBe(200)
    expect(
      (await getDb().select().from(aiConversations)).map((c) => c.id).sort()
    ).toEqual([kept.id, unrelated.id].sort())
    expect(
      (await getDb().select().from(aiMessages)).map((m) => m.conversationId)
    ).toEqual([kept.id])
  })
})

describe("GET /leads/export.csv", () => {
  it("exports RFC 4180 CSV with a formula guard, notes and an audit row", async () => {
    const lead = await addLead({
      name: '=HYPERLINK("http://evil","x")',
      email: "a@example.ie",
      phone: "+353 85 000 0000",
      message: 'He said "hi",\nthen left',
      createdAt: new Date("2026-10-01T09:00:00Z"),
    })
    await getDb()
      .insert(leadEvents)
      .values({
        leadId: lead.id,
        type: "note",
        body: "Rang back",
        actorId: admin.userId,
        createdAt: new Date("2026-10-02T10:00:00Z"),
      })
    const res = await adminRequest("/leads/export.csv", {
      cookie: intake.cookie,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"$/
    )
    // Response.text() strips a leading BOM, so decode the raw bytes.
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)
    expect(text.startsWith("\uFEFF")).toBe(true)
    const lines = text.slice(1).split("\r\n")
    expect(lines[0]).toBe(
      "Received (UTC),Status,Name,Email,Phone,Company,Service,Message,Consent,Source page,Assignee,Notes,Lead ID"
    )
    expect(lines[1]).toBe(
      `2026-10-01T09:00:00.000Z,New,"'=HYPERLINK(""http://evil"",""x"")",a@example.ie,'+353 85 000 0000,,,"He said ""hi"",\nthen left",yes,,,2026-10-02T10:00:00.000Z ${admin.name}: Rang back,${lead.id}`
    )
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "lead.exported"))
    expect(audit.diff).toEqual({ count: 1, filters: [] })
  })

  it("subject-access export by email includes spam and nothing else", async () => {
    await addLead({ email: "Subject@Example.ie", status: "spam" })
    await addLead({ email: "subject@example.ie" })
    await addLead({ email: "other@example.ie" })
    const res = await adminRequest(
      `/leads/export.csv?email=${encodeURIComponent("subject@example.ie")}`,
      { cookie: admin.cookie }
    )
    const rows = (await res.text()).trim().split("\r\n").slice(1)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => /subject@example\.ie/i.test(r))).toBe(true)
  })

  it("needs lead:export", async () => {
    expect(
      (await adminRequest("/leads/export.csv", { cookie: editor })).status
    ).toBe(403)
    expect(
      (await adminRequest("/leads/export.csv", { cookie: viewer })).status
    ).toBe(403)
  })
})

describe("assignees and badge", () => {
  it("assignees = active users who can work on leads, by name", async () => {
    const banned = await signedInUser(["intake"])
    await getDb()
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, banned.user.id))
    const { items } = await json<{ items: LeadAssignee[] }>(
      await adminRequest("/leads/assignees", { cookie: intake.cookie })
    )
    const ids = items.map((u) => u.id)
    expect(ids).toContain(intake.userId)
    expect(ids).toContain(admin.userId)
    expect(ids).not.toContain(banned.user.id)
    expect(items.map((u) => u.name)).toEqual(
      [...items.map((u) => u.name)].sort((a, b) => a.localeCompare(b))
    )
    expect(
      (await adminRequest("/leads/assignees", { cookie: editor })).status
    ).toBe(403)
  })

  it("badge counts unassigned new leads", async () => {
    await addLead()
    await addLead()
    await addLead({ assigneeId: intake.userId })
    await addLead({ status: "contacted" })
    expect(
      await json(await adminRequest("/leads/badge", { cookie: intake.cookie }))
    ).toEqual({ newLeads: 2 })
    expect(
      (await adminRequest("/leads/badge", { cookie: viewer })).status
    ).toBe(403)
  })
})

describe("hardening (named risks)", () => {
  it("search terms are literal (LIKE wildcards escaped); sort and filters are allow-listed", async () => {
    await addLead({ name: "Percy", company: "100% Secure" })
    await addLead({ name: "Underscore", company: "a_b" })
    await addLead({ name: "Plain", company: "abc" })
    expect(
      (await list(intake.cookie, "?q=%25")).items.map((l) => l.name)
    ).toEqual(["Percy"])
    expect(
      (await list(intake.cookie, "?q=_")).items.map((l) => l.name)
    ).toEqual(["Underscore"])
    for (const query of [
      "?sort=ipHash:asc",
      "?sort=name;drop:asc",
      "?status=deleted",
      "?assignee=someone",
      "?from=yesterday",
      "?pageSize=101",
      "?q=%00",
    ])
      expect(
        (await adminRequest(`/leads${query}`, { cookie: intake.cookie })).status
      ).toBe(422)
  })

  it("never returns ip_hash in list, detail or export", async () => {
    const lead = await addLead({ ipHash: "deadbeefcafe" })
    const listed = await adminRequest("/leads", { cookie: admin.cookie })
    const detail = await adminRequest(`/leads/${lead.id}`, {
      cookie: admin.cookie,
    })
    const csv = await adminRequest("/leads/export.csv", {
      cookie: admin.cookie,
    })
    for (const res of [listed, detail, csv]) {
      const text = await res.text()
      expect(text).not.toContain("deadbeefcafe")
      expect(text).not.toMatch(/ipHash|ip_hash/)
    }
  })

  it("caps notes at 5,000 characters and stores them as plain text", async () => {
    const lead = await addLead()
    const tooLong = await adminRequest(`/leads/${lead.id}/events`, {
      cookie: intake.cookie,
      method: "POST",
      json: { body: "x".repeat(5001) },
    })
    expect(tooLong.status).toBe(422)
    const nul = await adminRequest(`/leads/${lead.id}/events`, {
      cookie: intake.cookie,
      method: "POST",
      json: { body: "a\u0000b" },
    })
    expect(nul.status).toBe(422)
    const html = "<img src=x onerror=alert(1)>"
    const dto = await json<LeadDto>(
      await adminRequest(`/leads/${lead.id}/events`, {
        cookie: intake.cookie,
        method: "POST",
        json: { body: html },
      }),
      201
    )
    expect(dto.events.at(-1)?.body).toBe(html)
    const missing = await adminRequest(
      "/leads/0190a6e0-0000-7000-8000-000000000999/events",
      {
        cookie: intake.cookie,
        method: "POST",
        json: { body: "hi" },
      }
    )
    expect(missing.status).toBe(404)
  })

  it("an unchanged PATCH writes no event and no audit; audit diffs carry no personal data", async () => {
    const lead = await addLead({
      email: "private@example.ie",
      message: "secret text",
      phone: "0851234567",
    })
    await adminRequest(`/leads/${lead.id}`, {
      cookie: admin.cookie,
      method: "PATCH",
      json: { status: "new", assigneeId: null },
    })
    expect(await getDb().select().from(leadEvents)).toHaveLength(0)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "lead.updated"))
    ).toHaveLength(0)
    await adminRequest(`/leads/${lead.id}`, {
      cookie: admin.cookie,
      method: "PATCH",
      json: { status: "won" },
    })
    await adminRequest(`/leads/${lead.id}/events`, {
      cookie: admin.cookie,
      method: "POST",
      json: { body: "note about private@example.ie" },
    })
    await adminRequest(
      `/leads/export.csv?email=${encodeURIComponent("private@example.ie")}&q=secret`,
      { cookie: admin.cookie }
    )
    const rows = await getDb().select().from(auditLog)
    const leadRows = rows.filter((r) => r.action.startsWith("lead."))
    expect(leadRows.map((r) => r.action).sort()).toEqual([
      "lead.exported",
      "lead.note_added",
      "lead.updated",
    ])
    const serialised = JSON.stringify(leadRows.map((r) => r.diff))
    for (const secret of [
      "private@example.ie",
      "secret",
      "0851234567",
      "note about",
    ])
      expect(serialised).not.toContain(secret)
    expect(leadRows.find((r) => r.action === "lead.exported")?.diff).toEqual({
      count: 0,
      filters: ["q", "email"],
    })
  })

  it("PATCH on an unknown lead is 404; intake and editor cannot delete", async () => {
    expect(
      (
        await adminRequest("/leads/0190a6e0-0000-7000-8000-000000000999", {
          cookie: admin.cookie,
          method: "PATCH",
          json: { status: "won" },
        })
      ).status
    ).toBe(404)
    const lead = await addLead()
    expect(
      (
        await adminRequest(`/leads/${lead.id}`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
    expect(await getDb().select().from(leads)).toHaveLength(1)
  })

  it("concurrent identical PATCHes record one change (row lock)", async () => {
    const lead = await addLead()
    const { updateLead } = await import("@/server/modules/leads/service")
    const actor = {
      userId: admin.userId,
      roles: ["admin" as const],
      ip: null,
      userAgent: null,
      impersonatorId: null,
    }
    // Warm the pool so the transactions really overlap.
    await Promise.all(
      Array.from({ length: 8 }, () =>
        getDb().execute(sql`select pg_sleep(0.05)`)
      )
    )
    await Promise.all(
      Array.from({ length: 8 }, () =>
        updateLead(actor, lead.id, { status: "contacted" })
      )
    )
    expect(await getDb().select().from(leadEvents)).toHaveLength(1)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "lead.updated"))
    ).toHaveLength(1)
  })

  it("rejects cross-origin mutations", async () => {
    const lead = await addLead()
    const { app } = await import("@/server/api/app")
    const res = await app.request(`/api/v1/admin/leads/${lead.id}`, {
      method: "DELETE",
      headers: { origin: "https://evil.example", cookie: admin.cookie },
    })
    expect(res.status).toBe(403)
    expect(await getDb().select().from(leads)).toHaveLength(1)
  })
})

describe("follow-up hardening", () => {
  const adminActor = () => ({
    userId: admin.userId,
    roles: ["admin" as const],
    ip: null,
    userAgent: null,
    impersonatorId: null,
  })

  it("refuses to export more than the limit instead of truncating", async () => {
    const { exportLeads } = await import("@/server/modules/leads/service")
    for (let i = 0; i < 3; i++) await addLead({ name: `Lead ${i}` })
    await expect(
      exportLeads(adminActor(), {}, new Date(), { limit: 2 })
    ).rejects.toMatchObject({
      status: 422,
      message: "More than 2 enquiries match. Narrow the filters to export.",
    })
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "lead.exported"))
    ).toHaveLength(0)
    expect(
      (await exportLeads(adminActor(), {}, new Date(), { limit: 3 })).count
    ).toBe(3)
  })

  it("uses the 50,000 wording for the default limit", async () => {
    const { LEAD_EXPORT_LIMIT } = await import("@/lib/schemas/api/leads")
    expect(LEAD_EXPORT_LIMIT.toLocaleString("en-IE")).toBe("50,000")
  })

  it("caps the Notes cell at the newest 20 notes", async () => {
    const lead = await addLead()
    const base = Date.parse("2026-10-01T00:00:00Z")
    await getDb()
      .insert(leadEvents)
      .values(
        Array.from({ length: 25 }, (_, i) => ({
          leadId: lead.id,
          type: "note" as const,
          body: `note-${String(i).padStart(2, "0")}`,
          actorId: null,
          createdAt: new Date(base + i * 60_000),
        }))
      )
    const csv = await (
      await adminRequest("/leads/export.csv", { cookie: admin.cookie })
    ).text()
    const kept = csv.match(/note-\d\d/g) ?? []
    expect(kept).toHaveLength(20)
    expect(kept[0]).toBe("note-05")
    expect(kept.at(-1)).toBe("note-24")
    expect(csv).toContain("note-24\n… (5 more notes not exported)")
  })

  it("caps the Notes cell at 20,000 characters, dropping the oldest", async () => {
    const lead = await addLead()
    const base = Date.parse("2026-10-01T00:00:00Z")
    await getDb()
      .insert(leadEvents)
      .values(
        Array.from({ length: 6 }, (_, i) => ({
          leadId: lead.id,
          type: "note" as const,
          body: `N${i}:` + "x".repeat(4500),
          actorId: null,
          createdAt: new Date(base + i * 60_000),
        }))
      )
    const csv = await (
      await adminRequest("/leads/export.csv", { cookie: admin.cookie })
    ).text()
    const kept = csv.match(/N\d:/g) ?? []
    expect(kept).toEqual(["N2:", "N3:", "N4:", "N5:"])
    expect(csv).toContain("… (2 more notes not exported)")
  })

  it("rejects bidi override/isolate characters in notes but keeps newlines", async () => {
    const lead = await addLead()
    const post = (body: string) =>
      adminRequest(`/leads/${lead.id}/events`, {
        cookie: intake.cookie,
        method: "POST",
        json: { body },
      })
    for (const ch of ["\u202A", "\u202E", "\u2066", "\u2069"])
      expect((await post(`invoice${ch}fdp.exe`)).status).toBe(422)
    const ok = await json<LeadDto>(await post("line one\nline two"), 201)
    expect(ok.events.at(-1)?.body).toBe("line one\nline two")
  })

  it("role coverage: owner may delete; marketer and author cannot read or export", async () => {
    const owner = (await signedInUser(["owner"])).cookie
    const marketer = (await signedInUser(["marketer"])).cookie
    const author = (await signedInUser(["author"])).cookie
    const lead = await addLead()
    expect((await adminRequest("/leads", { cookie: marketer })).status).toBe(
      403
    )
    expect(
      (await adminRequest("/leads/export.csv", { cookie: marketer })).status
    ).toBe(403)
    expect((await adminRequest("/leads", { cookie: author })).status).toBe(403)
    expect(
      await json(
        await adminRequest(`/leads/${lead.id}`, {
          cookie: owner,
          method: "DELETE",
        })
      )
    ).toEqual({ ok: true })
    expect(await getDb().select().from(leads)).toHaveLength(0)
  })
})
