import "server-only"

import { jsonb, pgTable, text } from "drizzle-orm/pg-core"

import type { Seo } from "@/lib/schemas/common"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"

/** Fixed-template pages (spec §5.2). Rows are seeded; the admin never creates or deletes them. */
export const pages = pgTable("pages", {
  id: id(),
  key: text("key").notNull().unique(),
  template: text("template").notNull(),
  seo: jsonb("seo").$type<Seo>().notNull().default({}),
  ...versioned<unknown>(),
  ...timestamps(),
})
