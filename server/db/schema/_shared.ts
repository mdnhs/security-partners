import "server-only"

import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core"
import { uuidv7 } from "uuidv7"

export const CONTENT_STATUSES = [
  "draft",
  "in_review",
  "scheduled",
  "published",
] as const
export const contentStatus = pgEnum("content_status", CONTENT_STATUSES)
export const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7())
export const tsz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })
export const timestamps = () => ({
  createdAt: tsz("created_at").notNull().defaultNow(),
  updatedAt: tsz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
