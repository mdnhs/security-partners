import "server-only"

import { hasPermission, parseRoles } from "@/lib/auth/permissions"
import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { fillChatText } from "@/lib/chat/text"
import { isoDate } from "@/lib/format"
import type { ChatSettings } from "@/lib/schemas/settings/chat"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { defer } from "@/server/lib/defer"
import { AppError } from "@/server/lib/errors"

import * as bot from "./bot"
import * as repo from "./repo"
import { readChatSettings } from "./settings"

// The admin inbox's service (port of JW server/modules/chat/staff.ts, live
// chat plan Task 6). Routes check permissions and view-as; this file holds
// the rules: who holds a chat, when the assistant may take it back, and the
// notices the visitor sees.

const PAGE = 30
const ENTITY = "chat"

type Secret = "tokenHash" | "aiLeaseUntil"
/** A chat as staff see it: never the visitor's token hash or the bot lease. */
export type StaffChat = Omit<repo.ChatConversationRow, Secret>
export type StaffChatRow = Omit<repo.ChatListRow, Secret>
export type StaffChatDetail = Awaited<ReturnType<typeof detail>>

function toStaff<T extends repo.ChatConversationRow>(chat: T): Omit<T, Secret> {
  const { tokenHash: _hash, aiLeaseUntil: _lease, ...rest } = chat
  void _hash
  void _lease
  return rest
}

const notFound = () => new AppError("NOT_FOUND", "Chat not found")
const ended = () => new AppError("CONFLICT", "This chat has ended")
const taken = () =>
  new AppError("CONFLICT", "Someone else is handling this chat")

async function load(id: string) {
  const chat = await repo.findById(id)
  if (!chat) throw notFound()
  return chat
}

const chatSettings = async (): Promise<ChatSettings> =>
  (await readChatSettings()) ?? CHAT_SETTINGS_DEFAULT

/** A system notice; notice_kind stays null so it may repeat (once per event). */
async function notice(
  id: string,
  text: (s: ChatSettings) => string,
  values: { name?: string } = {},
  requireOpen = true
) {
  const s = await chatSettings()
  return repo.addMessage({
    conversationId: id,
    sender: "system",
    senderName: null,
    body: fillChatText(text(s), {
      team: s.teamName,
      botName: s.bot.name,
      ...values,
    }),
    requireOpen,
  })
}

async function actorName(actor: Actor) {
  return (await repo.assigneeName(actor.userId)) ?? "A team member"
}

const audit = (
  actor: Actor,
  action: string,
  entityId?: string,
  diff?: unknown
) => writeAudit(getDb(), actor, { action, entityType: ENTITY, entityId, diff })

// ---------- reads ----------

/** Marks a staff member as online for the visitor's "team is here" dot. */
export const markPresent = (userId: string) => repo.touchPresence(userId)

export async function list(opts: {
  status: "open" | "closed"
  cursor?: string
}) {
  const { items, nextCursor } = await repo.listForStaff({
    ...opts,
    limit: PAGE,
  })
  return { items: items.map(toStaff), nextCursor }
}

export async function unread() {
  return { count: await repo.unreadCount() }
}

export async function detail(id: string, after: number) {
  const chat = await load(id)
  const [messages, assigneeName] = await Promise.all([
    repo.messagesAfter(id, after),
    chat.assignedTo ? repo.assigneeName(chat.assignedTo) : null,
  ])
  return { chat: toStaff(chat), assigneeName, messages }
}

// ---------- holding a chat ----------

/**
 * Turns the assistant off and assigns an unassigned chat to the actor. The
 * joined notice is stored only by the call whose compare-and-set made that
 * assignment, so it appears once per claim: never twice for two concurrent
 * replies, and again after the chat was unassigned and claimed anew.
 */
async function claim(actor: Actor, id: string, name: string) {
  const before = await load(id)
  if (before.status !== "open") throw ended()
  let joined = false
  if (before.assignedTo !== actor.userId) {
    if (before.assignedTo !== null) throw taken()
    if (await repo.assignIfUnassigned(id, actor.userId)) {
      joined = true
      await notice(id, (s) => s.notices.joined, { name })
    } else {
      const now = await load(id)
      if (now.status !== "open") throw ended()
      if (now.assignedTo !== actor.userId) throw taken()
    }
  }
  const chat = await repo.setAi(id, false)
  if (!chat) throw ended()
  return { chat, joined }
}

