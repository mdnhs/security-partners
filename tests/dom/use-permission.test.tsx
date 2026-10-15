import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import { AdminSessionProvider } from "@/components/admin/session-provider"
import { usePermission } from "@/hooks/use-permission"
import type { PermissionRequest } from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"

const can = (roles: Role[], req: PermissionRequest) =>
  renderHook(() => usePermission(req), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AdminSessionProvider
        value={{
          user: {
            id: "u1",
            name: "U",
            email: "u@example.test",
            title: null,
            twoFactorEnabled: false,
          },
          roles,
          impersonatedBy: null,
        }}
      >
        {children}
      </AdminSessionProvider>
    ),
  }).result.current

describe("usePermission", () => {
  it("answers from the session's roles", () => {
    expect(can(["editor"], { page: ["read"] })).toBe(true)
    expect(can(["viewer"], { page: ["read"] })).toBe(true)
    expect(can(["intake"], { page: ["read"] })).toBe(false)
    expect(can(["author", "marketer"], { service: ["read"] })).toBe(true)
  })

  it("throws outside the admin shell", () => {
    expect(() => renderHook(() => usePermission({ page: ["read"] }))).toThrow(
      "useAdminSession must be used inside <AdminShell>"
    )
  })
})
