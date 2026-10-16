"use client"

import { useQueryClient } from "@tanstack/react-query"
import { createContext, type ReactNode, useContext, useState } from "react"

import { useSignOut } from "@/components/admin/auth/sign-out-button"

/** Which control started the sign-out: its failure shows beside it. */
export type SignOutSource = "menu" | "dock"

type ShellSignOut = {
  signOut(source: SignOutSource): void
  pending: boolean
  /** The failure, if any, and the control it belongs to. */
  error: { message: string; source: SignOutSource } | null
  clearError(): void
}

const SignOutContext = createContext<ShellSignOut | null>(null)

/**
 * One sign-out flow for the topbar's user menu and the sidebar's dock:
 * a pending sign-out disables both, and the query cache is cleared on
 * success (the next user must never see this user's cached data).
 */
export function ShellSignOutProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { signOut, pending, error, clearError } = useSignOut(() =>
    queryClient.clear()
  )
  const [source, setSource] = useState<SignOutSource>("menu")
  const value: ShellSignOut = {
    signOut(from) {
      setSource(from)
      void signOut()
    },
    pending,
    error: error ? { message: error, source } : null,
    clearError,
  }
  return (
    <SignOutContext.Provider value={value}>{children}</SignOutContext.Provider>
  )
}

export function useShellSignOut(): ShellSignOut {
  const state = useContext(SignOutContext)
  if (!state)
    throw new Error("useShellSignOut must be used inside <AdminShell>")
  return state
}
