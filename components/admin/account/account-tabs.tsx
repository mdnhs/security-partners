"use client"

import type { ReactNode } from "react"

import { useTabParam } from "@/components/admin/section-tabs/section-tabs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "devices", label: "Devices" },
] as const

type AccountTab = (typeof TABS)[number]["id"]

// ?tab=sessions was the Devices tab's id before MK parity (bookmarks).
const ALIASES: Record<string, AccountTab> = { sessions: "devices" }

const known = (id: string | undefined): AccountTab => {
  const resolved = id ? (ALIASES[id] ?? id) : undefined
  return TABS.find((tab) => tab.id === resolved)?.id ?? "profile"
}

/**
 * Account's sections as MK top tabs, selected by ?tab=profile|security|devices
 * (a click adds a history entry, so Back returns). Every panel stays mounted:
 * a half-typed password survives a look at Devices.
 */
export function AccountTabs(panels: Record<AccountTab, ReactNode>): ReactNode {
  const [fromUrl, select] = useTabParam("tab")
  const selected = known(fromUrl)
  return (
    <Tabs
      value={selected}
      onValueChange={(value) => {
        if (value !== selected) select(String(value))
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
