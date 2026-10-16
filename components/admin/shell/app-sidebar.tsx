"use client"

import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useSignOut } from "@/components/admin/auth/sign-out-button"
import { useAdminSession } from "@/components/admin/session-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

import { BrandMark } from "./brand-mark"
import type { SiteInfo } from "./constants"
import { type DockProps, FooterDock } from "./footer-dock"
import { dockItems, type NavBadges } from "./nav"
import { NavMain } from "./nav-main"
import { WebsiteCard } from "./website-card"

/**
 * The floating sidebar panel (JW): brand, sections, and the website card
 * holding the footer dock. Collapses to an icon rail (⌘/Ctrl+B); a sheet
 * below 1024 px.
 */
export function AppSidebar({
  site,
  badges,
}: {
  site: SiteInfo
  badges?: NavBadges
}) {
  const { roles } = useAdminSession()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { isMobile, setOpenMobile } = useSidebar()
  // The next user must never see this user's cached data.
  const { signOut, pending, error } = useSignOut(() => queryClient.clear())
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }
  const dockProps: DockProps = {
    links: dockItems(roles),
    pathname,
    onNavigate,
    onSignOut: () => void signOut(),
    signingOut: pending,
  }
  return (
    <Sidebar variant="floating" collapsible="icon" className="p-4">
      <SidebarHeader className="px-4 pt-5 pb-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1">
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label="Security Partners admin home"
          className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark className="group-data-[collapsible=icon]:[&_[data-slot=brand-name]]:hidden group-data-[collapsible=icon]:[&>span:first-child]:w-10" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain badges={badges} />
      </SidebarContent>
      {/* Pinned below the scrolling menu. The card (and its dock row) hides
          in the icon rail, where the dock stands alone as a column. */}
      <SidebarFooter className="p-3 pt-2 group-data-[collapsible=icon]:px-1">
        <WebsiteCard site={site}>
          <FooterDock tone="card" {...dockProps} />
        </WebsiteCard>
        <div className="hidden group-data-[collapsible=icon]:block">
          <FooterDock tone="rail" {...dockProps} />
        </div>
        {error ? (
          <p
            role="alert"
            className="text-danger px-1 text-xs font-medium group-data-[collapsible=icon]:sr-only"
          >
            {error}
          </p>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  )
}
