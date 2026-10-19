"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { UnsavedGuard } from "@/components/admin/editor/unsaved-guard"
import { useMediaItem } from "@/components/admin/media/use-media-item"
import { FORM_ACTION } from "@/components/admin/page-header"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { Button } from "@/components/ui/button"
import { ApiError, errorMessage } from "@/lib/api-client"
import { type Seo, seo as seoSchema } from "@/lib/schemas/common"
import { type CheckResult, runChecks, type SeoCheckId } from "@/lib/seo/checks"
import { filled } from "@/lib/seo/effective"
import { ogImagePath } from "@/lib/seo/urls"
import { cn } from "@/lib/utils"

import { SeoChecklist } from "./seo-checklist"
import { SEO_FIELDS_META } from "./seo-meta"
import { SerpPreview } from "./serp-preview"
import { SocialCard } from "./social-card"

export type SeoPanelProps = {
  kind: "page" | "service" | "article" | "builder"
  id: string
  /** Public path for SERP + social preview. */
  path: string
  /** From the unsaved draft; description null = the site-wide default. */
  fallback: { title: string; description: string | null }
  value: Seo
  onSave(next: Seo): Promise<void>
  canEdit: boolean
  /** Public site origin for the previews' host (default: this window's). */
  origin?: string
  /** Called whenever the panel's unsaved state changes (e.g. a sheet's close guard). */
  onDirtyChange?: (dirty: boolean) => void
}

/** The checks the panel can evaluate locally while typing. */
const LOCAL_CHECKS: readonly SeoCheckId[] = [
  "title-length",
  "description",
  "og-image",
  "indexable",
]

/** Blank strings and absent keys are the same (the server drops blanks). */
function normal(value: Seo): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, v]) => v !== undefined && !(typeof v === "string" && v.trim() === "")
    )
  )
}

/** Same SEO fields? (key order, blanks and undefined keys do not count). */
export function sameSeo(a: Seo, b: Seo): boolean {
  const x = normal(a)
  const y = normal(b)
  const keys = new Set([...Object.keys(x), ...Object.keys(y)])
  return [...keys].every(
    (key) => JSON.stringify(x[key]) === JSON.stringify(y[key])
  )
}

/** The generated share card of a record (page key; service/article slug). */
function generatedCard(kind: SeoPanelProps["kind"], id: string, path: string) {
  if (kind === "builder") return `/og/builder/${encodeURIComponent(id)}`
  if (kind === "page") return ogImagePath("page", id)
  const slug = path.split("/").filter(Boolean).at(-1) ?? id
  return ogImagePath(kind, slug)
}

function hostOf(origin: string | undefined): string {
  try {
    return new URL(origin ?? window.location.origin).host
  } catch {
    return ""
  }
}

/**
 * One record's SEO (MK D1.4): the fields on the left; beside them the search
 * result, the social card and the live checklist, all following every
 * keystroke. Used by the SEO overview's sheet and the editors' SEO tab.
 */
export function SeoPanel({
  kind,
  id,
  path,
  fallback,
  value,
  onSave,
  canEdit,
  origin,
  onDirtyChange,
}: SeoPanelProps) {
  const [draft, setDraft] = useState<Seo>(value)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  // A new saved value (after our save, or a reload while untouched) becomes
  // the draft; edits in progress are never replaced by a background refetch.
  const [base, setBase] = useState<Seo>(value)
  const [justSaved, setJustSaved] = useState(false)
  if (!sameSeo(base, value)) {
    setBase(value)
    if (justSaved || sameSeo(draft, base)) {
      setDraft(value)
      setResetKey((k) => k + 1)
    }
    if (justSaved) setJustSaved(false)
  }
  const dirty = canEdit && !sameSeo(draft, value)
  const onDirtyRef = useRef(onDirtyChange)
  useEffect(() => {
    onDirtyRef.current = onDirtyChange
  })
  useEffect(() => {
    onDirtyRef.current?.(dirty)
  }, [dirty])

  const media = useMediaItem(draft.ogImage?.mediaId)
  const title = filled(draft.title) ?? fallback.title
  const ownDescription = filled(draft.description)
  const description = ownDescription ?? fallback.description
  const ogSize =
    draft.ogImage && media.data
      ? { width: media.data.width ?? 0, height: media.data.height ?? 0 }
      : null
  const results: CheckResult[] = runChecks({
    title,
    titleUnique: true,
    // No own or record description: the site-wide default is used.
    description: description ?? "default",
    usesDefaultDescription: description === null,
    ogImage: ogSize,
    imagesMissingAlt: 0,
    hasH1: true,
    noindex: draft.noindex === true,
    siteNoindex: false,
    internalLinks: null,
  }).filter((r) => LOCAL_CHECKS.includes(r.id))

  const host = hostOf(origin)
  const imageUrl =
    draft.ogImage && media.data ? media.data.url : generatedCard(kind, id, path)

  async function save() {
    setSaving(true)
    setErrors({})
    try {
      setJustSaved(true)
      await onSave(draft)
    } catch (error) {
      setJustSaved(false)
      setErrors(error instanceof ApiError ? error.fieldErrors : {})
      toast.error("Not saved", { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="@container/seo">
      {/* Navigation away with unsaved SEO edits asks first (shell registry). */}
      <UnsavedGuard when={dirty} />
      <div className="grid gap-6 @3xl/seo:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <SchemaForm
            schema={seoSchema}
            meta={SEO_FIELDS_META}
            value={draft}
            onChange={(next) => setDraft(next as Seo)}
            errors={errors}
            resetKey={resetKey}
            disabled={!canEdit || saving}
            idPrefix={`seo-${kind}-${id}`}
          />
          {canEdit ? (
            <Button
              type="button"
              className={cn(FORM_ACTION, "self-start")}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save SEO"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              You can view these settings but not change them.
            </p>
          )}
        </div>
        <aside
          aria-label="SEO previews"
          className="order-first flex min-w-0 flex-col gap-6 @3xl/seo:order-none"
        >
          <SerpPreview
            host={host}
            path={path}
            title={title}
            description={description ?? ""}
          />
          <SocialCard
            host={host}
            title={filled(draft.ogTitle) ?? title}
            description={filled(draft.ogDescription) ?? description ?? ""}
            imageUrl={imageUrl}
          />
          <SeoChecklist results={results} />
        </aside>
      </div>
    </div>
  )
}
