import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"

import { Swirl } from "@/components/admin/kit/swirl"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { SiteInfo } from "./constants"

const STATUS: Record<SiteInfo["env"], { label: string; dot: string }> = {
  production: { label: "Live", dot: "bg-chart-3" },
  staging: { label: "Staging", dot: "bg-amber-400" },
  development: { label: "Development", dot: "bg-white/60" },
}

/** "https://example.ie/x" → "example.ie"; "" for a relative or bad URL. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ""
  }
}

/**
 * "Your website" promo card (navy gradient, swirl): which environment this
 * admin edits, the site's host, Open site, and the footer dock below.
 * Hidden in the icon rail, where the dock stands alone.
 */
export function WebsiteCard({
  site,
  children,
}: {
  site: SiteInfo
  children?: ReactNode
}) {
  const status = STATUS[site.env]
  const host = hostOf(site.url)
  return (
    <div className="bg-promo relative isolate overflow-hidden rounded-[18px] p-5 group-data-[collapsible=icon]:hidden">
      <Swirl className="absolute inset-0 -z-10 size-full" />
      <p className="flex items-center gap-2 text-xs font-medium opacity-80">
        <span aria-hidden className={cn("size-2 rounded-full", status.dot)} />
        {status.label}
      </p>
      <p className="mt-3 text-lg leading-tight font-semibold">Your website</p>
      {host ? <p className="mt-1 truncate text-xs opacity-75">{host}</p> : null}
      <a
        href={site.url}
        target="_blank"
        rel="noreferrer"
        data-slot="button"
        className={cn(
          buttonVariants(),
          "mt-4 h-11 w-full rounded-xl font-semibold"
        )}
      >
        Open site
        <ExternalLink aria-hidden data-icon="inline-end" />
        {/* Whitespace-only text is dropped by the flex layout. */}{" "}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}
