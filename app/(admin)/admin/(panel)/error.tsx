"use client"

import { useEffect } from "react"

import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"

/** Error boundary inside the shell (spec §8.2): retry re-renders the segment. */
export default function PanelError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <section
      role="alert"
      className="rounded-card mx-auto flex max-w-md flex-col items-center gap-4 bg-card px-8 py-12 text-center"
    >
      <h1 className="text-card-title">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This part of the admin didn&apos;t load. Nothing you saved is lost.
        {error.digest ? (
          <>
            {" "}
            Reference <code className="font-mono">{error.digest}</code>.
          </>
        ) : null}
      </p>
      <Button type="button" className={FORM_ACTION} onClick={() => retry()}>
        Try again
      </Button>
    </section>
  )
}
