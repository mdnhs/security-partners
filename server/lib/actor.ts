import "server-only"

import type { Role } from "@/lib/auth/roles"

/** Who is performing a service call. Built from the session in Phase 2 (server/auth/session.ts). */
export type Actor = {
  userId: string
  roles: Role[]
  ip: string | null
  userAgent: string | null
  impersonatorId: string | null
}
