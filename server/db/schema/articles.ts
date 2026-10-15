import "server-only"

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"

import type { Seo } from "@/lib/schemas/common"
import type { ArticleContent } from "@/lib/schemas/content/article"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"
import { users } from "./auth"

export const articleCategories = pgTable(
  "article_categories",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    showInFilter: boolean("show_in_filter").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    check(
      "article_categories_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`
    ),
  ]
)

export const articles = pgTable(
  "articles",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => articleCategories.id, { onDelete: "restrict" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Computed from the body on save (Phase 5); null = not shown. */
    readTimeMinutes: integer("read_time_minutes"),
    seo: jsonb("seo").$type<Seo>().notNull().default({}),
    ...versioned<ArticleContent>(),
    ...timestamps(),
  },
  (t) => [
    check("articles_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    index("articles_published_at_idx").on(t.publishedAt),
    index("articles_category_id_idx").on(t.categoryId),
    index("articles_author_id_idx").on(t.authorId),
  ]
)
