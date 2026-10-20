"use client"

import { useAdminSession } from "@/components/admin/session-provider"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

/**
 * UI convenience only (hide buttons the user cannot use). The API checks
 * every request again with can() and the services.
 */
export function usePermission(req: PermissionRequest): boolean {
  const { roles } = useAdminSession()
  return hasPermission(roles, req)
}
