"use client"

import { type ReactNode, useMemo } from "react"

import {
  bundleMeta,
  bundleSchema,
  createBundle,
} from "@/components/admin/pages/page-bundle"
import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { EditorSeoTab, textAt } from "@/components/admin/seo/editor-seo-tab"
import { ServicesInlineList } from "@/components/admin/services/services-inline-list"
import { useAdminSession } from "@/components/admin/session-provider"
import { WebsiteParts } from "@/components/admin/website/website-parts"
import { usePermission } from "@/hooks/use-permission"
import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { SETTINGS_ENTRIES } from "@/lib/admin/settings-keys"
import { isWebsiteKey, PAGE_SECTIONS, PART_ANCHORS } from "@/lib/admin/website"
import { hasPermission } from "@/lib/auth/permissions"
import { previewHref } from "@/lib/schemas/api/preview"
import { templateEditorMeta } from "@/templates/editor-meta"
import {
  PAGE_PATHS,
  PAGES,
  type PageKey,
  templates,
} from "@/templates/registry"

/** Editor for one fixed page (master 4.4); SEO tab (MK D1.4). */
export function PageEditor({
  pageKey,
  origin,
}: {
  pageKey: PageKey
  /** Public site origin for the SEO previews. */
  origin?: string
}) {
  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const canReadSeo = usePermission({ seo: ["read"] })
  const template = PAGES[pageKey]
  const { roles } = useAdminSession()
  // Settings sections shown inside this page's form (only those the user
  // may edit: they are saved and published with the page).
  const sections = useMemo(
    () =>
      (PAGE_SECTIONS[pageKey] ?? []).filter((s) =>
        hasPermission(roles, SETTINGS_ENTRIES[s.settings].update)
      ),
    [pageKey, roles]
  )
  const bundle = useMemo(
    () => createBundle(pageKey, sections),
    [pageKey, sections]
  )
  const schema = useMemo(
    () => bundleSchema(templates[template].schema, sections),
    [template, sections]
  )
  const meta = useMemo(
    () => bundleMeta(templateEditorMeta[template], sections),
    [template, sections]
  )
  // Lists and links among the sections, after the group they follow.
  const slots: Record<string, ReactNode> = {}
  if (isWebsiteKey(pageKey))
    for (const [group, ids] of Object.entries(PART_ANCHORS[pageKey] ?? {}))
      slots[`after:${group}`] = <WebsiteParts screen={pageKey} ids={ids} />
  if (pageKey === "services") slots.servicesSection = <ServicesInlineList />
  return (
    <VersionedEditor
      title={PAGE_LABELS[pageKey]}
      path={PAGE_PATHS[pageKey]}
      queryKey={["pages", pageKey]}
      load={bundle.load}
      saveDraft={bundle.saveDraft}
      publish={bundle.publish}
      restore={bundle.restore}
      schema={schema}
      meta={meta}
      revisions={{ entity: "page", id: pageKey }}
      previewHref={previewHref("page", pageKey)}
      publicHref={PAGE_PATHS[pageKey]}
      flat
      slots={slots}
      canEdit={canEdit}
      canPublish={canPublish}
      seo={
        canReadSeo
          ? (ctx) => (
              <EditorSeoTab
                kind="page"
                id={pageKey}
                origin={origin}
                names={{
                  live: textAt(
                    ctx.record.published ?? ctx.record.draft,
                    "hero",
                    "title"
                  ),
                  draft: textAt(ctx.draft, "hero", "title"),
                }}
              />
            )
          : undefined
      }
    />
  )
}
