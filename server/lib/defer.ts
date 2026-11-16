import "server-only"

import { after } from "next/server"

// Work after the response (live chat plan C5). Failures are logged, never
// surfaced: the visitor's request already succeeded. Only the error's name
// is logged: a query error's message carries SQL params (chat text).
export function defer(task: () => Promise<unknown>, label: string) {
  after(() =>
    task().catch((error: unknown) =>
      console.error(
        `[defer] ${label} failed:`,
        error instanceof Error ? error.name : typeof error
      )
    )
  )
}
