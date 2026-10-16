"use client"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { usePermission } from "@/hooks/use-permission"
import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { api, unwrap } from "@/lib/api-client"
import { previewHref } from "@/lib/schemas/api/preview"
import { templateEditorMeta } from "@/templates/editor-meta"
import {
  PAGE_PATHS,
  PAGES,
  type PageKey,
  templates,
} from "@/templates/registry"

/** Editor for one fixed page (master 4.4). */
export function PageEditor({ pageKey }: { pageKey: PageKey }) {
  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const template = PAGES[pageKey]
  const param = { key: pageKey }
  return (
    <VersionedEditor
      title={PAGE_LABELS[pageKey]}
      backHref="/admin/pages"
      backLabel="All pages"
      queryKey={["pages", pageKey]}
      load={() => unwrap(api.pages[":key"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api.pages[":key"].draft.$put({ param, json: { draft, version } })
        )
      }
      publish={(version) =>
        unwrap(api.pages[":key"].publish.$post({ param, json: { version } }))
      }
      restore={(revisionId, version) =>
        unwrap(
          api.pages[":key"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={templates[template].schema}
      meta={templateEditorMeta[template]}
      revisions={{ entity: "page", id: pageKey }}
      previewHref={previewHref("page", pageKey)}
      publicHref={PAGE_PATHS[pageKey]}
      canEdit={canEdit}
      canPublish={canPublish}
    />
  )
}
