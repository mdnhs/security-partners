"use client"

import { useMemo } from "react"
import { z } from "zod"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { bundleMeta } from "@/components/admin/pages/page-bundle"
import { createSettingsBundle } from "@/components/admin/website/settings-bundle"
import { WebsiteParts } from "@/components/admin/website/website-parts"
import { usePermission } from "@/hooks/use-permission"
import {
  type EditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import { type PageSection } from "@/lib/admin/website"
import { previewHref } from "@/lib/schemas/api/preview"
import { settingsSchemas } from "@/lib/schemas/settings"

/** The settings behind the screen, in form order; the first is tracked. */
const KEYS = [
  "navigation",
  "footer",
  "microcopy",
] as const satisfies readonly EditableSettingsKey[]

const SECTIONS: readonly PageSection[] = KEYS.map((key) => ({
  key,
  settings: key,
  after: null,
}))

/** The tab names (each key's form group). */
const TAB_LABELS = {
  navigation: {
    label: "Header",
    help: "The links across the top of every page and the highlighted button.",
  },
  footer: {
    label: "Footer",
    help: "Footer text and headings, the privacy and terms links, and the group companies.",
  },
  microcopy: { label: "Forms & microcopy" },
}

/**
 * Header & footer: the header menu, the footer and the small labels in one
 * form with a tab each (Header, Footer, Forms & microcopy), one draft and one
 * Publish. The group companies sit at the end of the Footer tab.
 */
export function HeaderFooterEditor() {
  const canEdit = usePermission(SETTINGS_ENTRIES.navigation.update)
  const bundle = useMemo(() => createSettingsBundle(KEYS), [])
  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(KEYS.map((key) => [key, settingsSchemas[key]]))
      ),
    []
  )
  const meta = useMemo(
    () =>
      bundleMeta(
        {
          fields: {
            navigation: TAB_LABELS.navigation,
            footer: TAB_LABELS.footer,
            microcopy: TAB_LABELS.microcopy,
          },
        },
        SECTIONS
      ),
    []
  )
  return (
    <VersionedEditor
      title="Header & footer"
      description="Changes stay in a draft until you publish."
      queryKey={["settings", "header-footer"]}
      load={bundle.load}
      saveDraft={bundle.saveDraft}
      publish={bundle.publish}
      restore={bundle.restore}
      schema={schema}
      meta={meta}
      revisions={{ entity: "settings", id: "navigation" }}
      previewHref={previewHref("settings", "navigation")}
      publicHref="/"
      slots={{
        "after:footer": (
          <WebsiteParts screen="header-footer" ids={["group-companies"]} />
        ),
      }}
      canEdit={canEdit}
      canPublish={canEdit}
    />
  )
}
