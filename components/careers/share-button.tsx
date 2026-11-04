"use client"

import { Share2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

/**
 * Shares the job page: the system share sheet where there is one, else the
 * address goes to the clipboard and a short "Link copied" note is announced.
 */
export function ShareButton({
  path,
  title,
  label,
  copiedLabel,
  className,
  iconClassName = "size-4",
}: {
  path: string
  title: string
  label: string
  copiedLabel: string
  className?: string
  iconClassName?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function share() {
    const url = new URL(path, window.location.origin).toString()
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        // Closing the sheet is not a failure; anything else falls back to copy.
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2500)
    } catch {
      // No clipboard either (insecure origin): nothing more to offer.
    }
  }

  return (
    <button type="button" onClick={share} className={className}>
      <Share2 aria-hidden className={iconClassName} />
      <span>{copied ? copiedLabel : label}</span>
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </button>
  )
}
