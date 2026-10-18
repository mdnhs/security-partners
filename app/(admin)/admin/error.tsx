"use client"

import { AdminErrorCard } from "@/components/admin/kit/error-card"

/**
 * Error boundary above the panel layout and the sign-in pages (final review
 * I7): the shell itself failed (session, site settings), so there is no
 * sidebar; the card sits on the admin canvas, in the admin theme (the root
 * admin layout still renders around it). Retry re-renders the segment.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <main
      id="main"
      className="flex min-h-svh items-center justify-center bg-sidebar p-4"
    >
      <AdminErrorCard
        error={error}
        retry={retry}
        description="The admin didn't load. Nothing you saved is lost."
      />
    </main>
  )
}
