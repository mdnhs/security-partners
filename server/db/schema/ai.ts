import "server-only"

import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { id, timestamps, tsz } from "./_shared"
import { users } from "./auth"

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    context: jsonb("context"),
    ...timestamps(),
  },
  (t) => [index("ai_conversations_user_id_idx").on(t.userId)]
)

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_messages_conversation_id_idx").on(t.conversationId)]
)
