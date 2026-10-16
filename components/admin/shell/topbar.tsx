"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"

import { NotificationsButton } from "./notifications-button"
import { SearchPill } from "./search-pill"
import { UserMenu } from "./user-menu"

/**
 * The 72 px topbar panel (JW): sidebar toggle, search pill, bell, avatar.
 * Phase 7 adds the Leads mail link before the bell; Phase 9 the AI button.
 */
export function Topbar() {
  return (
    <header
      data-slot="topbar"
      className="rounded-card flex h-[72px] shrink-0 items-center gap-2 bg-sidebar px-3 sm:gap-3 sm:px-5"
    >
      <SidebarTrigger className="size-10 rounded-full" />
      <div className="flex min-w-0 flex-1">
        <SearchPill />
      </div>
      <NotificationsButton />
      <UserMenu />
    </header>
  )
}
