"use client"

import type { ReactNode } from "react"

import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"

import { ConsentPreview, consentDraft } from "./consent-preview"

/**
 * Marketing › Consent banner: the settings editor with a live banner
 * preview, which follows the unsaved draft (a render prop, so it lives
 * client-side).
 */
export function ConsentEditor({ description }: { description?: ReactNode }) {
  return (
    <GrowthSettingsEditor
      settingsKey="consent"
      description={description}
      aside={({ draft }) => <ConsentPreview value={consentDraft(draft)} />}
    />
  )
}
