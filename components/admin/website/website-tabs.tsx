"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import {
  SECTION_TAB,
  SECTION_TAB_ACTIVE,
} from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import {
  type WebsiteKey,
  websiteScreen,
  websiteTabs,
} from "@/lib/admin/website"
import { cn } from "@/lib/utils"

const covers = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/**
 * A Website screen's tabs: its Page, then the parts homed on it that the
 * user may read (lib/admin/website.ts). Nothing when there is only one.
 */
export function WebsiteTabs({ screen }: { screen: WebsiteKey }) {
  const { roles } = useAdminSession()
  const pathname = usePathname()
  const tabs = websiteTabs(screen, roles)
  const listRef = useRef<HTMLUListElement>(null)
  // The deepest tab whose href covers the path (Page covers its parts).
  const current = tabs
    .filter((tab) => covers(tab.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.id
  // On a narrow screen the row scrolls: keep the current tab in view.
  useEffect(() => {
    const row = listRef.current
    const active = row?.querySelector<HTMLElement>("[aria-current=page]")
    if (!row || !active || row.scrollWidth <= row.clientWidth) return
    const left = active.offsetLeft
    const right = left + active.offsetWidth
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth)
      row.scrollTo({ left: left - 16 })
  }, [current])
  if (tabs.length < 2) return null
  const label = websiteScreen(screen).label
  return (
    <nav aria-label={`${label} sections`} className="mb-6 min-w-0">
      <ul
        ref={listRef}
        className="-mx-1 flex scrollbar-thin gap-1 overflow-x-auto px-1 pb-1"
      >
        {tabs.map((tab) => {
          const active = tab.id === current
          return (
            <li key={tab.id} className="flex shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(SECTION_TAB, active && SECTION_TAB_ACTIVE)}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
