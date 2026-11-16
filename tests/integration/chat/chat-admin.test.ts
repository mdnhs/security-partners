import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Port of JW tests/integration/api/chat-admin.test.ts (live chat plan, Task 6).

const mocks = vi.hoisted(() => ({
  maybeReply: vi.fn(async () => {}),
  active: true,
  tasks: [] as Promise<unknown>[],
}))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    mocks.tasks.push(Promise.resolve().then(task))
  },
}))
vi.mock("@/server/modules/chat/bot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/modules/chat/bot")>()),
  maybeReply: mocks.maybeReply,
  isActive: async () => mocks.active,
}))

import type { Role } from "@/lib/auth/roles"
import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { getDb } from "@/server/db/client"
import { auditLog, chatMessages, chatPresence } from "@/server/db/schema"
import * as repo from "@/server/modules/chat/repo"
import * as visitor from "@/server/modules/chat/visitor"

import { resetDb } from "../db"
import { adminRequest, mergeCookies, signedInUser } from "../helpers/auth"

const NOTICES = CHAT_SETTINGS_DEFAULT.notices
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"

beforeEach(async () => {
  await resetDb()
  mocks.maybeReply.mockClear()
  mocks.active = true
  mocks.tasks.length = 0
})

async function newChat(email?: string) {
  const { chat } = await repo.createConversation({
    tokenHash: `hash-${Math.random()}`,
    visitorName: "Visitor",
    sourcePath: "/",
    firstMessage: "Hello there",
  })
  if (email) await repo.setVisitorEmail(chat.id, email)
  return chat
}

const row = async (id: string) => (await repo.findById(id))!

const messages = (id: string) =>
  getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(chatMessages.id)

const audits = (action: string) =>
  getDb().select().from(auditLog).where(eq(auditLog.action, action))

const presenceRows = () => getDb().select().from(chatPresence)

type Call = [method: string, path: string, json?: unknown]

const req = (cookie: string, [method, path, json]: Call) =>
  adminRequest(`/chat${path}`, { cookie, method, json })

/** Every route; a fresh chat per call so one call cannot change another. */
async function everyRoute(cookie: string) {
  const out: Record<string, number> = {}
  const calls: [string, (id: string) => Call][] = [
    ["list", () => ["GET", ""]],
    ["unread", () => ["GET", "/unread"]],
    ["export", () => ["GET", "/export?email=a%40example.com"]],
    ["erase", () => ["POST", "/erase", { email: "a@example.com" }]],
    ["detail", (id) => ["GET", `/${id}`]],
    ["reply", (id) => ["POST", `/${id}/messages`, { body: "hi" }]],
    ["takeover", (id) => ["POST", `/${id}/takeover`]],
    ["handback", (id) => ["POST", `/${id}/handback`]],
    ["assign", (id) => ["POST", `/${id}/assign`, { userId: null }]],
    ["read", (id) => ["POST", `/${id}/read`, { upTo: 1 }]],
    ["close", (id) => ["POST", `/${id}/close`]],
    ["delete", (id) => ["DELETE", `/${id}`]],
  ]
  for (const [name, call] of calls) {
    const chat = await newChat()
    out[name] = (await req(cookie, call(chat.id))).status
  }
  return out
}

