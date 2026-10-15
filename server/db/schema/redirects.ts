import "server-only"

import { sql } from "drizzle-orm"
import { check, integer, pgTable, text } from "drizzle-orm/pg-core"

import { id, timestamps } from "./_shared"

export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    code: integer("code").notNull().default(301),
    hits: integer("hits").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    check("redirects_code", sql`${t.code} in (301, 302)`),
    check("redirects_not_self", sql`${t.fromPath} <> ${t.toPath}`),
    check("redirects_from_path_absolute", sql`${t.fromPath} like '/%'`),
  ]
)
