"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await authClient.signOut()
        router.replace("/admin/sign-in?notice=signed-out")
        router.refresh()
      }}
    >
      <LogOut aria-hidden />
      Sign out
    </Button>
  )
}
