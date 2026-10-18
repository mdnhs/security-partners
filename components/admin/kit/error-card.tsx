"use client"

import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"

/**
 * The admin's error-boundary card (spec §8.2 "error boundaries with
 * retry"): what happened, the digest to quote, and Try again.
 */
export function AdminErrorCard({
  error,
  retry,
  description = "This part of the admin didn't load. Nothing you saved is lost.",
}: {
  error: Error & { digest?: string }
  retry: () => void
  description?: string
}) {
  // Next already reports the error (digest); nothing is logged twice here.
  return (
    <section
      role="alert"
      className="rounded-card mx-auto flex max-w-md flex-col items-center gap-4 bg-card px-8 py-12 text-center"
    >
      <h1 className="text-card-title">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {description}
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
