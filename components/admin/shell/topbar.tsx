"use client"

import { AssistantButton } from "@/components/admin/ai/assistant-button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { AiStatusDto } from "@/lib/schemas/api/ai"

import { NotificationsButton } from "./notifications-button"
import { SearchPill } from "./search-pill"
import { UserMenu } from "./user-menu"

/**
 * The 72 px topbar panel (JW): sidebar toggle, search pill, AI assistant
 * (when on), bell, avatar. Phase 7 adds the Leads mail link after the AI
 * button, before the bell.
 */
export function Topbar({ assistant }: { assistant?: AiStatusDto }) {
  return (
    <header
      data-slot="topbar"
      className="rounded-card flex h-[72px] shrink-0 items-center gap-2 bg-sidebar px-3 sm:gap-3 sm:px-5"
    >
      <SidebarTrigger className="size-10 rounded-full" />
      <div className="flex min-w-0 flex-1">
        <SearchPill />
      </div>
      <AssistantButton initialStatus={assistant} />
      <NotificationsButton />
      <UserMenu />
    </header>
  )
}
