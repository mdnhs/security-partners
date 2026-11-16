import "server-only"

import { sql } from "drizzle-orm"
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { tsz } from "./_shared"
import { users } from "./auth"

// Live chat (docs/superpowers/plans/2026-11-14-live-chat.md). Visitors are
// anonymous: they hold only the raw token (cookie `cp_chat`); its sha256 hash
// is stored. Retention (settings.chat.retentionMonths) purges whole chats.
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status").notNull().default("open"),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    needsHuman: boolean("needs_human").notNull().default(false),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    visitorName: text("visitor_name").notNull(),
    visitorEmail: text("visitor_email"),
    consentAt: tsz("consent_at").notNull(),
    // Path only, never the query string or hash.
    sourcePath: text("source_path"),
    aiReplyCount: integer("ai_reply_count").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),
    // The bot holds this lease while it answers, so two requests never reply
    // twice (no process-local state).
    aiLeaseUntil: tsz("ai_lease_until"),
    lastMessageAt: tsz("last_message_at").notNull().defaultNow(),
    lastVisitorMessageAt: tsz("last_visitor_message_at"),
    // Last reply from staff or the AI.
    lastReplyAt: tsz("last_reply_at"),
    staffReadAt: tsz("staff_read_at"),
    noReplyAlertedAt: tsz("no_reply_alerted_at"),
    needsHumanAlertedAt: tsz("needs_human_alerted_at"),
    createdAt: tsz("created_at").notNull().defaultNow(),
    closedAt: tsz("closed_at"),
  },
  (t) => [
    check(
      "chat_conversations_status_check",
      sql`${t.status} in ('open','closed')`
    ),
    check(
      "chat_conversations_source_path_check",
      sql`${t.sourcePath} is null or char_length(${t.sourcePath}) <= 200`
    ),
    index("chat_conversations_status_last_idx").on(
      t.status,
      t.lastMessageAt.desc()
    ),
    index("chat_conversations_email_idx").on(sql`lower(${t.visitorEmail})`),
  ]
)

// `id` is the polling cursor, so it must be monotonic: bigserial.
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    sender: text("sender").notNull(),
    senderName: text("sender_name"),
    body: text("body").notNull(),
    // Set only on the once-per-chat notices (handoff, limit, failed): the
    // partial unique index below lets each be written at most once. The
    // joined, back and ended notices leave it null because they can recur
    // (joined once per claim, back once per handback).
    noticeKind: text("notice_kind"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "chat_messages_sender_check",
      sql`${t.sender} in ('visitor','staff','ai','system')`
    ),
    check("chat_messages_body_check", sql`char_length(${t.body}) <= 2000`),
    uniqueIndex("chat_messages_notice_once_idx")
      .on(t.conversationId, t.noticeKind)
      .where(sql`${t.noticeKind} is not null`),
    index("chat_messages_conversation_idx").on(t.conversationId, t.id),
  ]
)

// Which staff member has the inbox open; read to decide "someone is online".
export const chatPresence = pgTable("chat_presence", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  seenAt: tsz("seen_at").notNull().defaultNow(),
})
