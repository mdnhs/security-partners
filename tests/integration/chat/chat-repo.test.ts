import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { chatConversations, chatMessages } from "@/server/db/schema"
import * as repo from "@/server/modules/chat/repo"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

beforeEach(resetDb)

let n = 0
async function start(
  overrides: Partial<Parameters<typeof repo.createConversation>[0]> = {}
) {
  n += 1
  const { chat } = await repo.createConversation({
    tokenHash: `hash-${n}`,
    visitorName: "Aoife",
    sourcePath: "/services",
    firstMessage: "Hello there",
    ...overrides,
  })
  return chat
}

const setLastMessageAt = (id: string, at: Date) =>
  getDb()
    .update(chatConversations)
    .set({ lastMessageAt: at })
    .where(eq(chatConversations.id, id))

describe("chat repository", () => {
  it("createConversation stores the chat and its first message on one clock", async () => {
    const { chat, message } = await repo.createConversation({
      tokenHash: "hash-create",
      visitorName: "Aoife",
      sourcePath: "/services",
      firstMessage: "Hello there",
    })
    expect(chat.messageCount).toBe(1)
    expect(chat.visitorName).toBe("Aoife")
    expect(chat.lastVisitorMessageAt).toEqual(message.createdAt)
    expect(chat.consentAt).toEqual(message.createdAt)
    expect(message).toMatchObject({
      conversationId: chat.id,
      sender: "visitor",
      senderName: "Aoife",
      body: "Hello there",
    })
    expect((await repo.findByTokenHash("hash-create"))?.id).toBe(chat.id)
    expect((await repo.findById(chat.id))?.sourcePath).toBe("/services")
    expect(await repo.findByTokenHash("nope")).toBeNull()
  })

  it("addMessage bumps counters and timestamps by sender", async () => {
    const chat = await start()
    expect(chat.lastReplyAt).toBeNull()
    const m2 = await repo.addMessage({
      conversationId: chat.id,
      sender: "visitor",
      senderName: "Aoife",
      body: "two",
    })
    const afterVisitor = await repo.findById(chat.id)
    expect(afterVisitor?.lastVisitorMessageAt).toEqual(m2!.createdAt)
    expect(afterVisitor?.lastReplyAt).toBeNull()

    const staff = await repo.addMessage({
      conversationId: chat.id,
      sender: "staff",
      senderName: "Magda",
      body: "three",
    })
    const ai = await repo.addMessage({
      conversationId: chat.id,
      sender: "ai",
      senderName: "Assistant",
      body: "four",
    })
    await repo.addMessage({
      conversationId: chat.id,
      sender: "system",
      senderName: null,
      body: "five",
    })
    const after = await repo.messagesAfter(chat.id, m2!.id)
    expect(after.map((m) => m.body)).toEqual(["three", "four", "five"])
    expect(after[0]!.senderName).toBe("Magda")

    const row = await repo.findById(chat.id)
    expect(row?.messageCount).toBe(5)
    expect(row?.aiReplyCount).toBe(1)
    expect(row?.lastVisitorMessageAt).toEqual(m2!.createdAt)
    expect(row?.lastReplyAt).toEqual(ai!.createdAt)
    expect(row!.lastReplyAt!.getTime()).toBeGreaterThanOrEqual(
      staff!.createdAt.getTime()
    )
    expect(row!.lastMessageAt.getTime()).toBeGreaterThanOrEqual(
      ai!.createdAt.getTime()
    )

    // recentMessages: the model's view, oldest first, system notices left out.
    expect((await repo.recentMessages(chat.id, 2)).map((m) => m.body)).toEqual([
      "three",
      "four",
    ])
    expect((await repo.recentMessages(chat.id)).map((m) => m.sender)).toEqual([
      "visitor",
      "visitor",
      "staff",
      "ai",
    ])
  })

  it("addMessage refuses a closed chat and the 301st message", async () => {
    expect(repo.MAX_MESSAGES).toBe(300)
    const chat = await start()
    await getDb()
      .update(chatConversations)
      .set({ messageCount: 299 })
      .where(eq(chatConversations.id, chat.id))
    const visitor = (body: string) =>
      repo.addMessage({
        conversationId: chat.id,
        sender: "visitor",
        senderName: "Aoife",
        body,
      })
    expect(await visitor("300")).not.toBeNull()
    expect(await visitor("301")).toBeNull()
    expect((await repo.findById(chat.id))?.messageCount).toBe(300)

    expect(await repo.close(chat.id)).toBe(true)
    expect(
      await repo.addMessage({
        conversationId: chat.id,
        sender: "staff",
        senderName: "Magda",
        body: "late",
      })
    ).toBeNull()
    expect(
      await repo.addMessage({
        conversationId: chat.id,
        sender: "system",
        senderName: null,
        body: "This chat has ended.",
        requireOpen: false,
      })
    ).not.toBeNull()
  })

  it("a notice kind is stored once", async () => {
    const chat = await start()
    const notice = (noticeKind: string | null) =>
      repo.addMessage({
        conversationId: chat.id,
        sender: "system",
        senderName: null,
        body: "n",
        noticeKind,
      })
    expect(await repo.hasNotice(chat.id, ["handoff"])).toBe(false)
    expect(await notice("handoff")).not.toBeNull()
    expect(await notice("handoff")).toBeNull()
    expect(await repo.hasNotice(chat.id, ["limit", "handoff"])).toBe(true)
    expect(await repo.hasNotice(chat.id, ["limit"])).toBe(false)
    // A null notice kind is never deduplicated.
    expect(await notice(null)).not.toBeNull()
    expect(await notice(null)).not.toBeNull()

    const rows = await getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.noticeKind, "handoff"))
    expect(rows).toHaveLength(1)
    // The refused notice left the counters alone.
    expect((await repo.findById(chat.id))?.messageCount).toBe(4)
  })

  it("requireBotOwns drops an AI reply after assign", async () => {
    const user = await createUser({ roles: ["admin"] })
    const bot = (id: string) =>
      repo.addMessage({
        conversationId: id,
        sender: "ai",
        senderName: "Assistant",
        body: "hi",
        requireBotOwns: true,
      })

    const a = await start()
    expect(await bot(a.id)).not.toBeNull()
    await repo.assign(a.id, user.id)
    expect(await bot(a.id)).toBeNull()
    expect((await repo.findById(a.id))?.aiReplyCount).toBe(1)

    const b = await start()
    await repo.setAi(b.id, false)
    expect(await bot(b.id)).toBeNull()

    const c = await start()
    expect(await repo.flagNeedsHuman(c.id)).toBe(true)
    expect(await repo.flagNeedsHuman(c.id)).toBe(false)
    expect(await bot(c.id)).toBeNull()

    // Turning the AI back on clears needs_human and its alert stamp.
    expect(await repo.claimNeedsHumanAlert(c.id)).toBe(true)
    expect(await repo.claimNeedsHumanAlert(c.id)).toBe(false)
    const on = await repo.setAi(c.id, true)
    expect(on?.needsHuman).toBe(false)
    expect(on?.needsHumanAlertedAt).toBeNull()
    expect(await bot(c.id)).not.toBeNull()

    // setAi and assign need an open chat.
    expect(await repo.close(c.id)).toBe(true)
    expect(await repo.setAi(c.id, false)).toBeNull()
    expect(await repo.assign(c.id, user.id)).toBeNull()
  })

  it("claimLease is exclusive and releaseLease only frees its own lease", async () => {
    const chat = await start()
    const results = await Promise.all([
      repo.claimLease(chat.id, 60_000),
      repo.claimLease(chat.id, 60_000),
    ])
    const won = results.filter((r): r is string => r !== null)
    expect(won).toHaveLength(1)
    const first = won[0]!

    // Expire the first lease; a second run takes over.
    await getDb()
      .update(chatConversations)
      .set({ aiLeaseUntil: new Date(Date.now() - 1000) })
      .where(eq(chatConversations.id, chat.id))
    const second = await repo.claimLease(chat.id, 60_000)
    expect(second).not.toBeNull()

    // The stale run cannot free the newer lease...
    await repo.releaseLease(chat.id, first)
    expect(await repo.claimLease(chat.id, 60_000)).toBeNull()
    // ...but the owner can.
    await repo.releaseLease(chat.id, second!)
    expect(await repo.claimLease(chat.id, 60_000)).not.toBeNull()

    // close clears the lease.
    expect(await repo.close(chat.id)).toBe(true)
    expect((await repo.findById(chat.id))?.aiLeaseUntil).toBeNull()
  })

  it("assignIfUnassigned: the second caller gets false", async () => {
    const u1 = await createUser({ roles: ["admin"] })
    const u2 = await createUser({ roles: ["admin"] })
    const chat = await start()
    const results = await Promise.all([
      repo.assignIfUnassigned(chat.id, u1.id),
      repo.assignIfUnassigned(chat.id, u2.id),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    const winner = results[0] ? u1.id : u2.id
    expect((await repo.findById(chat.id))?.assignedTo).toBe(winner)
    expect(await repo.assignIfUnassigned(chat.id, u1.id)).toBe(false)

    // assign(null) unassigns; a closed chat cannot be claimed.
    expect((await repo.assign(chat.id, null))?.assignedTo).toBeNull()
    expect(await repo.close(chat.id)).toBe(true)
    expect(await repo.assignIfUnassigned(chat.id, u1.id)).toBe(false)
  })

  it("close is transition-only; setVisitorEmail and remove", async () => {
    const chat = await start()
    expect(await repo.setVisitorEmail(chat.id, "x@example.com")).toBe(true)
    expect((await repo.findById(chat.id))?.visitorEmail).toBe("x@example.com")
    expect(await repo.close(chat.id)).toBe(true)
    const closedAt = (await repo.findById(chat.id))?.closedAt
    expect(closedAt).not.toBeNull()
    expect(await repo.close(chat.id)).toBe(false)
    expect((await repo.findById(chat.id))?.closedAt).toEqual(closedAt)
    expect(await repo.setVisitorEmail(chat.id, "y@example.com")).toBe(false)
    expect(await repo.remove(chat.id)).toBe(true)
    expect(await repo.remove(chat.id)).toBe(false)
  })

  it("markRead never moves backwards", async () => {
    const chat = await start()
    const first = (await repo.messagesAfter(chat.id, 0))[0]!
    const second = await repo.addMessage({
      conversationId: chat.id,
      sender: "visitor",
      senderName: "Aoife",
      body: "again",
    })
    await repo.markRead(chat.id, first.id)
    expect((await repo.findById(chat.id))?.staffReadAt).toEqual(first.createdAt)
    await repo.markRead(chat.id, second!.id)
    expect((await repo.findById(chat.id))?.staffReadAt).toEqual(
      second!.createdAt
    )
    await repo.markRead(chat.id, first.id)
    expect((await repo.findById(chat.id))?.staffReadAt).toEqual(
      second!.createdAt
    )

    // A message id from another chat is ignored.
    const other = await start()
    const foreign = (await repo.messagesAfter(other.id, 0))[0]!
    await repo.markRead(chat.id, foreign.id)
    expect((await repo.findById(chat.id))?.staffReadAt).toEqual(
      second!.createdAt
    )
  })

  it("listForStaff pages by cursor with no gaps or repeats across equal timestamps", async () => {
    const at = new Date("2026-06-01T10:00:00.123Z")
    const chats = []
    for (let i = 0; i < 5; i++) {
      const c = await start()
      await setLastMessageAt(c.id, at)
      chats.push(c)
    }
    const newest = await start()
    await setLastMessageAt(newest.id, new Date("2026-06-02T10:00:00.000Z"))
    const closed = await start()
    await repo.close(closed.id)

    const seen: string[] = []
    let cursor: string | undefined
    let pages = 0
    do {
      const page = await repo.listForStaff({ status: "open", cursor, limit: 2 })
      seen.push(...page.items.map((i) => i.id))
      cursor = page.nextCursor ?? undefined
      pages += 1
    } while (cursor && pages < 10)

    expect(pages).toBe(3)
    expect(seen[0]).toBe(newest.id)
    expect(new Set(seen).size).toBe(6)
    expect(seen.sort()).toEqual([...chats.map((c) => c.id), newest.id].sort())

    const closedPage = await repo.listForStaff({ status: "closed" })
    expect(closedPage.items.map((i) => i.id)).toEqual([closed.id])
    expect(closedPage.nextCursor).toBeNull()

    // A malformed cursor is ignored.
    const bad = await repo.listForStaff({
      status: "closed",
      cursor: "2026-01-01T00:00:00.000Z|not-a-uuid",
    })
    expect(bad.items).toHaveLength(1)
  })

  it("unreadCount counts open chats whose visitor spoke after staff_read_at", async () => {
    const a = await start()
    const b = await start()
    const closed = await start()
    await repo.close(closed.id)
    expect(await repo.unreadCount()).toBe(2)

    const firstA = (await repo.messagesAfter(a.id, 0))[0]!
    await repo.markRead(a.id, firstA.id)
    expect(await repo.unreadCount()).toBe(1)

    // A staff reply does not make it unread; a new visitor message does.
    await repo.addMessage({
      conversationId: a.id,
      sender: "staff",
      senderName: "Magda",
      body: "hi",
    })
    expect(await repo.unreadCount()).toBe(1)
    await repo.addMessage({
      conversationId: a.id,
      sender: "visitor",
      senderName: "Aoife",
      body: "thanks",
    })
    expect(await repo.unreadCount()).toBe(2)

    const list = await repo.listForStaff({ status: "open" })
    const byId = new Map(list.items.map((i) => [i.id, i.unread]))
    expect(byId.get(a.id)).toBe(true)
    expect(byId.get(b.id)).toBe(true)
  })

  it("staffOnline follows presence", async () => {
    const user = await createUser({ roles: ["admin"] })
    expect(await repo.staffOnline()).toBe(false)
    await repo.touchPresence(user.id)
    await repo.touchPresence(user.id)
    expect(await repo.staffOnline()).toBe(true)
    expect(await repo.staffOnline(-1000)).toBe(false)
  })

  it("exportForEmail/eraseForEmail match case-insensitively and cascade messages", async () => {
    const mine = await start()
    await repo.setVisitorEmail(mine.id, "Aoife@Example.com")
    await repo.addMessage({
      conversationId: mine.id,
      sender: "ai",
      senderName: "Assistant",
      body: "Hi Aoife",
    })
    const other = await start()
    await repo.setVisitorEmail(other.id, "aoife@example.com.evil")
    await start()

    const exported = await repo.exportForEmail("aoife@example.com")
    expect(exported).toHaveLength(1)
    expect(exported[0]).toMatchObject({
      id: mine.id,
      visitorName: "Aoife",
      visitorEmail: "Aoife@Example.com",
      status: "open",
      sourcePath: "/services",
    })
    expect(exported[0]!.messages.map((m) => [m.sender, m.body])).toEqual([
      ["visitor", "Hello there"],
      ["ai", "Hi Aoife"],
    ])
    expect(await repo.exportForEmail("aoife@")).toEqual([])

    const erased = await getDb().transaction((tx) =>
      repo.eraseForEmail("AOIFE@example.COM", tx)
    )
    expect(erased).toBe(1)
    expect(await repo.findById(mine.id)).toBeNull()
    expect(await repo.findById(other.id)).not.toBeNull()
    const orphans = await getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, mine.id))
    expect(orphans).toHaveLength(0)
  })

  it("purgeBefore deletes by coalesce(closed_at, last_message_at)", async () => {
    const cutoff = new Date("2026-01-01T00:00:00.000Z")
    const old = new Date("2025-06-01T00:00:00.000Z")
    const recent = new Date("2026-06-01T00:00:00.000Z")

    // Open, quiet since before the cutoff → purged.
    const staleOpen = await start()
    await setLastMessageAt(staleOpen.id, old)
    // Closed before the cutoff → purged.
    const oldClosed = await start()
    await getDb()
      .update(chatConversations)
      .set({ status: "closed", closedAt: old, lastMessageAt: old })
      .where(eq(chatConversations.id, oldClosed.id))
    // Old messages but closed after the cutoff → kept.
    const lateClosed = await start()
    await getDb()
      .update(chatConversations)
      .set({ status: "closed", closedAt: recent, lastMessageAt: old })
      .where(eq(chatConversations.id, lateClosed.id))
    // Active → kept.
    const active = await start()

    expect(await repo.purgeBefore(cutoff)).toBe(2)
    expect(await repo.findById(staleOpen.id)).toBeNull()
    expect(await repo.findById(oldClosed.id)).toBeNull()
    expect(await repo.findById(lateClosed.id)).not.toBeNull()
    expect(await repo.findById(active.id)).not.toBeNull()
    const orphans = await getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, staleOpen.id))
    expect(orphans).toHaveLength(0)
  })
})
