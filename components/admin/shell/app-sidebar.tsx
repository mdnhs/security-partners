"use client"

import Image from "next/image"
import Link from "next/link"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

import type { NavBadges } from "./nav"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import { WebsiteCard } from "./website-card"

/**
 * Admin sidebar (shadcn dashboard-01): brand, permission-filtered navigation,
 * the website card and the signed-in user. Collapses to icons on desktop
 * (⌘/Ctrl+B); a sheet below 768 px.
 */
export function AppSidebar({
  siteHost,
  badges,
}: {
  siteHost: string
  badges?: NavBadges
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link
                  href="/admin"
                  onClick={isMobile ? () => setOpenMobile(false) : undefined}
                />
              }
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white p-1">
                <Image
                  src="/images/logo.png"
                  alt=""
                  width={44}
                  height={27}
                  className="h-auto w-full"
                />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-bold text-white">
                  Security Partners
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  Website admin
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain badges={badges} />
      </SidebarContent>
      <SidebarFooter>
        <WebsiteCard siteHost={siteHost} />
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
