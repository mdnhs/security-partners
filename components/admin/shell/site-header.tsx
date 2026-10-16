"use client"

import { ChevronRight, ExternalLink } from "lucide-react"
import { usePathname } from "next/navigation"

import { useAdminSession } from "@/components/admin/session-provider"
import { buttonClassName } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { CommandPalette } from "./command-palette"
import { isActiveItem, navItems } from "./nav"

/** Where the current page sits in the navigation (section › item), if anywhere. */
function useNavTrail(): { section: string; item: string } | null {
  const pathname = usePathname()
  const { roles } = useAdminSession()
  for (const section of navItems(roles)) {
    const item = section.items.find((entry) => isActiveItem(entry, pathname))
    if (item) return { section: section.label, item: item.label }
  }
  return null
}

/** Content-column header (dashboard-01): sidebar toggle, breadcrumb, ⌘K, site link. */
export function SiteHeader() {
  const trail = useNavTrail()
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mx-1 h-4 data-vertical:self-auto max-md:hidden"
      />
      {trail ? (
        <nav aria-label="Breadcrumb" className="min-w-0 max-md:hidden">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <li>{trail.section}</li>
            <li aria-hidden>
              <ChevronRight className="size-3.5" />
            </li>
            <li
              aria-current="page"
              className="truncate font-medium text-foreground"
            >
              {trail.item}
            </li>
          </ol>
        </nav>
      ) : null}
      <div className="flex min-w-0 flex-1 justify-end md:justify-center">
        <CommandPalette />
      </div>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className={buttonClassName({ variant: "ghost", size: "sm" })}
      >
        <ExternalLink aria-hidden />
        <span className="max-sm:sr-only">View site</span>
        {/* Whitespace-only text is dropped by the flex layout. */}{" "}
        <span className="sr-only">(opens in new tab)</span>
      </a>
    </header>
  )
}
