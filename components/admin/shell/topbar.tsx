"use client"

import { AssistantButton } from "@/components/admin/ai/assistant-button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { AiStatusDto } from "@/lib/schemas/api/ai"
import type { ShellNotification } from "@/lib/schemas/api/dashboard"

import { NotificationsButton } from "./notifications-button"
import { SearchPill } from "./search-pill"
import { UserMenu } from "./user-menu"

/**
 * The 72 px topbar panel (JW): sidebar toggle, search pill, AI assistant
 * (when on), the notifications bell, avatar.
 */
export function Topbar({
  assistant,
  notifications,
}: {
  assistant?: AiStatusDto
  notifications?: readonly ShellNotification[]
}) {
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
      <NotificationsButton items={notifications} />
      <UserMenu />
    </header>
  )
}