export async function reply(actor: Actor, id: string, body: string) {
  const name = await actorName(actor)
  await claim(actor, id, name)
  const message = await repo.addMessage({
    conversationId: id,
    sender: "staff",
    senderName: name,
    body,
  })
  if (!message) throw ended()
  // The message text stays out of the audit log.
  await audit(actor, "chat.replied", id)
  return message
}

export async function takeover(actor: Actor, id: string) {
  const { chat } = await claim(actor, id, await actorName(actor))
  await audit(actor, "chat.taken_over", id)
  return { chat: toStaff(chat) }
}

export async function handback(actor: Actor, id: string) {
  const before = await load(id)
  if (before.status !== "open") throw ended()
  if (before.assignedTo !== null && before.assignedTo !== actor.userId) {
    throw new AppError("CONFLICT", "Another team member is on this chat")
  }
  if (!(await bot.isActive())) {
    throw new AppError(
      "CONFLICT",
      "The assistant is switched off or not set up"
    )
  }
  // Nothing to hand back: no notice, no bot run, so repeated clicks are inert.
  if (before.assignedTo === null && before.aiEnabled && !before.needsHuman) {
    return { chat: toStaff(before) }
  }
  // A limit or failed notice is once per chat: the bot would hit it again and
  // stay silent, so it cannot take this chat back.
  if (await repo.hasNotice(id, ["limit", "failed"])) {
    throw new AppError("CONFLICT", "The assistant can't take this chat back")
  }
  if (before.assignedTo !== null && !(await repo.assign(id, null))) {
    throw ended()
  }
  const chat = await repo.setAi(id, true)
  if (!chat) throw ended()
  await notice(id, (s) => s.notices.back)
  await audit(actor, "chat.handed_back", id)
  defer(() => bot.maybeReply(id), "chat.handback")
  return { chat: toStaff(chat) }
}

const canReplyToChats = (user: {
  role: string | null
  banned: boolean | null
}) => !user.banned && hasPermission(parseRoles(user.role), { chat: ["reply"] })

export async function assign(actor: Actor, id: string, userId: string | null) {
  const before = await load(id)
  if (before.status !== "open") throw ended()
  let name: string | null = null
  if (userId) {
    const user = await repo.findStaffUser(userId)
    if (!user) throw new AppError("NOT_FOUND", "User not found")
    if (!canReplyToChats(user)) {
      throw new AppError("VALIDATION_FAILED", "Invalid input", {
        fieldErrors: { userId: ["Choose someone who can reply to chats"] },
      })
    }
    name = user.name
  }
  const chat = await repo.assign(id, userId)
  if (!chat) throw ended()
  await audit(actor, "chat.assigned", id, {
    from: before.assignedTo,
    to: userId,
  })
  return { chat: toStaff(chat), assigneeName: name }
}

// ---------- read, close, delete ----------

export async function read(id: string, upTo: number) {
  await load(id)
  await repo.markRead(id, upTo)
  return { ok: true as const }
}

export async function close(actor: Actor, id: string) {
  await load(id)
  // close() is transition-only: a repeated close adds no notice or audit row.
  if (await repo.close(id)) {
    await notice(id, (s) => s.notices.ended, {}, false)
    await audit(actor, "chat.closed", id)
  }
  return { ok: true as const }
}

export async function remove(actor: Actor, id: string) {
  if (!(await repo.remove(id))) throw notFound()
  await audit(actor, "chat.deleted", id)
  return { ok: true as const }
}

// ---------- privacy requests (C4) ----------

/** Every chat stored under the email, as a JSON download. Audits the count only. */
export async function exportForEmail(actor: Actor, email: string) {
  const chats = await repo.exportForEmail(email)
  await audit(actor, "chat.exported", undefined, { count: chats.length })
  const now = new Date()
  return {
    filename: `chats-${isoDate(now)}.json`,
    data: { email, exportedAt: now.toISOString(), chats },
  }
}

/** Deletes every chat stored under the email. Audits the count only. */
export async function eraseForEmail(actor: Actor, email: string) {
  const erased = await repo.eraseForEmail(email)
  await audit(actor, "chat.erased", undefined, { count: erased })
  return { erased }
}
