"use client"

import { CopyPlus } from "lucide-react"
import { useState } from "react"

import {
  type CopySeed,
  NewPageDialog,
} from "@/components/admin/builder/new-page-dialog"
import { EDITOR_ACTION } from "@/components/admin/editor/editor-layout"
import {
  type EditorActionContext,
  VersionedEditor,
} from "@/components/admin/editor/versioned-editor"
import { SeoLink } from "@/components/admin/seo/seo-link"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { api, unwrap } from "@/lib/api-client"
import { previewHref } from "@/lib/schemas/api/preview"
import {
  copyFromTemplate,
  copySlug,
  copyTitle,
} from "@/templates/builder/from-template"
import { templateEditorMeta } from "@/templates/editor-meta"
import {
  PAGE_PATHS,
  PAGES,
  type PageKey,
  templateSchemaFor,
  templates,
} from "@/templates/registry"

/**
 * "Copy to new page" (page:create): this page's sections and copy, as it
 * stands in the editor, seed a NEW builder page at /p/<key>-copy. The fixed
 * page and its route are never touched.
 */
function CopyToNewPage({
  pageKey,
  ctx,
}: {
  pageKey: PageKey
  ctx: Pick<EditorActionContext<unknown>, "draft" | "showAllErrors">
}) {
  const [seed, setSeed] = useState<CopySeed | null>(null)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={EDITOR_ACTION}
        onClick={() => {
          const parsed = templateSchemaFor(pageKey).safeParse(ctx.draft)
          // Unfinished fields are marked; nothing half-filled is copied.
          if (!parsed.success) {
            ctx.showAllErrors()
            return
          }
          const copy = copyFromTemplate(pageKey, parsed.data)
          setSeed({
            title: copyTitle(PAGE_LABELS[pageKey]),
            slug: copySlug(pageKey),
            doc: copy.doc,
            notes: copy.notes,
          })
        }}
      >
        <CopyPlus aria-hidden />
        <span className="max-sm:sr-only">Copy to new page</span>
      </Button>
      <NewPageDialog
        open={seed !== null}
        onOpenChange={(open) => {
          if (!open) setSeed(null)
        }}
        seed={seed ?? undefined}
      />
    </>
  )
}

/** Editor for one fixed page (master 4.4). */
export function PageEditor({ pageKey }: { pageKey: PageKey }) {
  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const canCreate = usePermission({ page: ["create"] })
  const template = PAGES[pageKey]
  const param = { key: pageKey }
  return (
    <VersionedEditor
      title={PAGE_LABELS[pageKey]}
      backHref="/admin/pages"
      backLabel="All pages"
      path={PAGE_PATHS[pageKey]}
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
      actions={(ctx) => (
        <>
          {canCreate ? <CopyToNewPage pageKey={pageKey} ctx={ctx} /> : null}
          <SeoLink kind="page" id={pageKey} />
        </>
      )}
    />
  )
}
