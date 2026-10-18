"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import type { StatusPillSpec } from "@/components/admin/kit/content-status"
import { SeoLink } from "@/components/admin/seo/seo-link"
import { api, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { ArticleDto } from "@/lib/schemas/api/articles"
import type { ContentStatus } from "@/lib/schemas/api/content"
import { previewHref } from "@/lib/schemas/api/preview"
import { articleContent } from "@/lib/schemas/content/article"

import { articleEditorMeta } from "./article-meta"
import { ArticleSettings } from "./article-settings"
import { WorkflowActions } from "./workflow-actions"

const asDto = (request: Promise<unknown>) => request as Promise<ArticleDto>

/**
 * The editor's status pills: the workflow step of a draft (Draft / In
 * review / Scheduled · date); for a live article "Published" plus what is
 * pending (a schedule, a review, or unpublished changes).
 */
export function articleStatusPills(article: {
  status: ContentStatus
  live: boolean
  dirty: boolean
  scheduledAt: string | null
}): StatusPillSpec[] {
  const step: StatusPillSpec | null =
    article.status === "scheduled"
      ? {
          label: article.scheduledAt
            ? `Scheduled · ${formatDateTime(article.scheduledAt)}`
            : "Scheduled",
          tone: "info",
        }
      : article.status === "in_review"
        ? { label: "In review", tone: "info" }
        : null
  if (!article.live) return [step ?? { label: "Draft", tone: "neutral" }]
  const pending: StatusPillSpec | null =
    step ??
    (article.dirty ? { label: "Unpublished changes", tone: "warning" } : null)
  return [
    { label: "Published", tone: "success" },
    ...(pending ? [pending] : []),
  ]
}

/**
 * Article editor (master 5.3): Phase 4's VersionedEditor with the article's
 * own rights (from the API), workflow actions and settings panel.
 */
export function ArticleEditor({ id }: { id: string }) {
  const queryKey = ["articles", id] as const
  const param = { id }
  // Once deleted, nothing may load the record again (it would 404).
  const [deleted, setDeleted] = useState(false)
  const load = () => asDto(unwrap(api.articles[":id"].$get({ param })))
  // Same query as the editor's: re-renders with every record it accepts.
  const record = useQuery({ queryKey, queryFn: load, enabled: !deleted })
  const permissions = record.data?.permissions
  if (deleted)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Article deleted. Returning to all articles…
      </p>
    )
  return (
    <VersionedEditor<ArticleDto>
      title={record.data?.title ?? "Article"}
      backHref="/admin/articles"
      backLabel="All articles"
      path={record.data ? `/blog/${record.data.slug}` : undefined}
      queryKey={queryKey}
      load={load}
      saveDraft={(draft, version) =>
        asDto(
          unwrap(
            api.articles[":id"].draft.$put({ param, json: { draft, version } })
          )
        )
      }
      publish={(version) =>
        asDto(
          unwrap(
            api.articles[":id"].publish.$post({ param, json: { version } })
          )
        )
      }
      restore={(revisionId, version) =>
        asDto(
          unwrap(
            api.articles[":id"].restore.$post({
              param,
              json: { revisionId, version },
            })
          )
        )
      }
      schema={articleContent}
      meta={articleEditorMeta}
      revisions={{ entity: "article", id }}
      previewHref={previewHref("article", id)}
      publicHref={record.data?.live ? `/blog/${record.data.slug}` : undefined}
      canEdit={permissions?.update ?? false}
      canPublish={permissions?.publish ?? false}
      status={(dto, dirty) => articleStatusPills({ ...dto, dirty })}
      actions={(ctx) => (
        <>
          <SeoLink kind="article" id={id} />
          <WorkflowActions ctx={ctx} />
        </>
      )}
      aside={(ctx) => (
        <ArticleSettings ctx={ctx} onDeleted={() => setDeleted(true)} />
      )}
      asideColumnFrom="xl"
      longTitle
    />
  )
}
