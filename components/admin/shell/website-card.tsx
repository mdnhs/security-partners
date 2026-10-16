"use client"

import { ExternalLink } from "lucide-react"

import { buttonClassName } from "@/components/ui/button"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import type { SiteInfo } from "./constants"

const STATUS: Record<SiteInfo["env"], { label: string; dot: string }> = {
  production: { label: "Live", dot: "bg-sidebar-primary" },
  staging: { label: "Staging", dot: "bg-amber-400" },
  development: { label: "Development", dot: "bg-sidebar-foreground/50" },
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
 * "Your website" card above the user menu: which environment this admin
 * edits, the public site's host and a View site link. In the icon rail it
 * shrinks to a single icon link.
 */
export function WebsiteCard({ site }: { site: SiteInfo }) {
  const status = STATUS[site.env]
  const host = hostOf(site.url)
  return (
    <>
      <div className="rounded-xl bg-sidebar-accent p-3 group-data-[collapsible=icon]:hidden">
        <p className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/75">
          <span aria-hidden className={cn("size-2 rounded-full", status.dot)} />
          {status.label}
        </p>
        <p className="mt-1.5 text-sm leading-tight font-bold text-white">
          Your website
        </p>
        {host ? (
          <p className="truncate text-xs text-sidebar-foreground/70">{host}</p>
        ) : null}
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonClassName({ size: "sm" }),
            "mt-3 w-full bg-sidebar-primary font-bold text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
          )}
        >
          View site
          <ExternalLink aria-hidden />{" "}
          <span className="sr-only">(opens in new tab)</span>
        </a>
      </div>
      <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="View site"
            render={<a href={site.url} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink aria-hidden />
            <span>
              View site <span className="sr-only">(opens in new tab)</span>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}
