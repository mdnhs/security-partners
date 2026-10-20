"use client"

import type { ReactNode } from "react"

import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"

import { CustomCodeNotice, CustomCodeOffNotice } from "./notices"

/**
 * Marketing › Custom code (owner only): the snippets list (SchemaForm list
 * widget, configured in growth-meta.ts: hidden ids, placement / category
 * radios, route and host lists) with the trust notice beside it, led by
 * a "switched off" banner while the published kill switch is on.
 */
export function SnippetsEditor({
  description,
  killSwitchOn,
}: {
  description?: ReactNode
  /** Published `disabled` (set here or by `pnpm custom-code:off`). */
  killSwitchOn: boolean
}) {
  return (
    <GrowthSettingsEditor
      settingsKey="customCode"
      description={description}
      aside={
        killSwitchOn ? (
          <div className="flex flex-col gap-4">
            <CustomCodeOffNotice />
            <CustomCodeNotice />
          </div>
        ) : (
          <CustomCodeNotice />
        )
      }
    />
  )
}
