import "server-only"

import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { id, tsz } from "./_shared"
import { users } from "./auth"

/** Snapshot per publish/collection change (spec §5.1). */
export const revisions = pgTable(
  "revisions",
  {
    id: id(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    version: integer("version").notNull(),
    data: jsonb("data").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("revisions_entity_idx").on(t.entityType, t.entityId, t.version)]
)
