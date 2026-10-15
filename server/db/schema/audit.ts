import "server-only"

import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { id, tsz } from "./_shared"
import { users } from "./auth"

/** Append-only audit trail (spec §5.5, §6). Rows are never updated. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    impersonatorId: uuid("impersonator_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    diff: jsonb("diff"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_at_idx").on(t.createdAt),
    index("audit_log_actor_id_idx").on(t.actorId),
    index("audit_log_action_idx").on(t.action),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
  ]
)
