"use client"

import { LayoutGrid } from "lucide-react"
import type { ReactNode } from "react"

import { SectionTabs } from "@/components/admin/section-tabs/section-tabs"
import {
  EDITABLE_SETTINGS_KEYS,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"

const ITEMS = [
  {
    id: "overview",
    label: "Overview",
    href: "/admin/settings",
    icon: LayoutGrid,
  },
  ...EDITABLE_SETTINGS_KEYS.map((key) => ({
    id: key,
    label: SETTINGS_ENTRIES[key].label,
    href: `/admin/settings/${key}`,
  })),
]

/**
 * Settings keys as route tabs on the left (every key needs only
 * settings:read, which the pages check); the overview or a key's editor
 * on the right.
 */
export function SettingsTabs({ children }: { children: ReactNode }) {
  return (
    <SectionTabs ariaLabel="Settings" items={ITEMS}>
      {children}
    </SectionTabs>
  )
}
