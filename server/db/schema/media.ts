import "server-only"

import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { id, timestamps } from "./_shared"
import { users } from "./auth"

/** static = shipped in public/ (key is the URL path); disk/r2 come in Phase 6. */
export const MEDIA_DRIVERS = ["static", "disk", "r2"] as const
export const mediaDriver = pgEnum("media_driver", MEDIA_DRIVERS)

export const media = pgTable(
  "media",
  {
    id: id(),
    key: text("key").notNull(),
    driver: mediaDriver("driver").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    blurDataUrl: text("blur_data_url"),
    focalX: real("focal_x"),
    focalY: real("focal_y"),
    alt: text("alt").notNull().default(""),
    /** Purely decorative image: no alt text needed (the alt text entered is kept). */
    isDecorative: boolean("is_decorative").notNull().default(false),
    /** Optional caption (admin). Public templates do not render it. */
    caption: text("caption").notNull().default(""),
    /** File name as uploaded (library/picker label and search); static rows: the public/images name. */
    originalName: text("original_name").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [unique("media_driver_key_unique").on(t.driver, t.key)]
)

/** Where a media row is used; RESTRICT blocks deleting media in use (23503 → 409). */
export const mediaUsages = pgTable(
  "media_usages",
  {
    id: id(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    field: text("field").notNull(),
  },
  (t) => [
    unique("media_usages_unique").on(
      t.mediaId,
      t.entityType,
      t.entityId,
      t.field
    ),
    index("media_usages_entity_idx").on(t.entityType, t.entityId),
  ]
)
