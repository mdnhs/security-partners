import "server-only"

import { and, desc, eq, getTableColumns, sql } from "drizzle-orm"

import { type DbOrTx, getDb } from "@/server/db/client"
import {
  chatConversations,
  chatMessages,
  chatPresence,
  users,
} from "@/server/db/schema"

// Port of JW server/modules/chat/repo.ts (live chat plan, Task 2).

export type ChatConversationRow = typeof chatConversations.$inferSelect
export type ChatMessageRow = typeof chatMessages.$inferSelect
export type ChatListRow = ChatConversationRow & { unread: boolean }
export type ChatSender = "visitor" | "staff" | "ai" | "system"

/** A visitor message is refused once the chat holds this many messages. */
export const MAX_MESSAGES = 300

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------- conversations ----------

export async function createConversation(
  input: {
    tokenHash: string
    visitorName: string
    sourcePath: string | null
    firstMessage: string
  },
  db: DbOrTx = getDb()
): Promise<{ chat: ChatConversationRow; message: ChatMessageRow }> {
  return db.transaction(async (tx) => {
    // DB clock only: now() is constant inside the transaction, so the
    // conversation timestamps equal the first message's created_at.
    const now = sql`now()`
    const [chat] = await tx
      .insert(chatConversations)
      .values({
        tokenHash: input.tokenHash,
        visitorName: input.visitorName,
        sourcePath: input.sourcePath,
        consentAt: now,
        messageCount: 1,
        lastMessageAt: now,
        lastVisitorMessageAt: now,
      })
      .returning()
    const [message] = await tx
      .insert(chatMessages)
      .values({
        conversationId: chat!.id,
        sender: "visitor",
        senderName: input.visitorName,
        body: input.firstMessage,
        createdAt: now,
      })
      .returning()
    return { chat: chat!, message: message! }
  })
}

export async function findByTokenHash(
  hash: string,
  db: DbOrTx = getDb()
): Promise<ChatConversationRow | null> {
  const [row] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.tokenHash, hash))
  return row ?? null
}

export async function findById(
  id: string,
  db: DbOrTx = getDb()
): Promise<ChatConversationRow | null> {
  const [row] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
  return row ?? null
}

/** The assigned staff member's display name (shown to the visitor). */
export async function assigneeName(
  userId: string,
  db: DbOrTx = getDb()
): Promise<string | null> {
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
  return row?.name ?? null
}

/** Name, roles and ban flag of a user a chat may be assigned to. */
export async function findStaffUser(
  userId: string,
  db: DbOrTx = getDb()
): Promise<{
  name: string
  role: string | null
  banned: boolean | null
} | null> {
  const [row] = await db
    .select({ name: users.name, role: users.role, banned: users.banned })
    .from(users)
    .where(eq(users.id, userId))
  return row ?? null
}

// ---------- messages ----------

export async function messagesAfter(
  conversationId: string,
  afterId: number,
  limit = 200,
  db: DbOrTx = getDb()
): Promise<ChatMessageRow[]> {
  return db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        sql`${chatMessages.id} > ${afterId}`
      )
    )
    .orderBy(chatMessages.id)
    .limit(limit)
}

/** The model's view: the last `limit` non-system messages, oldest first. */
export async function recentMessages(
  conversationId: string,
  limit = 20,
  db: DbOrTx = getDb()
): Promise<ChatMessageRow[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        sql`${chatMessages.sender} <> 'system'`
      )
    )
    .orderBy(desc(chatMessages.id))
    .limit(limit)
  return rows.reverse()
}

type MessageSqlRow = {
  id: number | string
  conversation_id: string
  sender: string
  sender_name: string | null
  body: string
  notice_kind: string | null
  created_at: Date | string
}

