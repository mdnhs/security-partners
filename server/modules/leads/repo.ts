import "server-only"

import type { LeadEventType } from "@/lib/schemas/api/leads"
import type { DbOrTx } from "@/server/db/client"
import { leadEvents, leads } from "@/server/db/schema"

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
