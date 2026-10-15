import "server-only"

import { integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { tsz } from "./_shared"
import { users } from "./auth"

/** Globals (spec §5.4): content keys are draft/published; integrations (Phase 7) store encrypted values in `draft`. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  draft: jsonb("draft").notNull(),
  published: jsonb("published"),
  version: integer("version").notNull().default(1),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: tsz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