// One statement: the guarded UPDATE locks the conversation and bumps its
// counters; the INSERT only runs from that CTE's row, so a refused guard
// writes nothing. A repeated notice (same non-null notice_kind) is skipped up
// front (not exists) so the counters are not bumped; the ON CONFLICT is the
// backstop for a concurrent duplicate (which may over-count by one,
// harmlessly). A null notice_kind is never deduplicated.
export async function addMessage(
  input: {
    conversationId: string
    sender: ChatSender
    senderName: string | null
    body: string
    noticeKind?: string | null
    requireOpen?: boolean
    requireBotOwns?: boolean
  },
  db: DbOrTx = getDb()
): Promise<ChatMessageRow | null> {
  const requireOpen = input.requireOpen ?? true
  const noticeKind = input.noticeKind ?? null
  const isVisitor = input.sender === "visitor"
  const isReply = input.sender === "staff" || input.sender === "ai"

  const guards = [
    requireOpen ? sql`and c.status = 'open'` : sql``,
    input.requireBotOwns
      ? sql`and c.ai_enabled and not c.needs_human and c.assigned_to is null`
      : sql``,
    isVisitor ? sql`and c.message_count < ${MAX_MESSAGES}` : sql``,
    noticeKind
      ? sql`and not exists (
          select 1 from chat_messages n
          where n.conversation_id = c.id and n.notice_kind = ${noticeKind})`
      : sql``,
  ]

  const { rows } = await db.execute<MessageSqlRow>(sql`
    with bumped as (
      update chat_conversations c set
        message_count = c.message_count + 1,
        last_message_at = now(),
        last_visitor_message_at = ${isVisitor ? sql`now()` : sql`c.last_visitor_message_at`},
        last_reply_at = ${isReply ? sql`now()` : sql`c.last_reply_at`},
        ai_reply_count = c.ai_reply_count + ${input.sender === "ai" ? 1 : 0}
      where c.id = ${input.conversationId}
      ${sql.join(guards, sql` `)}
      returning c.id
    )
    insert into chat_messages (conversation_id, sender, sender_name, body, notice_kind)
    select bumped.id, ${input.sender}, ${input.senderName}, ${input.body}, ${noticeKind}
    from bumped
    on conflict (conversation_id, notice_kind) where notice_kind is not null
    do nothing
    returning *`)
  const row = rows[0]
  if (!row) return null
  return {
    id: Number(row.id),
    conversationId: row.conversation_id,
    sender: row.sender,
    senderName: row.sender_name,
    body: row.body,
    noticeKind: row.notice_kind,
    createdAt: new Date(row.created_at),
  }
}

export async function hasNotice(
  conversationId: string,
  kinds: string[],
  db: DbOrTx = getDb()
): Promise<boolean> {
  if (kinds.length === 0) return false
  const { rows } = await db.execute(sql`
    select 1 from chat_messages
    where conversation_id = ${conversationId}
      and notice_kind in (${sql.join(
        kinds.map((k) => sql`${k}`),
        sql`, `
      )})
    limit 1`)
  return rows.length > 0
}

// ---------- bot lease ----------

// A single conditional UPDATE: concurrent claims serialise on the row lock and
// the loser re-checks the predicate against the winner's new lease. Returns the
// expiry it set as text (full microsecond precision, so it compares exactly in
// releaseLease), or null when someone else holds the lease.
export async function claimLease(
  id: string,
  ms = 60_000,
  db: DbOrTx = getDb()
): Promise<string | null> {
  const { rows } = await db.execute<{ until: string }>(sql`
    update chat_conversations
    set ai_lease_until = now() + (${ms}::numeric * interval '1 millisecond')
    where id = ${id}
      and (ai_lease_until is null or ai_lease_until < now())
    returning ai_lease_until::text as until`)
  return rows[0]?.until ?? null
}

// Owner-scoped: clears only the lease this run set, so a run whose lease
// expired cannot free a newer run's lease.
export async function releaseLease(
  id: string,
  until: string,
  db: DbOrTx = getDb()
): Promise<void> {
  await db.execute(sql`
    update chat_conversations set ai_lease_until = null
    where id = ${id} and ai_lease_until = ${until}::timestamptz`)
}

// ---------- flags and assignment ----------

/** True only for the call that flipped needs_human from false to true. */
export async function flagNeedsHuman(
  id: string,
  db: DbOrTx = getDb()
): Promise<boolean> {
  const rows = await db
    .update(chatConversations)
    .set({ needsHuman: true })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.needsHuman, false))
    )
    .returning({ id: chatConversations.id })
  return rows.length > 0
}

// True for the one caller that stamps the alert time: a conditional UPDATE,
// so a chat is alerted at most once however many paths flag it.
export async function claimNeedsHumanAlert(
  id: string,
  db: DbOrTx = getDb()
): Promise<boolean> {
  const rows = await db
    .update(chatConversations)
    .set({ needsHumanAlertedAt: sql`now()` })
    .where(
      and(
        eq(chatConversations.id, id),
        sql`${chatConversations.needsHumanAlertedAt} is null`
      )
    )
    .returning({ id: chatConversations.id })
  return rows.length > 0
}

// Open chats only. Turning the AI back on also clears needs_human and its
// alert stamp, so a later handoff alerts again.
export async function setAi(
  id: string,
  enabled: boolean,
  db: DbOrTx = getDb()
): Promise<ChatConversationRow | null> {
  const [row] = await db
    .update(chatConversations)
    .set(
      enabled
        ? { aiEnabled: true, needsHuman: false, needsHumanAlertedAt: null }
        : { aiEnabled: false }
    )
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.status, "open"))
    )
    .returning()
  return row ?? null
}