describe("chat admin API", () => {
  it("marketer, editor, author and viewer get 403 on GET /api/v1/admin/chat", async () => {
    for (const role of ["marketer", "editor", "author", "viewer"] as Role[]) {
      const { cookie } = await signedInUser([role])
      const statuses = await everyRoute(cookie)
      expect(
        Object.values(statuses).every((s) => s === 403),
        `${role}: ${JSON.stringify(statuses)}`
      ).toBe(true)
    }
    expect(await presenceRows()).toHaveLength(0)
  })

  it("intake can read and reply, not assign or delete", async () => {
    const { cookie } = await signedInUser(["intake"])
    expect(await everyRoute(cookie)).toEqual({
      list: 200,
      unread: 200,
      export: 403,
      erase: 403,
      detail: 200,
      reply: 201,
      takeover: 200,
      handback: 200,
      assign: 403,
      read: 200,
      close: 200,
      delete: 403,
    })
  })

  it("owner and admin can do everything", async () => {
    for (const role of ["owner", "admin"] as Role[]) {
      const { cookie } = await signedInUser([role])
      const statuses = await everyRoute(cookie)
      expect(statuses).toEqual({
        list: 200,
        unread: 200,
        export: 200,
        erase: 200,
        detail: 200,
        reply: 201,
        takeover: 200,
        handback: 200,
        assign: 200,
        read: 200,
        close: 200,
        delete: 200,
      })
    }
  })

  it("lists and shows a chat without the token hash or the bot lease", async () => {
    const { cookie } = await signedInUser(["intake"])
    const chat = await newChat()
    const list = await (await req(cookie, ["GET", ""])).json()
    expect(list.items).toHaveLength(1)
    expect(list.items[0]).toMatchObject({ id: chat.id, unread: true })
    expect(list.nextCursor).toBeNull()
    const detail = await (await req(cookie, ["GET", `/${chat.id}`])).json()
    expect(detail.messages).toHaveLength(1)
    expect(detail.assigneeName).toBeNull()
    for (const body of [list, detail]) {
      const text = JSON.stringify(body)
      expect(text).not.toContain("tokenHash")
      expect(text).not.toContain("aiLeaseUntil")
      expect(text).not.toContain(chat.tokenHash)
    }
    const after = await (
      await req(cookie, ["GET", `/${chat.id}?after=${detail.messages[0].id}`])
    ).json()
    expect(after.messages).toHaveLength(0)
    expect(
      (await (await req(cookie, ["GET", "?status=closed"])).json()).items
    ).toHaveLength(0)
  })

  it("rejects bad params and unknown chats", async () => {
    const { cookie } = await signedInUser(["admin"])
    const chat = await newChat()
    for (const call of [
      ["GET", `?cursor=${"x".repeat(101)}`],
      ["GET", "?status=archived"],
      ["GET", `/${chat.id}?after=-1`],
      ["GET", "/not-a-uuid"],
      ["POST", `/${chat.id}/read`, { upTo: -2 }],
      ["POST", `/${chat.id}/messages`, { body: "   " }],
      ["POST", `/${chat.id}/messages`, { body: "x".repeat(2001) }],
      ["POST", `/${chat.id}/assign`, { userId: "nope" }],
      ["GET", "/export?email=not-an-email"],
      ["POST", "/erase", {}],
    ] as Call[]) {
      expect((await req(cookie, call)).status, call.join(" ")).toBe(422)
    }
    expect((await req(cookie, ["GET", `/${UNKNOWN_ID}`])).status).toBe(404)
    expect(
      (await req(cookie, ["POST", `/${UNKNOWN_ID}/messages`, { body: "hi" }]))
        .status
    ).toBe(404)
  })

  it("reply takes over: AI off, assigned to me, one joined notice", async () => {
    const { user, cookie } = await signedInUser(["intake"])
    const chat = await newChat()
    const reply = (body: string) =>
      req(cookie, ["POST", `/${chat.id}/messages`, { body }])
    const first = await reply("Hi there")
    expect(first.status).toBe(201)
    expect(await first.json()).toMatchObject({
      sender: "staff",
      senderName: user.name,
      body: "Hi there",
    })
    expect((await reply("Anything else?")).status).toBe(201)
    const after = await row(chat.id)
    expect(after.aiEnabled).toBe(false)
    expect(after.assignedTo).toBe(user.id)
    const all = await messages(chat.id)
    const joined = all.filter(
      (m) => m.body === NOTICES.joined.replace("{name}", user.name)
    )
    expect(joined).toHaveLength(1)
    expect(joined[0]).toMatchObject({ sender: "system", noticeKind: null })
    expect(all.filter((m) => m.sender === "staff")).toHaveLength(2)
    const logs = await audits("chat.replied")
    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({ entityType: "chat", entityId: chat.id })
    expect(JSON.stringify(logs)).not.toContain("Hi there")
  })

  it("a later claim stores a new joined notice: once per claim, not per chat", async () => {
    const a = await signedInUser(["intake"])
    const admin = await signedInUser(["admin"])
    const chat = await newChat()
    await req(a.cookie, ["POST", `/${chat.id}/messages`, { body: "one" }])
    await req(admin.cookie, ["POST", `/${chat.id}/assign`, { userId: null }])
    await req(a.cookie, ["POST", `/${chat.id}/messages`, { body: "two" }])
    const joined = NOTICES.joined.replace("{name}", a.user.name)
    expect(
      (await messages(chat.id)).filter((m) => m.body === joined)
    ).toHaveLength(2)
  })

  it("a staff-held chat shows the agent's name", async () => {
    const { user, cookie } = await signedInUser(["intake"])
    const chat = await newChat()
    await req(cookie, ["POST", `/${chat.id}/takeover`])
    expect(await repo.assigneeName(user.id)).toBe(user.name)
    expect(await repo.assigneeName(UNKNOWN_ID)).toBeNull()
    const detail = await (await req(cookie, ["GET", `/${chat.id}`])).json()
    expect(detail.assigneeName).toBe(user.name)
    expect((await visitor.view(await row(chat.id))).agentName).toBe(user.name)
  })

  it("two concurrent replies → exactly one joined notice, assigned to the first", async () => {
    const a = await signedInUser(["intake"])
    const b = await signedInUser(["intake"])
    const chat = await newChat()
    const send = (cookie: string) =>
      req(cookie, ["POST", `/${chat.id}/messages`, { body: "hello" }])
    const [ra, rb] = await Promise.all([send(a.cookie), send(b.cookie)])
    expect([ra.status, rb.status].sort()).toEqual([201, 409])
    const winner = ra.status === 201 ? a.user : b.user
    expect((await row(chat.id)).assignedTo).toBe(winner.id)
    const all = await messages(chat.id)
    const joins = all.filter((m) => m.body.endsWith(" joined the chat."))
    expect(joins).toHaveLength(1)
    expect(joins[0]!.body).toBe(NOTICES.joined.replace("{name}", winner.name))
    expect(all.filter((m) => m.sender === "staff")).toHaveLength(1)
  })

  it("takeover assigns without a message; a closed chat is 409", async () => {
    const { user, cookie } = await signedInUser(["intake"])
    const chat = await newChat()
    const res = await req(cookie, ["POST", `/${chat.id}/takeover`])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain("tokenHash")
    const after = await row(chat.id)
    expect(after).toMatchObject({ aiEnabled: false, assignedTo: user.id })
    expect(
      (await messages(chat.id)).filter((m) => m.sender === "staff")
    ).toHaveLength(0)
    const closed = await newChat()
    await repo.close(closed.id)
    expect(
      (await req(cookie, ["POST", `/${closed.id}/messages`, { body: "hi" }]))
        .status
    ).toBe(409)
    expect((await req(cookie, ["POST", `/${closed.id}/takeover`])).status).toBe(
      409
    )
  })

  it("handback refused while another user holds the chat / after a failed notice", async () => {
    const holder = await signedInUser(["intake"])
    const other = await signedInUser(["intake"])
    const chat = await newChat()
    await req(holder.cookie, ["POST", `/${chat.id}/takeover`])
    const refused = await req(other.cookie, ["POST", `/${chat.id}/handback`])
    expect(refused.status).toBe(409)

    // Bot off or not set up: refused, nothing changes.
    mocks.active = false
    const off = await req(holder.cookie, ["POST", `/${chat.id}/handback`])
    expect(off.status).toBe(409)
    expect((await off.json()).error.message).toBe(
      "The assistant is switched off or not set up"
    )
    mocks.active = true

    for (const kind of ["limit", "failed"]) {
      const flagged = await newChat()
      await repo.addMessage({
        conversationId: flagged.id,
        sender: "system",
        senderName: null,
        body: "notice",
        noticeKind: kind,
      })
      await repo.flagNeedsHuman(flagged.id)
      const res = await req(holder.cookie, ["POST", `/${flagged.id}/handback`])
      expect(res.status, kind).toBe(409)
      expect((await res.json()).error.message).toBe(
        "The assistant can't take this chat back"
      )
      expect((await row(flagged.id)).needsHuman).toBe(true)
    }
    expect(await audits("chat.handed_back")).toHaveLength(0)
    expect(mocks.maybeReply).not.toHaveBeenCalled()

    // The holder hands back: AI on, unassigned, one back notice, bot deferred.
    await repo.flagNeedsHuman(chat.id)
    for (let i = 0; i < 3; i++) {
      expect(
        (await req(holder.cookie, ["POST", `/${chat.id}/handback`])).status
      ).toBe(200)
    }
    await Promise.all(mocks.tasks)
    const after = await row(chat.id)
    expect(after).toMatchObject({
      aiEnabled: true,
      needsHuman: false,
      assignedTo: null,
    })
    const back = (await messages(chat.id)).filter(
      (m) => m.body === NOTICES.back
    )
    expect(back).toHaveLength(1)
    expect(back[0]!.noticeKind).toBeNull()
    expect(mocks.maybeReply).toHaveBeenCalledTimes(1)
    expect(mocks.maybeReply).toHaveBeenCalledWith(chat.id)
    expect(await audits("chat.handed_back")).toHaveLength(1)
  })

  it("assign is only to users who can reply to chats", async () => {
    const admin = await signedInUser(["admin"])
    const intake = await signedInUser(["intake"])
    const viewer = await signedInUser(["viewer"])
    const chat = await newChat()
    const assign = (userId: string | null) =>
      req(admin.cookie, ["POST", `/${chat.id}/assign`, { userId }])
    const res = await assign(intake.user.id)
    expect(res.status).toBe(200)
    expect((await res.json()).assigneeName).toBe(intake.user.name)
    expect((await row(chat.id)).assignedTo).toBe(intake.user.id)
    expect((await assign(viewer.user.id)).status).toBe(422)
    expect((await assign(UNKNOWN_ID)).status).toBe(404)
    expect((await row(chat.id)).assignedTo).toBe(intake.user.id)
    expect((await assign(null)).status).toBe(200)
    expect((await row(chat.id)).assignedTo).toBeNull()
    const logs = await audits("chat.assigned")
    expect(logs.map((l) => l.diff)).toEqual([
      { from: null, to: intake.user.id },
      { from: intake.user.id, to: null },
    ])
  })

  it("view-as: every POST and DELETE → 403", async () => {
    const owner = await signedInUser(["owner"])
    const target = await signedInUser(["admin"])
    const start = await adminRequest(`/users/${target.user.id}/impersonate`, {
      cookie: owner.cookie,
      method: "POST",
    })
    expect(start.status).toBe(200)
    const asAdmin = mergeCookies(owner.cookie, start)
    const chat = await newChat("a@example.com")
    for (const call of [
      ["POST", "/erase", { email: "a@example.com" }],
      ["POST", `/${chat.id}/messages`, { body: "hi" }],
      ["POST", `/${chat.id}/takeover`],
      ["POST", `/${chat.id}/handback`],
      ["POST", `/${chat.id}/assign`, { userId: null }],
      ["POST", `/${chat.id}/read`, { upTo: 1 }],
      ["POST", `/${chat.id}/close`],
      ["DELETE", `/${chat.id}`],
    ] as Call[]) {
      const res = await req(asAdmin, call)
      expect(res.status, call.join(" ")).toBe(403)
      expect((await res.json()).error.message).toMatch(
        /^You can't .+ while viewing as someone$/
      )
    }
    // Reads still work, and do not mark the target (or the owner) online.
    expect((await req(asAdmin, ["GET", ""])).status).toBe(200)
    expect((await req(asAdmin, ["GET", `/${chat.id}`])).status).toBe(200)
    expect(await presenceRows()).toHaveLength(0)
    expect(await row(chat.id)).toMatchObject({
      status: "open",
      assignedTo: null,
      aiEnabled: true,
    })
  })

  it("unread drops after POST /:id/read; read never moves backwards", async () => {
    const { cookie } = await signedInUser(["intake"])
    const chat = await newChat()
    await new Promise((r) => setTimeout(r, 20))
    const second = (await repo.addMessage({
      conversationId: chat.id,
      sender: "visitor",
      senderName: "Visitor",
      body: "Second",
    }))!
    const [first] = await messages(chat.id)
    const unread = async () =>
      (await (await req(cookie, ["GET", "/unread"])).json()).count
    expect(await unread()).toBe(1)
    const read = (upTo: number) =>
      req(cookie, ["POST", `/${chat.id}/read`, { upTo }])
    expect((await read(first!.id)).status).toBe(200)
    expect(await unread()).toBe(1)
    await read(second.id)
    expect(await unread()).toBe(0)
    const readAt = (await row(chat.id)).staffReadAt
    await read(first!.id)
    expect((await row(chat.id)).staffReadAt).toEqual(readAt)
    expect(await unread()).toBe(0)
  })

  it("GET /unread does not touch presence; GET / does", async () => {
    const { user, cookie } = await signedInUser(["intake"])
    expect((await req(cookie, ["GET", "/unread"])).status).toBe(200)
    expect(await presenceRows()).toHaveLength(0)
    expect((await req(cookie, ["GET", ""])).status).toBe(200)
    const rows = await presenceRows()
    expect(rows.map((r) => r.userId)).toEqual([user.id])
  })

  it("export returns the chats for an email; erase removes them and audits counts only", async () => {
    const { cookie } = await signedInUser(["admin"])
    const mine = await newChat("aoife@example.com")
    await newChat("aoife@example.com")
    const other = await newChat("someone@example.com")

    const res = await req(cookie, ["GET", "/export?email=Aoife%40Example.com"])
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="chats-\d{4}-\d{2}-\d{2}\.json"$/
    )
    const exported = await res.json()
    expect(exported.email).toBe("aoife@example.com")
    expect(exported.chats).toHaveLength(2)
    expect(exported.chats[0]).toMatchObject({
      id: mine.id,
      messages: [expect.objectContaining({ body: "Hello there" })],
    })
    expect(JSON.stringify(exported)).not.toContain("tokenHash")

    const erase = await req(cookie, [
      "POST",
      "/erase",
      { email: "AOIFE@example.com" },
    ])
    expect(erase.status).toBe(200)
    expect(await erase.json()).toEqual({ erased: 2 })
    expect(await repo.findById(mine.id)).toBeNull()
    expect(await repo.findById(other.id)).not.toBeNull()

    const exportLog = await audits("chat.exported")
    const eraseLog = await audits("chat.erased")
    expect(exportLog.map((l) => l.diff)).toEqual([{ count: 2 }])
    expect(eraseLog.map((l) => l.diff)).toEqual([{ count: 2 }])
    expect(JSON.stringify([...exportLog, ...eraseLog])).not.toContain("aoife")
  })

  it("each mutation writes its audit action", async () => {
    const admin = await signedInUser(["admin"])
    const intake = await signedInUser(["intake"])
    const chat = await newChat()
    const call = (c: Call) => req(admin.cookie, c)
    await call(["POST", `/${chat.id}/takeover`])
    await call(["POST", `/${chat.id}/messages`, { body: "hi" }])
    await call(["POST", `/${chat.id}/handback`])
    await call(["POST", `/${chat.id}/assign`, { userId: intake.user.id }])
    await call(["POST", `/${chat.id}/close`])
    // A second close changes nothing: no notice, no audit.
    await call(["POST", `/${chat.id}/close`])
    await call(["DELETE", `/${chat.id}`])
    expect((await call(["DELETE", `/${chat.id}`])).status).toBe(404)
    const rows = await getDb()
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.entityType, "chat"), eq(auditLog.entityId, chat.id))
      )
      .orderBy(auditLog.createdAt)
    expect(rows.map((r) => r.action)).toEqual([
      "chat.taken_over",
      "chat.replied",
      "chat.handed_back",
      "chat.assigned",
      "chat.closed",
      "chat.deleted",
    ])
    expect(rows.every((r) => r.actorId === admin.user.id)).toBe(true)
  })

  it("close adds the ended notice once", async () => {
    const { cookie } = await signedInUser(["intake"])
    const chat = await newChat()
    await req(cookie, ["POST", `/${chat.id}/close`])
    await req(cookie, ["POST", `/${chat.id}/close`])
    const ended = (await messages(chat.id)).filter(
      (m) => m.body === NOTICES.ended
    )
    expect(ended).toHaveLength(1)
    expect(ended[0]!.noticeKind).toBeNull()
    expect((await row(chat.id)).status).toBe("closed")
  })
})
