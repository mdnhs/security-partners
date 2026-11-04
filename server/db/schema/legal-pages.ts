import "server-only"

import { sql } from "drizzle-orm"
import { check, integer, pgTable, text, uuid } from "drizzle-orm/pg-core"

import type { LegalTemplate } from "@/templates/legal/schema"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"
import { users } from "./auth"

/**
 * Admin-managed legal pages served at /<slug> and linked from the footer.
 * Their document is the "legal" template (hero + rich text), exactly like the
 * fixed /privacy and /terms pages; those two stay rows of `pages`.
 */
export const legalPages = pgTable(
  "legal_pages",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    /** Footer order (ascending). */
    sortOrder: integer("sort_order").notNull().default(0),
    ...versioned<LegalTemplate>(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    check(
      "legal_pages_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 60`
    ),
  ]
)