// Requires an open chat, like setAi: nobody is assigned to a finished chat.
export async function assign(
  id: string,
  userId: string | null,
  db: DbOrTx = getDb()
): Promise<ChatConversationRow | null> {
  const [row] = await db
    .update(chatConversations)
    .set({ assignedTo: userId })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.status, "open"))
    )
    .returning()
  return row ?? null
}

// Compare-and-set: only an open, unassigned chat can be claimed, so two staff
// acting at once cannot both win.
export async function assignIfUnassigned(
  id: string,
  userId: string,
  db: DbOrTx = getDb()
): Promise<boolean> {
  const rows = await db
    .update(chatConversations)
    .set({ assignedTo: userId })
    .where(
      and(
        eq(chatConversations.id, id),
        eq(chatConversations.status, "open"),
        sql`${chatConversations.assignedTo} is null`
      )
    )
    .returning({ id: chatConversations.id })
  return rows.length > 0
}

// Transition-only: true only when this call closed the chat, so callers add
// the "ended" notice exactly once. Clears the bot lease.
export async function close(
  id: string,
  db: DbOrTx = getDb()
): Promise<boolean> {
  const rows = await db
    .update(chatConversations)
    .set({
      status: "closed",
      closedAt: sql`coalesce(${chatConversations.closedAt}, now())`,
      aiLeaseUntil: null,
    })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.status, "open"))
    )
    .returning({ id: chatConversations.id })
  return rows.length > 0
}

// Messages go with their conversation (ON DELETE CASCADE).
export async function remove(
  id: string,
  db: DbOrTx = getDb()
): Promise<boolean> {
  const rows = await db
    .delete(chatConversations)
    .where(eq(chatConversations.id, id))
    .returning({ id: chatConversations.id })
  return rows.length > 0
}

export async function setVisitorEmail(
  id: string,
  email: string,
  db: DbOrTx = getDb()
): Promise<boolean> {
  const rows = await db
    .update(chatConversations)
    .set({ visitorEmail: email })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.status, "open"))
    )
    .returning({ id: chatConversations.id })
  return rows.length > 0
}

// Never moves backwards and never uses now(): a message the staff member has
// not seen yet must keep the chat unread.
export async function markRead(
  id: string,
  upToMessageId: number,
  db: DbOrTx = getDb()
): Promise<void> {
  await db.execute(sql`
    update chat_conversations c
    set staff_read_at = greatest(coalesce(c.staff_read_at, m.created_at), m.created_at)
    from chat_messages m
    where c.id = ${id} and m.id = ${upToMessageId} and m.conversation_id = c.id`)
}

// ---------- lists and presence ----------

const unreadExpr = sql<boolean>`coalesce(${chatConversations.lastVisitorMessageAt} > coalesce(${chatConversations.staffReadAt}, 'epoch'::timestamptz), false)`
// Millisecond precision so the cursor (a JS-safe string) round-trips exactly.
const sortAt = sql`date_trunc('milliseconds', ${chatConversations.lastMessageAt})`

export async function listForStaff(
  opts: { status: "open" | "closed"; cursor?: string; limit?: number },
  db: DbOrTx = getDb()
): Promise<{ items: ChatListRow[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 30
  const conditions = [eq(chatConversations.status, opts.status)]
  if (opts.cursor) {
    const [at, cid] = opts.cursor.split("|")
    if (at && cid && !Number.isNaN(Date.parse(at)) && UUID_RE.test(cid)) {
      conditions.push(
        sql`(${sortAt}, ${chatConversations.id}) < (${new Date(at).toISOString()}::timestamptz, ${cid}::uuid)`
      )
    }
  }
  const rows = await db
    .select({ ...getTableColumns(chatConversations), unread: unreadExpr })
    .from(chatConversations)
    .where(and(...conditions))
    .orderBy(desc(sortAt), desc(chatConversations.id))
    .limit(limit + 1)
  const items = rows.slice(0, limit)
  const last = items[items.length - 1]
  const nextCursor =
    rows.length > limit && last
      ? `${last.lastMessageAt.toISOString()}|${last.id}`
      : null
  return { items, nextCursor }
}

export async function unreadCount(db: DbOrTx = getDb()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatConversations)
    .where(and(eq(chatConversations.status, "open"), unreadExpr))
  return row?.n ?? 0
}

export async function touchPresence(
  userId: string,
  db: DbOrTx = getDb()
): Promise<void> {
  await db
    .insert(chatPresence)
    .values({ userId, seenAt: sql`now()` })
    .onConflictDoUpdate({
      target: chatPresence.userId,
      set: { seenAt: sql`now()` },
    })
}

