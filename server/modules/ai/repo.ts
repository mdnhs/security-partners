import "server-only"

import { and, asc, count, desc, eq, inArray } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { aiConversations, aiMessages } from "@/server/db/schema"

export type ChatRole = "user" | "assistant"

export type ConversationRow = {
  id: string
  userId: string
  title: string
  createdAt: Date
  updatedAt: Date
}

export type MessageRow = {
  id: string
  role: ChatRole
  content: string
  createdAt: Date
}

const CHAT_ROLES: ChatRole[] = ["user", "assistant"]

const conversationColumns = {
  id: aiConversations.id,
  userId: aiConversations.userId,
  title: aiConversations.title,
  createdAt: aiConversations.createdAt,
  updatedAt: aiConversations.updatedAt,
}

const messageColumns = {
  id: aiMessages.id,
  role: aiMessages.role,
  content: aiMessages.content,
  createdAt: aiMessages.createdAt,
}

export async function insertConversation(
  db: DbOrTx,
  row: { userId: string; title: string; context: unknown }
): Promise<ConversationRow> {
  const [created] = await db
    .insert(aiConversations)
    .values(row)
    .returning(conversationColumns)
  return created
}

/** The user's own conversation; another user's id reads as missing. */
export async function findConversation(
  db: DbOrTx,
  id: string,
  userId: string
): Promise<ConversationRow | null> {
  const [row] = await db
    .select(conversationColumns)
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
  return row ?? null
}

export async function touchConversation(db: DbOrTx, id: string): Promise<void> {
  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, id))
}

/** The user's conversations, most recently used first. */
export async function listConversationRows(
  db: DbOrTx,
  userId: string,
  page: { page: number; pageSize: number }
): Promise<{ rows: ConversationRow[]; total: number }> {
  const where = eq(aiConversations.userId, userId)
  const rows = await db
    .select(conversationColumns)
    .from(aiConversations)
    .where(where)
    .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
    .limit(page.pageSize)
    .offset((page.page - 1) * page.pageSize)
  const [{ total }] = await db
    .select({ total: count() })
    .from(aiConversations)
    .where(where)
  return { rows, total }
}

/** Deletes the user's own conversation (its messages cascade). */
export async function deleteConversationRow(
  db: DbOrTx,
  id: string,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning({ id: aiConversations.id })
  return deleted.length > 0
}

export async function insertMessage(
  db: DbOrTx,
  row: { conversationId: string; role: ChatRole; content: string }
): Promise<MessageRow> {
  const [created] = await db
    .insert(aiMessages)
    .values(row)
    .returning(messageColumns)
  return created as MessageRow
}

/** Every user/assistant message of a conversation, oldest first. */
export async function listMessageRows(
  db: DbOrTx,
  conversationId: string
): Promise<MessageRow[]> {
  const rows = await db
    .select(messageColumns)
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        inArray(aiMessages.role, CHAT_ROLES)
      )
    )
    .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id))
  return rows as MessageRow[]
}

/** The last `limit` user/assistant messages, oldest first (the model's history). */
export async function recentMessageRows(
  db: DbOrTx,
  conversationId: string,
  limit: number
): Promise<MessageRow[]> {
  const rows = await db
    .select(messageColumns)
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        inArray(aiMessages.role, CHAT_ROLES)
      )
    )
    .orderBy(desc(aiMessages.createdAt), desc(aiMessages.id))
    .limit(limit)
  return (rows as MessageRow[]).reverse()
}
