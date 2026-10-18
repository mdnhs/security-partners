import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm"

import {
  type LeadEventType,
  type LeadStatus,
  type LeadStatusFilter,
  OPEN_LEAD_STATUSES,
} from "@/lib/schemas/api/leads"
import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { leadEvents, leads, users } from "@/server/db/schema"

export type LeadRow = typeof leads.$inferSelect
export type NewLeadRow = typeof leads.$inferInsert

export async function insertLead(
  db: DbOrTx,
  row: NewLeadRow
): Promise<LeadRow> {
  const [inserted] = await db.insert(leads).values(row).returning()
  return inserted
}

export async function insertLeadEvent(
  db: DbOrTx,
  row: {
    leadId: string
    type: LeadEventType
    body: string | null
    actorId: string | null
  }
): Promise<void> {
  await db.insert(leadEvents).values(row)
}

export type LeadFilters = {
  status?: LeadStatusFilter
  /** user id, or "none" for unassigned */
  assigneeId?: string
  q?: string
  from?: Date
  to?: Date
  email?: string
}
export type LeadSortField = "createdAt" | "name" | "status"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

function whereFor(f: LeadFilters): SQL | undefined {
  const c: (SQL | undefined)[] = []
  if (f.status === "open")
    c.push(inArray(leads.status, [...OPEN_LEAD_STATUSES]))
  else if (f.status && f.status !== "all") c.push(eq(leads.status, f.status))
  else if (!f.status && !f.email) c.push(ne(leads.status, "spam"))
  if (f.assigneeId === "none") c.push(isNull(leads.assigneeId))
  else if (f.assigneeId) c.push(eq(leads.assigneeId, f.assigneeId))
  if (f.q) {
    const p = `%${escapeLike(f.q)}%`
    c.push(
      or(
        ilike(leads.name, p),
        ilike(leads.email, p),
        ilike(leads.company, p),
        ilike(leads.phone, p)
      )
    )
  }
  if (f.email) c.push(sql`lower(${leads.email}) = ${f.email.toLowerCase()}`)
  if (f.from) c.push(gte(leads.createdAt, f.from))
  if (f.to) c.push(lte(leads.createdAt, f.to))
  return and(...c)
}

const leadColumns = {
  id: leads.id,
  name: leads.name,
  email: leads.email,
  phone: leads.phone,
  company: leads.company,
  service: leads.service,
  message: leads.message,
  consent: leads.consent,
  status: leads.status,
  sourcePage: leads.sourcePage,
  assigneeId: leads.assigneeId,
  assigneeName: users.name,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
}
export type LeadWithAssignee = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  service: string | null
  message: string
  consent: boolean
  status: LeadStatus
  sourcePage: string | null
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  updatedAt: Date
}

export async function listLeadRows(
  db: DbOrTx,
  opts: {
    filters: LeadFilters
    sort: Sort<LeadSortField>
    page: number
    pageSize: number
  }
): Promise<{ rows: LeadWithAssignee[]; total: number }> {
  const where = whereFor(opts.filters)
  const [{ total }] = await db
    .select({ total: count() })
    .from(leads)
    .where(where)
  const column =
    opts.sort.field === "name"
      ? leads.name
      : opts.sort.field === "status"
        ? leads.status
        : leads.createdAt
  const rows = await db
    .select(leadColumns)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      desc(leads.id)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

export async function findLeadRow(
  db: DbOrTx,
  id: string
): Promise<LeadWithAssignee | null> {
  const [row] = await db
    .select(leadColumns)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(eq(leads.id, id))
  return row ?? null
}

export async function listLeadEventRows(db: DbOrTx, leadId: string) {
  return db
    .select({
      id: leadEvents.id,
      type: leadEvents.type,
      body: leadEvents.body,
      actorId: leadEvents.actorId,
      actorName: users.name,
      createdAt: leadEvents.createdAt,
    })
    .from(leadEvents)
    .leftJoin(users, eq(users.id, leadEvents.actorId))
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(asc(leadEvents.createdAt), asc(leadEvents.id))
}

/** Row-locks the lead for the rest of the transaction (concurrent PATCH/notes). */
export async function lockLeadRow(
  db: DbOrTx,
  id: string
): Promise<{ status: LeadStatus; assigneeId: string | null } | null> {
  const [row] = await db
    .select({ status: leads.status, assigneeId: leads.assigneeId })
    .from(leads)
    .where(eq(leads.id, id))
    .for("update")
  return row ?? null
}

export async function updateLeadRow(
  db: DbOrTx,
  id: string,
  patch: { status?: LeadStatus; assigneeId?: string | null }
): Promise<void> {
  await db.update(leads).set(patch).where(eq(leads.id, id))
}

export async function deleteLeadRow(db: DbOrTx, id: string): Promise<boolean> {
  const rows = await db
    .delete(leads)
    .where(eq(leads.id, id))
    .returning({ id: leads.id })
  return rows.length > 0
}

export async function exportLeadRows(
  db: DbOrTx,
  filters: LeadFilters,
  limit: number
): Promise<LeadWithAssignee[]> {
  return db
    .select(leadColumns)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(whereFor(filters))
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(limit)
}

export async function listNoteRows(db: DbOrTx, leadIds: readonly string[]) {
  if (leadIds.length === 0) return []
  return db
    .select({
      leadId: leadEvents.leadId,
      body: leadEvents.body,
      actorName: users.name,
      createdAt: leadEvents.createdAt,
    })
    .from(leadEvents)
    .leftJoin(users, eq(users.id, leadEvents.actorId))
    .where(
      and(inArray(leadEvents.leadId, [...leadIds]), eq(leadEvents.type, "note"))
    )
    .orderBy(asc(leadEvents.createdAt), asc(leadEvents.id))
}

export async function listStaffUsers(db: DbOrTx) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      banned: users.banned,
    })
    .from(users)
    .orderBy(asc(users.name))
}

export async function findStaffUser(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      banned: users.banned,
    })
    .from(users)
    .where(eq(users.id, id))
  return row ?? null
}

export async function countUnassignedNewLeads(db: DbOrTx): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(eq(leads.status, "new"), isNull(leads.assigneeId)))
  return total
}

/** Retention purge: leads created before `cutoff` (their events cascade). */
export async function deleteLeadsCreatedBefore(
  db: DbOrTx,
  cutoff: Date
): Promise<number> {
  const rows = await db
    .delete(leads)
    .where(lt(leads.createdAt, cutoff))
    .returning({ id: leads.id })
  return rows.length
}
