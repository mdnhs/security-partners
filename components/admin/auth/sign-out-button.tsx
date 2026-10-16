"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { authClient, authErrorMessage } from "@/lib/auth-client"

/** Signs out; resolves to an error message, or null when the session ended. */
export async function signOutOrError(): Promise<string | null> {
  try {
    const { error } = await authClient.signOut()
    return error ? authErrorMessage(error) : null
  } catch {
    return authErrorMessage(null)
  }
}

/**
 * Sign-out flow for any control: ends the session, runs `onSignedOut`, then
 * leaves for the sign-in page. A failure keeps the user here with `error`.
 */
export function useSignOut(onSignedOut?: () => void) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function signOut() {
    setPending(true)
    setError(null)
    const failure = await signOutOrError()
    if (failure) {
      setError(failure)
      setPending(false)
      return
    }
    onSignedOut?.()
    router.replace("/admin/sign-in?notice=signed-out")
    router.refresh()
  }
  return { signOut, pending, error }
}
