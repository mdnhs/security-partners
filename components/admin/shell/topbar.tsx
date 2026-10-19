"use client"

import { MailIcon } from "lucide-react"
import Link from "next/link"

import { AssistantButton } from "@/components/admin/ai/assistant-button"
import { buttonVariants } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { usePermission } from "@/hooks/use-permission"
import type { NavBadges } from "@/lib/admin/nav"
import type { AiStatusDto } from "@/lib/schemas/api/ai"
import type { ShellNotification } from "@/lib/schemas/api/dashboard"
import { cn } from "@/lib/utils"

import { ICON_BUTTON } from "./constants"
import { formatBadge } from "./nav-entry"
import { NotificationsButton } from "./notifications-button"
import { SearchPill } from "./search-pill"
import { UserMenu } from "./user-menu"

/**
 * The 72 px topbar panel (JW): sidebar toggle, search pill, AI assistant
 * (when on), Enquiries (lead readers), the notifications bell, account.
 */
export function Topbar({
  assistant,
  notifications,
  badges = {},
}: {
  assistant?: AiStatusDto
  notifications?: readonly ShellNotification[]
  /** The sidebar's counts; Enquiries shows the same "new-leads". */
  badges?: NavBadges
}) {
  const canReadLeads = usePermission({ lead: ["read"] })
  return (
    <header
      data-slot="topbar"
      className="rounded-card flex h-[72px] shrink-0 items-center gap-1.5 bg-sidebar px-3 sm:gap-3 sm:px-5"
    >
      <SidebarTrigger className="size-10 rounded-full" />
      <div className="flex min-w-0 flex-1">
        <SearchPill />
      </div>
      <AssistantButton initialStatus={assistant} />
      {canReadLeads ? <EnquiriesLink count={badges["new-leads"] ?? 0} /> : null}
      <NotificationsButton items={notifications} />
      <UserMenu />
    </header>
  )
}

/**
 * The leads inbox as a circular 44 px icon link; the count matches the
 * sidebar. Shown on phones too (MK) from 360 px: below that, with the AI
 * button on, six 44 px controls cannot fit the 296 px topbar, and the
 * sidebar's Enquiries badge covers it.
 */
function EnquiriesLink({ count }: { count: number }) {
  return (
    <Link
      href="/admin/leads"
      aria-label={count ? `Enquiries, ${count} new unassigned` : "Enquiries"}
      data-slot="button"
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-lg" }),
        ICON_BUTTON,
        "relative hidden shrink-0 min-[360px]:inline-flex"
      )}
    >
      <MailIcon aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          data-slot="enquiries-count"
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-sidebar"
        >
          {formatBadge(count)}
        </span>
      ) : null}
    </Link>
  )
}
