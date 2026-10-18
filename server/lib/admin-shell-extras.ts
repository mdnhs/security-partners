import "server-only"

import type { NavBadges } from "@/components/admin/shell/nav"
import { hasPermission } from "@/lib/auth/permissions"
import type { AiStatusDto } from "@/lib/schemas/api/ai"
import type { ShellNotification } from "@/lib/schemas/api/dashboard"
import type { Actor } from "@/server/lib/actor"
import { getAiStatus } from "@/server/modules/ai/service"
import { getShellNotifications } from "@/server/modules/dashboard/service"
import { leadBadge } from "@/server/modules/leads/service"

export type ShellExtras = {
  badges: NavBadges
  /** undefined: the AI button stays hidden. */
  assistant: AiStatusDto | undefined
  notifications: ShellNotification[]
}

/**
 * The admin frame's optional parts (panel layout): the sidebar's new-leads
 * badge, the AI assistant status and the bell's items. Each degrades on its
 * own (final review I7): a failing query is logged and leaves no badge, the
 * AI button hidden or an empty bell, instead of failing the whole frame.
 */
export async function loadShellExtras(actor: Actor): Promise<ShellExtras> {
  // Unassigned new leads for those who handle them; the bell reuses it.
  const badgesLoad: Promise<NavBadges> = hasPermission(actor.roles, {
    lead: ["read"],
  })
    ? leadBadge(actor)
        .then((badge): NavBadges => ({ "new-leads": badge.newLeads }))
        .catch(degraded("lead badge", {}))
    : Promise.resolve({})
  const [badges, assistant, notifications] = await Promise.all([
    badgesLoad,
    getAiStatus(actor).catch(degraded("AI status", undefined)),
    badgesLoad
      .then((loaded) =>
        getShellNotifications(actor, loaded["new-leads"] ?? null)
      )
      .catch(degraded("notifications", [] as ShellNotification[])),
  ])
  return { badges, assistant, notifications }
}

/** A failed optional part: logged, then replaced by `fallback`. */
function degraded<T>(part: string, fallback: T) {
  return (error: unknown): T => {
    console.error(`[admin shell] ${part} unavailable`, error)
    return fallback
  }
}
