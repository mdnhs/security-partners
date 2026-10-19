"use client"

import type { ReactNode } from "react"

import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"

import { TrackingStatus, trackingDraft } from "./tracking-status"

/**
 * Marketing › Tracking: the settings editor with the channel status card,
 * which follows the unsaved draft (a render prop, so it lives client-side).
 */
export function TrackingEditor({ description }: { description?: ReactNode }) {
  return (
    <GrowthSettingsEditor
      settingsKey="tracking"
      description={description}
      aside={({ draft }) => <TrackingStatus value={trackingDraft(draft)} />}
    />
  )
}
