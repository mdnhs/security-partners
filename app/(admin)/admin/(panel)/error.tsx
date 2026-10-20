"use client"

import { AdminErrorCard } from "@/components/admin/kit/error-card"

/** Error boundary inside the shell (spec §8.2): retry re-renders the segment. */
export default function PanelError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <AdminErrorCard error={error} retry={retry} />
}
