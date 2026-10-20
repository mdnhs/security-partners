import type { InferResponseType } from "hono/client"

import type { api } from "@/lib/api-client"

/** One audit row as GET /api/v1/admin/audit returns it. */
export type AuditItem = InferResponseType<
  typeof api.audit.$get,
  200
>["items"][number]
