"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { api, errorMessage, unwrap } from "@/lib/api-client"

/**
 * Notice while an owner/admin views the admin as another user (spec §6).
 * Rendered in the content column's header wrapper, above the topbar.
 */
export function ImpersonationBanner({ name }: { name: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div
      role="region"
      aria-label="Impersonation"
      className="rounded-card bg-warning-soft text-warning flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3 text-sm font-medium"
    >
      <span className="flex items-center gap-2">
        <Eye aria-hidden className="size-4" />
        You are viewing the admin as {name}. Changes are made as this user.
      </span>
      {error ? <span role="alert">{error}</span> : null}
      <Button
        size="sm"
        variant="outline"
        className="border-warning/40 text-warning hover:bg-warning/10 hover:text-warning rounded-lg bg-transparent"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          try {
            await unwrap(api.users["stop-impersonating"].$post())
            // Every cached query belongs to the impersonated user.
            queryClient.clear()
            router.replace("/admin")
            router.refresh()
          } catch (err) {
            setError(errorMessage(err))
            setPending(false)
          }
        }}
      >
        Stop impersonating
      </Button>
    </div>
  )
}
