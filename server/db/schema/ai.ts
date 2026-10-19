import "server-only"

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"

import { id, timestamps, tsz } from "./_shared"
import { users } from "./auth"

export const AI_MESSAGE_ROLES = ["user", "assistant", "system", "tool"] as const
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number]

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
    role: text("role").$type<AiMessageRole>().notNull(),
    content: text("content").notNull(),
    /**
     * An answer written while enquiry details were shared with the model
     * (the owner switch was on and it read them). Left out of the model's
     * history once the switch is off.
     */
    enquiryDetails: boolean("enquiry_details").notNull().default(false),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_messages_conversation_id_idx").on(t.conversationId),
    check(
      "ai_messages_role",
      sql`${t.role} in ('user', 'assistant', 'system', 'tool')`
    ),
  ]
)
