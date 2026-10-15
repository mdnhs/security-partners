import "server-only"

import { integer, jsonb, uuid } from "drizzle-orm/pg-core"

import { contentStatus, tsz } from "./_shared"
import { users } from "./auth"

/**
 * Spec §5.1 versioning columns shared by pages, services and articles:
 * public reads use `published` only; `version` is the optimistic lock.
 */
export const versioned = <T>() => ({
  draft: jsonb("draft").$type<T>().notNull(),
  published: jsonb("published").$type<T>(),
  version: integer("version").notNull().default(1),
  status: contentStatus("status").notNull().default("draft"),
  scheduledAt: tsz("scheduled_at"),
  publishedAt: tsz("published_at"),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
})
