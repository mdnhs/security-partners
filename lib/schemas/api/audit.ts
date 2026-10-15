import { z } from "zod"

import { listQuery, sortParam } from "./list"

/** GET /api/v1/admin/audit query. Dates are ISO 8601 with offset (the UI sends UTC "Z"). */
export const auditListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "action"], { field: "createdAt", dir: "desc" }),
  actor: z.uuid().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(50).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
})

export type AuditListQuery = z.output<typeof auditListQuery>
