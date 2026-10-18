"use client"

import { type ReactNode, useMemo } from "react"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { usePermission } from "@/hooks/use-permission"
import {
  GROWTH_SETTINGS,
  type GrowthSettingsKey,
  TRACKING_TAG_UPDATE,
} from "@/lib/admin/growth-settings"
import { api, unwrap } from "@/lib/api-client"
import { settingsSchemas } from "@/lib/schemas/settings"

import { growthMetaFor } from "./growth-meta"

/**
 * Draft/publish editor for SEO defaults, tracking, consent and custom code
 * (`/marketing/:key`). No draft preview: the public site reads these keys'
 * published values only.
 */
export function GrowthSettingsEditor({
  settingsKey,
  backHref,
  backLabel,
  aside,
}: {
  settingsKey: GrowthSettingsKey
  /** Omit inside the section's route tabs (they already lead back). */
  backHref?: string
  backLabel?: string
  aside?: ReactNode
}) {
  const entry = GROWTH_SETTINGS[settingsKey]
  const canEdit = usePermission(entry.update)
  const canEditTrackingTags = usePermission(TRACKING_TAG_UPDATE)
  const meta = useMemo(
    () => growthMetaFor(settingsKey, { canEditTrackingTags }),
    [settingsKey, canEditTrackingTags]
  )
  const param = { key: settingsKey }
  return (
    <VersionedEditor
      title={entry.label}
      backHref={backHref}
      backLabel={backLabel}
      queryKey={["marketing", settingsKey]}
      load={() => unwrap(api.marketing[":key"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api.marketing[":key"].draft.$put({ param, json: { draft, version } })
        )
      }
      publish={(version) =>
        unwrap(
          api.marketing[":key"].publish.$post({ param, json: { version } })
        )
      }
      restore={(revisionId, version) =>
        unwrap(
          api.marketing[":key"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={settingsSchemas[settingsKey]}
      meta={meta}
      revisions={{ entity: "settings", id: settingsKey }}
      publicHref="/"
      canEdit={canEdit}
      canPublish={canEdit}
      aside={aside}
    />
  )
}
