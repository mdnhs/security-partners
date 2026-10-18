"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, History, Send } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import type { StatusPillSpec } from "@/components/admin/kit/content-status"
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import { useAssistantScreen } from "@/components/admin/ai/assistant-context"
import {
  type FocusedTextField,
  SchemaForm,
} from "@/components/admin/schema-form/schema-form"
import { Button, buttonClassName } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useAutosave } from "@/hooks/use-autosave"
import { ApiError, errorMessage } from "@/lib/api-client"
import type { RevisionEntity, VersionedDto } from "@/lib/schemas/api/content"

import { useAdminSession } from "@/components/admin/session-provider"
import { useMediaQuery } from "@/hooks/use-media-query"

import { ConflictDialog } from "./conflict-dialog"
import { EDITOR_ACTION, EditorLayout } from "./editor-layout"
import { LivePreviewToggle, useLivePreview } from "./live-preview-toggle"
import { PreviewPane } from "./preview-pane"
import { PublishDialog } from "./publish-dialog"
import { RevisionDrawer } from "./revision-drawer"
import { SaveStateIndicator } from "./save-state"
import { UnsavedGuard } from "./unsaved-guard"

/** Zod issues → `{ "hero.heading": ["Required"] }` (client-side, before save/publish). */
export function issuesToFieldErrors(
  error: z.ZodError
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_root"
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

export type VersionedEditorProps<Dto extends VersionedDto<unknown>> = {
  title: string
  /** Omit inside route tabs (Settings): the tab rail is the way back. */
  backHref?: string
  backLabel?: string
  /** Public path shown in the header (e.g. "/services/x"). */
  path?: string
  queryKey: readonly unknown[]
  load: () => Promise<Dto>
  saveDraft: (draft: unknown, version: number) => Promise<Dto>
  publish: (version: number) => Promise<Dto>
  restore: (revisionId: string, version: number) => Promise<Dto>
  schema: z.ZodObject
  meta: EditorMeta
  revisions: { entity: RevisionEntity; id: string }
  previewHref?: string
  publicHref?: string
  canEdit: boolean
  canPublish: boolean
  /** Extra header actions (e.g. delete a service, an article's workflow). */
  actions?: EditorSlot<Dto>
  /** Side panel (e.g. a service's slug, an article's settings). */
  aside?: EditorSlot<Dto>
  /** See EditorLayout: "xl" puts the side panel beside the form sooner. */
  asideColumnFrom?: "xl" | "2xl"
  /** See EditorLayout: long titles keep room beside the actions. */
  longTitle?: boolean
  /**
   * Status pills (default: Draft / Published / Unpublished changes), from
   * the record and whether it has edits the site does not show.
   */
  status?: (record: Dto, dirty: boolean) => readonly StatusPillSpec[]
}

/** A plain node, or one rendered from the editor's state. */
export type EditorSlot<Dto> =
  ReactNode | ((ctx: EditorActionContext<Dto>) => ReactNode)

/** Renders an EditorSlot: a plain node as is, a function with the context. */
function Slot<Dto>({
  value,
  ctx,
}: {
  value: EditorSlot<Dto>
  ctx: EditorActionContext<Dto>
}) {
  return typeof value === "function" ? value(ctx) : value
}

/** What render-prop actions and side panels get from the editor. */
export type EditorActionContext<Dto> = {
  /** The record as last returned by the API. */
  record: Dto
  /** The form's current (possibly unsaved) draft. */
  draft: unknown
  /** Saves pending edits now; false when the draft is invalid or the save failed. */
  flush: () => Promise<boolean>
  /** The version to send with the next request (updated after every save). */
  version: () => number
  /** Takes a record returned by another request (new status/version). */
  accept: (dto: Dto) => void
  /**
   * Someone else changed the record (a 409's `current`): the form, the
   * header and the version switch to their record, so a retry is current.
   */
  takeTheirs: (dto: Dto) => void
  /** Marks every invalid field; true when there were errors. */
  showAllErrors: () => boolean
  /** True while the form may be edited. */
  canEdit: boolean
}

/**
 * Draft editor for any versioned record (spec §8.2): autosave (1.5 s),
 * ⌘S, save-state, unsaved guard, publish with diff, history + restore,
 * conflict dialog on 409, optimistic cache with rollback.
 */
export function VersionedEditor<Dto extends VersionedDto<unknown>>(
  props: VersionedEditorProps<Dto>
) {
  const query = useQuery({
    queryKey: props.queryKey,
    queryFn: props.load,
    staleTime: 0,
  })
  if (query.isPending)
    return (
      <div
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Loading editor"
      >
        <Skeleton className="bg-skeleton rounded-card h-20" />
        <Skeleton className="bg-skeleton rounded-card h-64" />
        <Skeleton className="bg-skeleton rounded-card h-64" />
      </div>
    )
  if (query.isError)
    return (
      <div
        role="alert"
        className="rounded-card flex flex-col items-start gap-3 border bg-card p-6"
      >
        <p className="font-medium">This editor could not be loaded.</p>
        <p className="text-sm text-muted-foreground">
          {errorMessage(query.error)}
        </p>
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )
  return <LoadedEditor {...props} initial={query.data} />
}

function LoadedEditor<Dto extends VersionedDto<unknown>>({
  initial,
  ...props
}: VersionedEditorProps<Dto> & { initial: Dto }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<unknown>(initial.draft)
  const [base, setBase] = useState({
    version: initial.version,
    saved: initial.draft,
  })
  const [record, setRecord] = useState<Dto>(initial)
  const [resetKey, setResetKey] = useState(0)
  // Live preview (ruling D9): an opt-in switch, only where the pane fits
  // (2xl). Never a hidden pane: the preview route switches draft mode on.
  const { user } = useAdminSession()
  const [livePreview, setLivePreview] = useLivePreview(user.id)
  const wide = useMediaQuery("(min-width: 1536px)")
  const paneAvailable = !!props.previewHref && wide
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >()
  const [publishOpen, setPublishOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // The version to send next. Updated synchronously (a publish right after
  // a save must use the version that save returned).
  const baseRef = useRef(base)

  const accept = (dto: Dto, savedDraft: unknown = dto.draft) => {
    const next = { version: dto.version, saved: savedDraft }
    baseRef.current = next
    setBase(next)
    setRecord(dto)
    queryClient.setQueryData(props.queryKey, dto)
    // The list screen (e.g. ["pages"]) shows status badges: refetch it next time.
    void queryClient.invalidateQueries({
      queryKey: props.queryKey.slice(0, 1),
      exact: true,
    })
  }
  // Until the user interacts with the form, whatever it emits is its own
  // normalization of the loaded draft (e.g. a composed stat value): that is
  // the saved baseline, not an edit to autosave.
  const touched = useRef(false)
  const markTouched = () => {
    touched.current = true
  }
  // AI assistant (spec §8.3): the open record and the focused text field.
  const assistant = useAssistantScreen({
    title: props.title,
    entityType: props.revisions.entity,
    entityId: props.revisions.id,
    record: draft,
  })
  const onFieldFocus = (field: FocusedTextField) =>
    assistant.setField({
      path: field.path,
      label: field.label,
      maxLength: field.maxLength,
      multiline: field.multiline,
      elementId: field.elementId,
      read: field.read,
      // An inserted suggestion is an edit like typing: autosave picks it up.
      apply: (text) => {
        markTouched()
        return field.setValue(text)
      },
    })
  const onFormChange = (value: unknown) => {
    if (!touched.current) {
      baseRef.current = { ...baseRef.current, saved: value }
      setBase(baseRef.current)
    }
    setDraft(value)
  }
  const replaceDraft = (dto: Dto) => {
    touched.current = false
    accept(dto)
    setDraft(dto.draft)
    setFieldErrors(undefined)
    setResetKey((k) => k + 1)
  }

  // The 409 of the latest draft save (if any): a publish whose pre-save hit
  // it is already handled by the autosave conflict dialog.
  const saveConflict = useRef<ApiError | null>(null)
  // A 409 from the publish call itself (someone saved after our last save).
  const [publishConflict, setPublishConflict] = useState<ApiError | null>(null)
  // "Overwrite with mine" saves once the new base has rendered (the
  // autosave hook compares against it).
  const [flushRequest, setFlushRequest] = useState(0)

  const save = useMutation({
    mutationFn: (value: unknown) => {
      saveConflict.current = null
      return props.saveDraft(value, baseRef.current.version)
    },
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: props.queryKey })
      const previous = queryClient.getQueryData<Dto>(props.queryKey)
      if (previous)
        queryClient.setQueryData(props.queryKey, { ...previous, draft: value })
      return { previous }
    },
    onError: (error, _value, context) => {
      if (context?.previous)
        queryClient.setQueryData(props.queryKey, context.previous)
      if (error instanceof ApiError && error.status === 422)
        setFieldErrors(error.fieldErrors)
      if (error instanceof ApiError && error.isConflict)
        saveConflict.current = error
    },
    onSuccess: (dto, value) => {
      accept(dto, value)
      setFieldErrors(undefined)
    },
  })

  const autosave = useAutosave({
    value: draft,
    savedValue: base.saved,
    save: async (value) => {
      await save.mutateAsync(value)
    },
    isValid: (value) => props.schema.safeParse(value).success,
    enabled: props.canEdit,
  })
  const { flush } = autosave
  useEffect(() => {
    if (flushRequest > 0) void flush()
  }, [flushRequest, flush])

  const showAllErrors = () => {
    const result = props.schema.safeParse(draft)
    if (result.success) return false
    const errors = issuesToFieldErrors(result.error)
    setFieldErrors(errors)
    toast.error(`Fix ${Object.keys(errors).length} field(s) first`, {
      description: "The fields with problems are marked in red.",
    })
    return true
  }

  // ⌘S / Ctrl+S saves now.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key?.toLowerCase() !== "s" || !(event.metaKey || event.ctrlKey))
        return
      event.preventDefault()
      if (!props.canEdit || showAllErrors()) return
      void autosave.flush()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  const publish = useMutation({
    mutationFn: async () => {
      saveConflict.current = null
      if (!(await autosave.flush()))
        throw (
          saveConflict.current ??
          new Error("Save your changes before publishing.")
        )
      return props.publish(baseRef.current.version)
    },
    onSuccess: (dto) => {
      accept(dto)
      setPublishOpen(false)
      void queryClient.invalidateQueries({
        queryKey: ["revisions", props.revisions.entity, props.revisions.id],
      })
      toast.success("Published", {
        description: "The site shows the new version now.",
        action: props.publicHref
          ? {
              label: "View",
              onClick: () =>
                window.open(props.publicHref, "_blank", "noopener"),
            }
          : undefined,
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isConflict) {
        // Resolve the conflict first; the conflict dialog takes over.
        setPublishOpen(false)
        if (error !== saveConflict.current) setPublishConflict(error)
        return
      }
      toast.error("Not published", { description: errorMessage(error) })
    },
  })

  const conflict = autosave.conflict ?? publishConflict
  const current = (conflict?.current ?? null) as Dto | null
  const actionContext: EditorActionContext<Dto> = {
    record,
    draft,
    flush: autosave.flush,
    version: () => baseRef.current.version,
    accept: (dto) => accept(dto),
    takeTheirs: (dto) => {
      replaceDraft(dto)
      void queryClient.invalidateQueries({
        queryKey: ["revisions", props.revisions.entity, props.revisions.id],
      })
    },
    showAllErrors,
    canEdit: props.canEdit,
  }
  // Rendered by a child (Slot): the context's functions read refs, which
  // only event handlers may call, never this render.
  const slot = (value: EditorSlot<Dto>) =>
    value == null || value === false ? null : (
      <Slot value={value} ctx={actionContext} />
    )
  const dirty = autosave.dirty || record.dirty
  const resolveConflict = () => {
    autosave.resolveConflict()
    setPublishConflict(null)
  }

  return (
    <>
      <UnsavedGuard when={autosave.state !== "saved"} />
      <EditorLayout
        backHref={props.backHref}
        backLabel={props.backLabel}
        title={props.title}
        path={props.path}
        status={
          props.status
            ? props.status(record, dirty)
            : { published: record.published, dirty }
        }
        saveState={
          props.canEdit ? (
            <SaveStateIndicator
              state={autosave.state}
              onRetry={() => void autosave.flush()}
            />
          ) : null
        }
        actions={
          <>
            {slot(props.actions)}
            {paneAvailable ? (
              <LivePreviewToggle
                checked={livePreview}
                onCheckedChange={setLivePreview}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={EDITOR_ACTION}
              onClick={() => setHistoryOpen(true)}
            >
              <History aria-hidden />
              {/* Icon only on phones; the name stays (WCAG 2.5.3). */}
              <span className="max-sm:sr-only">History</span>
            </Button>
            {props.previewHref ? (
              <a
                href={props.previewHref}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonClassName({ variant: "outline" }),
                  EDITOR_ACTION
                )}
              >
                <Eye aria-hidden />
                <span className="max-sm:sr-only">Preview</span>
              </a>
            ) : null}
            {props.canPublish ? (
              <Button
                type="button"
                className={EDITOR_ACTION}
                onClick={() => {
                  if (showAllErrors()) return
                  setPublishOpen(true)
                }}
              >
                <Send aria-hidden />
                Publish
              </Button>
            ) : null}
          </>
        }
        aside={slot(props.aside)}
        asideColumnFrom={props.asideColumnFrom}
        longTitle={props.longTitle}
        preview={
          paneAvailable && livePreview ? (
            <PreviewPane src={props.previewHref!} refreshKey={base.version} />
          ) : undefined
        }
      >
        <div
          onKeyDownCapture={markTouched}
          onPointerDownCapture={markTouched}
          onInputCapture={markTouched}
          onPasteCapture={markTouched}
          onDropCapture={markTouched}
        >
          <SchemaForm
            schema={props.schema}
            meta={props.meta}
            value={draft as never}
            onChange={onFormChange}
            errors={fieldErrors}
            resetKey={resetKey}
            disabled={!props.canEdit}
            sectionTabs="Sections"
            onFieldFocus={props.canEdit ? onFieldFocus : undefined}
          />
        </div>
      </EditorLayout>
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        meta={props.meta}
        published={record.published}
        draft={draft}
        pending={publish.isPending}
        onConfirm={() => publish.mutate()}
      />
      <RevisionDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entity={props.revisions.entity}
        entityId={props.revisions.id}
        canRestore={props.canEdit}
        onRestore={async (revision) => {
          try {
            const dto = await props.restore(
              revision.id,
              baseRef.current.version
            )
            replaceDraft(dto)
            toast.success(`Version ${revision.version} restored into the draft`)
          } catch (error) {
            toast.error("Not restored", { description: errorMessage(error) })
            throw error
          }
        }}
      />
      <ConflictDialog
        open={conflict !== null}
        updatedBy={current?.updatedBy?.name ?? null}
        updatedAt={current?.updatedAt ?? null}
        onReload={() => {
          if (current) replaceDraft(current)
          resolveConflict()
        }}
        onOverwrite={() => {
          // Their record becomes the base; saving mine over it sends their
          // version, so the server accepts it.
          if (current) {
            baseRef.current = { version: current.version, saved: current.draft }
            setBase(baseRef.current)
          }
          resolveConflict()
          setFlushRequest((n) => n + 1)
        }}
        onCopyMine={async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(draft, null, 2))
            toast.success("Your version is on the clipboard")
          } catch {
            toast.error("Could not copy to the clipboard")
          }
          if (current) replaceDraft(current)
          resolveConflict()
        }}
      />
    </>
  )
}
