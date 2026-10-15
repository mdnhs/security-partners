import "server-only"

import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"

import { id, timestamps, tsz } from "./_shared"
import { users } from "./auth"

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
  "spam",
] as const
export const leadStatus = pgEnum("lead_status", LEAD_STATUSES)

export const leads = pgTable(
  "leads",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    company: text("company"),
    service: text("service"),
    message: text("message").notNull(),
    consent: boolean("consent").notNull().default(false),
    status: leadStatus("status").notNull().default("new"),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourcePage: text("source_page"),
    /** HMAC of the client IP (HKDF purpose "lead-ip"), never the raw IP. */
    ipHash: text("ip_hash"),
    ...timestamps(),
  },
  (t) => [
    index("leads_created_at_idx").on(t.createdAt),
    index("leads_status_idx").on(t.status),
  ]
)

export const leadEvents = pgTable(
  "lead_events",
  {
    id: id(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    body: text("body"),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("lead_events_lead_id_idx").on(t.leadId)]
)
