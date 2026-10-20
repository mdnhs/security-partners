"use client"

import { createContext, type ReactNode, useContext } from "react"

import type { Role } from "@/lib/auth/roles"

/** What the admin UI knows about the signed-in user (from requireSession()). */
export type AdminSession = {
  user: {
    id: string
    name: string
    email: string
    title: string | null
    twoFactorEnabled: boolean
  }
  roles: Role[]
  /** Set while an owner/admin is viewing the admin as this user. */
  impersonatedBy: string | null
}

const AdminSessionContext = createContext<AdminSession | null>(null)

export function AdminSessionProvider({
  value,
  children,
}: {
  value: AdminSession
  children: ReactNode
}) {
  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  )
}

export function useAdminSession(): AdminSession {
  const session = useContext(AdminSessionContext)
  if (!session)
    throw new Error("useAdminSession must be used inside <AdminShell>")
  return session
}

/** The session when rendered inside the admin shell, otherwise null (shared widgets in tests). */
export function useOptionalAdminSession(): AdminSession | null {
  return useContext(AdminSessionContext)
}
