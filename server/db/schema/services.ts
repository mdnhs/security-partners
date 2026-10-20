import "server-only"

import { sql } from "drizzle-orm"
import { check, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"

import type { Seo } from "@/lib/schemas/common"
import type { ServiceContent } from "@/lib/schemas/content/service"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"

export const services = pgTable(
  "services",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    seo: jsonb("seo").$type<Seo>().notNull().default({}),
    ...versioned<ServiceContent>(),
    ...timestamps(),
  },
  (t) => [
    check("services_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ]
)
