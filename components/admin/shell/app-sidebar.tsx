"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAdminSession } from "@/components/admin/session-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import type { NavBadges } from "@/lib/admin/nav"

import { BrandMark } from "./brand-mark"
import type { AdminBrand, SiteInfo } from "./constants"
import { type DockProps, FooterDock } from "./footer-dock"
import { NavMain } from "./nav-main"
import { useShellSignOut } from "./sign-out-context"
import { WebsiteCard } from "./website-card"

/**
 * The floating sidebar panel (JW): brand, sections, and the website card
 * holding the footer dock. Collapses to an icon rail (⌘/Ctrl+B); a sheet
 * below 1024 px.
 */
export function AppSidebar({
  site,
  badges,
  brand = null,
}: {
  site: SiteInfo
  badges?: NavBadges
  /** The published site logo (panel layout); null = the SP chip. */
  brand?: AdminBrand | null
}) {
  const { roles } = useAdminSession()
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const { signOut, pending, error } = useShellSignOut()
  const dockError = error?.source === "dock" ? error.message : null
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }
  const dockProps: DockProps = {
    roles,
    pathname,
    onNavigate,
    onSignOut: () => signOut("dock"),
    signingOut: pending,
  }
  return (
    <Sidebar variant="floating" collapsible="icon" className="p-4">
      {/* 18 + 44 + 6 px: the 68 px row of the 40 px chip with 20 + 8 px. */}
      <SidebarHeader className="px-4 pt-4.5 pb-1.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1">
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label={`${brand?.name || "Security Partners"} admin home`}
          className="flex min-h-11 items-center rounded-xl outline-none group-data-[collapsible=icon]:min-w-11 group-data-[collapsible=icon]:justify-center focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark
            brand={brand}
            className="group-data-[collapsible=icon]:[&_[data-slot=brand-name]]:hidden group-data-[collapsible=icon]:[&>span:first-child]:w-10"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain badges={badges} />
      </SidebarContent>
      {/* Pinned below the scrolling menu. The card (and its dock row) hides
          in the icon rail, where the dock stands alone as a column. */}
      <SidebarFooter className="relative p-3 pt-2 group-data-[collapsible=icon]:px-1">
        <WebsiteCard site={site}>
          <FooterDock tone="card" {...dockProps} />
        </WebsiteCard>
        <div className="hidden group-data-[collapsible=icon]:block">
          <FooterDock tone="rail" {...dockProps} />
        </div>
        {/* In the icon rail the failure floats beside the rail, readable. */}
        {dockError ? (
          <p
            role="alert"
            className="bg-danger-soft text-danger rounded-xl px-3 py-2 text-xs font-medium group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:bottom-3 group-data-[collapsible=icon]:left-full group-data-[collapsible=icon]:z-40 group-data-[collapsible=icon]:ml-3 group-data-[collapsible=icon]:w-56 group-data-[collapsible=icon]:shadow-lg"
          >
            {dockError}
          </p>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  )
}
