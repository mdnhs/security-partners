"use client"

import { Download } from "lucide-react"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"

import { SECONDARY_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { ApiError, type ApiErrorBody, errorMessage } from "@/lib/api-client"

/**
 * Fetches a CSV export and saves it under the server's filename. An error
 * (403, a 422 for too many rows) is a JSON envelope: shown as a toast
 * instead of being saved as a broken .csv.
 */
export async function downloadCsv(href: string): Promise<void> {
  const res = await fetch(href, { credentials: "same-origin" })
  if (!res.ok) {
    let body: Partial<ApiErrorBody> | null = null
    try {
      body = (await res.json()) as Partial<ApiErrorBody>
    } catch {
      body = null
    }
    throw new ApiError(res.status, body)
  }
  const blob = await res.blob()
  const filename =
    /filename="([^"]+)"/.exec(
      res.headers.get("content-disposition") ?? ""
    )?.[1] ?? "leads.csv"
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Header action that downloads `href`. Never disabled while working (focus
 * would drop to the page); a second press during a download is ignored.
 */
export function CsvDownloadButton({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      className={SECONDARY_ACTION}
      aria-busy={busy || undefined}
      data-href={href}
      onClick={async () => {
        if (busy) return
        setBusy(true)
        try {
          await downloadCsv(href)
        } catch (error) {
          toast.error("Export failed", { description: errorMessage(error) })
        } finally {
          setBusy(false)
        }
      }}
    >
      <Download aria-hidden />
      {children}
    </Button>
  )
}
