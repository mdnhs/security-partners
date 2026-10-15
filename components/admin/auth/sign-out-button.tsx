"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
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

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          const failure = await signOutOrError()
          if (failure) {
            setError(failure)
            setPending(false)
            return
          }
          router.replace("/admin/sign-in?notice=signed-out")
          router.refresh()
        }}
      >
        <LogOut aria-hidden />
        Sign out
      </Button>
    </div>
  )
}
