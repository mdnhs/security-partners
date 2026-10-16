"use client"

import { LogOut } from "lucide-react"
import Link from "next/link"
import type { ReactElement } from "react"

import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { isActiveItem, type NavItem } from "./nav"

// "card" sits on the website card's navy gradient, "rail" on the sidebar.
const DOCK_BUTTON = {
  card: "text-current opacity-80 hover:bg-white/10 hover:text-current hover:opacity-100 aria-[current=page]:bg-white/15 aria-[current=page]:opacity-100 focus-visible:ring-white/60",
  rail: "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-primary",
}

export type DockProps = {
  links: readonly NavItem[]
  pathname: string
  onNavigate: () => void
  onSignOut: () => void
  signingOut: boolean
}

/**
 * Account (and, from Phase 4 Task 12, Users and Audit log) plus Log out as
 * icon buttons: a row in the website card, a column in the icon rail.
 */
export function FooterDock({
  tone,
  links,
  pathname,
  onNavigate,
  onSignOut,
  signingOut,
}: DockProps & { tone: "card" | "rail" }) {
  const button = cn(
    buttonVariants({ variant: "ghost", size: "icon-lg" }),
    "size-10 rounded-lg [&_svg]:size-5",
    DOCK_BUTTON[tone]
  )
  return (
    <nav aria-label="Account">
      <ul
        className={cn(
          "flex items-center gap-1",
          tone === "card" ? "justify-between" : "flex-col"
        )}
      >
        {links.map((link) => {
          const Icon = link.icon
          const active = isActiveItem(link, pathname)
          return (
            <li key={link.href}>
              <DockTip label={link.label}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  aria-label={link.label}
                  aria-current={active ? "page" : undefined}
                  className={button}
                >
                  <Icon aria-hidden />
                </Link>
              </DockTip>
            </li>
          )
        })}
        <li>
          <DockTip label="Log out">
            <button
              type="button"
              aria-label="Log out"
              disabled={signingOut}
              onClick={onSignOut}
              className={button}
            >
              <LogOut aria-hidden />
            </button>
          </DockTip>
        </li>
      </ul>
    </nav>
  )
}

function DockTip({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
