"use client"

import { ExternalLink } from "lucide-react"

import { buttonClassName } from "@/components/ui/button"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

/**
 * "Your website" card above the user menu: the public site's host and a
 * View site link. In the icon rail it shrinks to a single icon link.
 */
export function WebsiteCard({ siteHost }: { siteHost: string }) {
  return (
    <>
      <div className="rounded-xl bg-sidebar-accent p-3 group-data-[collapsible=icon]:hidden">
        <p className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/75">
          <span
            aria-hidden
            className="size-2 rounded-full bg-sidebar-primary"
          />
          Live
        </p>
        <p className="mt-1.5 text-sm leading-tight font-bold text-white">
          Your website
        </p>
        <p className="truncate text-xs text-sidebar-foreground/70">
          {siteHost}
        </p>
        <a
          href="/"
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
            render={<a href="/" target="_blank" rel="noreferrer" />}
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
