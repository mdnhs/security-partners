import "server-only"

import { sql } from "drizzle-orm"
import { boolean, check, integer, pgTable, text } from "drizzle-orm/pg-core"

import { id, timestamps, tsz } from "./_shared"

export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    code: integer("code").notNull().default(301),
    hits: integer("hits").notNull().default(0),
    /** Off: kept in the list but never resolved (proxy.ts). */
    isActive: boolean("is_active").notNull().default(true),
    note: text("note").notNull().default(""),
    /** Set with each counted hit; null = never hit. No visitor data is kept. */
    lastHitAt: tsz("last_hit_at"),
    /** manual (admin form), auto (rename/delete of a live page), import (CSV). */
    source: text("source")
      .$type<"manual" | "auto" | "import">()
      .notNull()
      .default("manual"),
    ...timestamps(),
  },
  (t) => [
    check("redirects_code", sql`${t.code} in (301, 302, 307, 308)`),
    check("redirects_source", sql`${t.source} in ('manual', 'auto', 'import')`),
    check("redirects_not_self", sql`${t.fromPath} <> ${t.toPath}`),
    check("redirects_from_path_absolute", sql`${t.fromPath} like '/%'`),
  ]
)
