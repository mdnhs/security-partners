"use client"

import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "devices", label: "Devices" },
] as const

type AccountTab = (typeof TABS)[number]["id"]

// ?tab=sessions was the Devices tab's id before MK parity (bookmarks).
const ALIASES: Record<string, AccountTab> = { sessions: "devices" }

const known = (id: string | null): AccountTab => {
  const resolved = id ? (ALIASES[id] ?? id) : null
  return TABS.find((tab) => tab.id === resolved)?.id ?? "profile"
}

/**
 * A key press, or the click a button fires for Enter/Space (`detail` 0:
 * no pointer clicks counted).
 */
const fromKeyboard = (event: Event | undefined) =>
  event?.type.startsWith("key") ||
  (event instanceof MouseEvent && event.type === "click" && event.detail === 0)

/**
 * Account's sections as MK top tabs, selected by ?tab=profile|security|devices.
 *
 * The tab is read with useSearchParams, so:
 * - the server renders a deep link's tab (no Profile flash on hydration);
 * - a <Link> to /admin/account?tab=security while already on the page (the
 *   user menu's Security) switches the tab, as Next's router updates it.
 * Choosing a tab writes the URL with the native History API, which Next
 * integrates into its router: a click pushes (Back returns), a keyboard
 * choice replaces. Every panel stays mounted, so a half-typed password
 * survives a look at Devices.
 */
export function AccountTabs(panels: Record<AccountTab, ReactNode>): ReactNode {
  const selected = known(useSearchParams().get("tab"))
  return (
    <Tabs
      value={selected}
      onValueChange={(value, details) => {
        if (value === selected) return
        const url = new URL(window.location.href)
        url.searchParams.set("tab", String(value))
        if (fromKeyboard(details.event))
          window.history.replaceState(null, "", url)
        else window.history.pushState(null, "", url)
      }}
    >
      <TabsList aria-label="Account sections">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} keepMounted className="mt-4">
          {panels[tab.id]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