export async function staffOnline(
  windowSec = 120,
  db: DbOrTx = getDb()
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    select 1 from chat_presence
    where seen_at > now() - (${windowSec}::numeric * interval '1 second')
    limit 1`)
  return rows.length > 0
}

// ---------- privacy and retention (exact visitor_email match only) ----------

const byVisitorEmail = (email: string) =>
  sql`lower(${chatConversations.visitorEmail}) = lower(${email})`

export async function exportForEmail(email: string, db: DbOrTx = getDb()) {
  const chats = await db
    .select()
    .from(chatConversations)
    .where(byVisitorEmail(email))
    .orderBy(chatConversations.createdAt)
  return Promise.all(
    chats.map(async (c) => {
      const rows = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, c.id))
        .orderBy(chatMessages.id)
      return {
        id: c.id,
        visitorName: c.visitorName,
        visitorEmail: c.visitorEmail,
        status: c.status,
        sourcePath: c.sourcePath,
        consentAt: c.consentAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
        messages: rows.map((m) => ({
          sender: m.sender,
          senderName: m.senderName,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
      }
    })
  )
}

// Messages go with their conversation (ON DELETE CASCADE).
export async function eraseForEmail(
  email: string,
  db: DbOrTx = getDb()
): Promise<number> {
  const rows = await db
    .delete(chatConversations)
    .where(byVisitorEmail(email))
    .returning({ id: chatConversations.id })
  return rows.length
}

/** Retention: whole chats whose last activity (or close) is before `cutoff`. */
export async function purgeBefore(
  cutoff: Date,
  db: DbOrTx = getDb()
): Promise<number> {
  const rows = await db
    .delete(chatConversations)
    .where(
      sql`coalesce(${chatConversations.closedAt}, ${chatConversations.lastMessageAt}) < ${cutoff.toISOString()}::timestamptz`
    )
    .returning({ id: chatConversations.id })
  return rows.length
}

// ---------- sweep (JW sweep.ts, JW §6.12) ----------

// Bot-owned = open, AI on, not flagged, unassigned (as requireBotOwns above).
const BOT_OWNED = sql`(c.ai_enabled and not c.needs_human and c.assigned_to is null)`
const LEASE_FREE = sql`(c.ai_lease_until is null or c.ai_lease_until < now())`

type IdRow = { id: string }

/** Closes open chats idle for 24 h and clears their lease; returns their ids. */
export async function closeIdle(db: DbOrTx = getDb()): Promise<string[]> {
  const { rows } = await db.execute<IdRow>(sql`
    update chat_conversations c set
      status = 'closed',
      closed_at = coalesce(c.closed_at, now()),
      ai_lease_until = null
    where c.status = 'open'
      and c.last_message_at < now() - interval '24 hours'
    returning c.id`)
  return rows.map((r) => r.id)
}

/**
 * Stamps the no-reply alert, once per waiting episode: the visitor spoke
 * last, over 5 min ago. A bot-owned chat whose bot holds a live lease is
 * skipped while `botActive`; with the bot off no chat is bot-owned.
 */
export async function claimNoReplyAlerts(
  botActive: boolean,
  db: DbOrTx = getDb()
): Promise<string[]> {
  const waitingOnBot = botActive
    ? sql`(${BOT_OWNED} and not ${LEASE_FREE})`
    : sql`false`
  const { rows } = await db.execute<IdRow>(sql`
    update chat_conversations c set no_reply_alerted_at = now()
    where c.status = 'open'
      and c.last_visitor_message_at < now() - interval '5 minutes'
      and c.last_visitor_message_at > coalesce(c.last_reply_at, 'epoch'::timestamptz)
      and (c.no_reply_alerted_at is null
           or c.no_reply_alerted_at < c.last_visitor_message_at)
      and not ${waitingOnBot}
    returning c.id`)
  return rows.map((r) => r.id)
}

/** Stalled bot: the visitor spoke last, over 90 s ago, and no one holds the lease. */
export async function stalledBotChats(db: DbOrTx = getDb()): Promise<string[]> {
  const { rows } = await db.execute<IdRow>(sql`
    select c.id from chat_conversations c
    where c.status = 'open'
      and ${BOT_OWNED}
      and ${LEASE_FREE}
      and c.last_visitor_message_at is not null
      and c.last_visitor_message_at >= c.last_message_at
      and c.last_visitor_message_at > coalesce(c.last_reply_at, 'epoch'::timestamptz)
      and c.last_visitor_message_at < now() - interval '90 seconds'
    order by c.last_visitor_message_at`)
  return rows.map((r) => r.id)
}
