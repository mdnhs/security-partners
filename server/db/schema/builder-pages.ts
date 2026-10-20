import "server-only"

import { sql } from "drizzle-orm"
import { check, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import type { DraftDocument } from "@/blocks/document"
import type { Seo } from "@/lib/schemas/common"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"
import { users } from "./auth"

/**
 * Page-builder pages at /p/<slug> (spec §7.5). Kept apart from `pages` so
 * the eight fixed pages, their keys and routes stay as they are. `draft`
 * is the loose working copy (DraftDocument); `published` always passed
 * validateDocument (BuilderDocument).
 */
export const builderPages = pgTable(
  "builder_pages",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    seo: jsonb("seo").$type<Seo>().notNull().default({}),
    ...versioned<DraftDocument>(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    check(
      "builder_pages_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 60`
    ),
  ]
)
