"use client"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { usePermission } from "@/hooks/use-permission"
import {
  type EditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import { api, unwrap } from "@/lib/api-client"
import { previewHref } from "@/lib/schemas/api/preview"
import { settingsSchemas } from "@/lib/schemas/settings"

import { settingsEditorMeta } from "./settings-meta"

/** Draft/publish editor for one content settings key (master 4.5). */
export function SettingsEditor({
  settingsKey,
}: {
  settingsKey: EditableSettingsKey
}) {
  const entry = SETTINGS_ENTRIES[settingsKey]
  // Per-key group permission (leads also needs lead:update), as the API enforces.
  const canEdit = usePermission(entry.update)
  const param = { key: settingsKey }
  return (
    <VersionedEditor
      title={entry.label}
      backHref="/admin/settings"
      backLabel="All settings"
      queryKey={["settings", settingsKey]}
      load={() => unwrap(api.settings[":key"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api.settings[":key"].draft.$put({ param, json: { draft, version } })
        )
      }
      publish={(version) =>
        unwrap(api.settings[":key"].publish.$post({ param, json: { version } }))
      }
      restore={(revisionId, version) =>
        unwrap(
          api.settings[":key"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={settingsSchemas[settingsKey]}
      meta={settingsEditorMeta[settingsKey]}
      revisions={{ entity: "settings", id: settingsKey }}
      previewHref={
        settingsKey === "leads"
          ? undefined
          : previewHref("settings", settingsKey)
      }
      publicHref={settingsKey === "leads" ? undefined : "/"}
      canEdit={canEdit}
      canPublish={canEdit}
    />
  )
}
