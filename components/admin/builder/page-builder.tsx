"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Eye,
  EyeOff,
  History,
  Layers,
  Lock,
  RotateCcw,
  Send,
  TriangleAlert,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { BLOCK_BY_TYPE, type BlockType } from "@/blocks/registry"
import { ConflictDialog } from "@/components/admin/editor/conflict-dialog"
import { PreviewPane } from "@/components/admin/editor/preview-pane"
import { PublishDialog } from "@/components/admin/editor/publish-dialog"
import { RevisionDrawer } from "@/components/admin/editor/revision-drawer"
import { SaveStateIndicator } from "@/components/admin/editor/save-state"
import { UnsavedGuard } from "@/components/admin/editor/unsaved-guard"
import { FormCard } from "@/components/admin/form/form-ui"
import { ContentStatusPills } from "@/components/admin/kit/content-status"
import {
  COARSE_HEIGHT,
  FORM_ACTION,
  PageHeader,
} from "@/components/admin/page-header"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { SEO_FIELDS_META } from "@/components/admin/seo/seo-meta"
import { SerpPreview } from "@/components/admin/seo/serp-preview"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button, buttonClassName } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMediaQuery } from "@/hooks/use-media-query"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { isDeepEqual } from "@/lib/json"
import {
  type BuilderPageDto,
  builderPath,
} from "@/lib/schemas/api/builder-pages"
import { previewHref } from "@/lib/schemas/api/preview"
import { type Seo, seo as seoSchema } from "@/lib/schemas/common"
import { filled } from "@/lib/seo/effective"
import { cn } from "@/lib/utils"

import { BlockForm } from "./block-form"
import { BLOCK_ICONS, BlockLibrary } from "./block-library"
import { BlockMeta } from "./block-meta"
import { BlockOutline } from "./block-outline"
import {
  addableTypes,
  type BlockPublishErrors,
  type DocAction,
  docReducer,
  type DraftDocumentValue,
  publishErrors,
  readDraft,
} from "./builder-state"
import {
  BUILDER_PAGES_KEY,
  slugProblem,
  TitleSlugFields,
} from "./new-page-dialog"
import { UnsavedChangesError, useBuilderAutosave } from "./use-builder-autosave"

const detailKey = (id: string) => [...BUILDER_PAGES_KEY, id] as const

type Tab = "content" | "seo"
const isTab = (value: string | null): value is Tab =>
  value === "content" || value === "seo"

/** PUT bodies a keepalive request may carry (browsers cap them at 64 KB). */
export const KEEPALIVE_MAX_BYTES = 64 * 1024

/**
 * PUT /builder-pages/:id/draft. When the tab is closing (`keepalive`) and
 * the body fits, a keepalive fetch, which may outlive the page; otherwise
 * the typed client.
 */
export async function putBuilderDraft(
  id: string,
  draft: DraftDocumentValue,
  version: number,
  keepalive = false
): Promise<BuilderPageDto> {
  const body = JSON.stringify({ version, draft })
  if (keepalive && new TextEncoder().encode(body).length < KEEPALIVE_MAX_BYTES)
    return unwrap(
      fetch(`/api/v1/admin/builder-pages/${encodeURIComponent(id)}/draft`, {
        method: "PUT",
        keepalive: true,
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body,
      }) as Promise<Response & { json(): Promise<BuilderPageDto> }>
    )
  return unwrap(
    api["builder-pages"][":id"].draft.$put({
      param: { id },
      json: { version, draft },
    })
  )
}

/** No keys and no diff noise: the publish dialog lists block paths. */
const PUBLISH_META = { fields: {} }

/**
 * The page builder for /p/<slug> (spec §7.5, MK page builder parity):
 * outline, block settings and live preview; autosave, history, preview,
 * discard and publish; SEO tab with the page's title and address.
 */
export function PageBuilder(props: { id: string }) {
  const query = useQuery({
    queryKey: detailKey(props.id),
    queryFn: () =>
      unwrap(api["builder-pages"][":id"].$get({ param: { id: props.id } })),
    staleTime: 0,
  })
  if (query.isPending || (query.isSuccess && !query.isFetchedAfterMount))
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="sr-only">Loading the page builder…</span>
        <Skeleton className="bg-skeleton rounded-card h-24" />
        <div className="grid gap-5 xl:grid-cols-[288px_minmax(0,1fr)_minmax(0,1fr)]">
          <Skeleton className="bg-skeleton rounded-card h-96" />
          <Skeleton className="bg-skeleton rounded-card h-96" />
          <Skeleton className="bg-skeleton rounded-card h-96" />
        </div>
      </div>
    )
  if (query.isError)
    return (
      <div
        role="alert"
        className="rounded-card flex flex-col items-start gap-3 border bg-card p-6"
      >
        <p className="font-medium">This page could not be loaded.</p>
        <p className="text-sm text-muted-foreground">
          {errorMessage(query.error)}
        </p>
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )
  return <Builder key={props.id} initial={query.data} />
}

function Builder({ initial }: { initial: BuilderPageDto }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const tab: Tab = isTab(tabParam) ? tabParam : "content"
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "content") params.delete("tab")
    else params.set("tab", next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const readOnly = !canEdit
  const id = initial.id

  const [record, setRecord] = useState(initial)
  const [initialRead] = useState(() => readDraft(initial.draft))
  // A stored draft that no longer parses: its problems, shown instead of
  // the editor; autosave stays off so it is never overwritten (D5.5 I2).
  const [broken, setBroken] = useState<string[] | null>(
    initialRead.ok ? null : initialRead.problems
  )
  const [doc, setDoc] = useState<DraftDocumentValue>(() =>
    initialRead.ok ? initialRead.doc : { blocks: [] }
  )
  const docRef = useRef(doc)
  const [selectedId, setSelectedId] = useState<string | null>(
    doc.blocks[0]?.id ?? null
  )
  // A restore / reload / discard replaced the document: open forms reload.
  const [resetKey, setResetKey] = useState(0)
  // Publish 422s, keyed by block id against the document that was sent.
  const [blockErrors, setBlockErrors] = useState<
    Record<string, BlockPublishErrors>
  >({})
  const [publishOpen, setPublishOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const wide = useMediaQuery("(min-width: 1280px)")

  const syncRecord = useCallback(
    (dto: BuilderPageDto) => {
      setRecord(dto)
      queryClient.setQueryData(detailKey(dto.id), dto)
      void queryClient.invalidateQueries({
        queryKey: BUILDER_PAGES_KEY,
        exact: true,
      })
    },
    [queryClient]
  )

  const autosave = useBuilderAutosave({
    id,
    version: initial.version,
    doc,
    enabled: canEdit && broken === null,
    save: async (value, version, options) => {
      const dto = await putBuilderDraft(id, value, version, options?.keepalive)
      syncRecord(dto)
      return dto
    },
  })

  /** A read-only role can look around; nothing it touches changes. */
  const apply = useCallback(
    (action: DocAction) => {
      if (readOnly) return docRef.current
      const next = docReducer(docRef.current, action)
      if ("id" in action)
        setBlockErrors((errors) => {
          if (!errors[action.id]) return errors
          const rest = { ...errors }
          delete rest[action.id]
          return rest
        })
      docRef.current = next
      setDoc(next)
      return next
    },
    [readOnly]
  )

  /**
   * Their document (restore, conflict reload, discard) replaces mine. False
   * when the result was older than a save since and was skipped (D5 N4):
   * the caller then shows no success message.
   */
  const replaceDoc = useCallback(
    (dto: BuilderPageDto): boolean => {
      // An older result than what was saved since never goes on screen.
      if (!autosave.accept(dto)) return false
      const read = readDraft(dto.draft)
      syncRecord(dto)
      setBlockErrors({})
      if (!read.ok) {
        setBroken(read.problems)
        return true
      }
      setBroken(null)
      const next = read.doc
      docRef.current = next
      setDoc(next)
      setResetKey((k) => k + 1)
      setSelectedId((current) =>
        next.blocks.some((b) => b.id === current)
          ? current
          : (next.blocks[0]?.id ?? null)
      )
      return true
    },
    [autosave, syncRecord]
  )

  const revisionsKey = ["revisions", "builder-page", id]

  // ⌘S / Ctrl+S saves now.
  useEffect(() => {
    if (readOnly) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void autosave.flush()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [autosave, readOnly])

  /** Errors of exclusive requests: a 409 opens the conflict dialog itself. */
  const failed = (title: string) => (error: unknown) => {
    if (error instanceof ApiError && error.isConflict) return
    if (error instanceof UnsavedChangesError) {
      toast.error(title, { description: error.message })
      return
    }
    toast.error(title, { description: errorMessage(error) })
  }

  const publish = useMutation({
    mutationFn: async () => {
      const sent = docRef.current
      try {
        return await autosave.exclusive((version) =>
          unwrap(
            api["builder-pages"][":id"].publish.$post({
              param: { id },
              json: { version },
            })
          )
        )
      } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
          const errors = publishErrors(error.fieldErrors, sent)
          setBlockErrors(errors)
          const [first] = Object.keys(errors)
          if (first) setSelectedId(first)
        }
        throw error
      }
    },
    onSuccess: (dto) => {
      autosave.accept(dto)
      syncRecord(dto)
      setBlockErrors({})
      setPublishOpen(false)
      void queryClient.invalidateQueries({ queryKey: revisionsKey })
      toast.success("Published", {
        description: `${dto.path} shows the new version now.`,
        action: {
          label: "View",
          onClick: () => window.open(dto.path, "_blank", "noopener"),
        },
      })
    },
    onError: (error) => {
      setPublishOpen(false)
      if (error instanceof ApiError && error.status === 422) {
        toast.error("Not published", {
          description:
            "Some blocks need attention: they are marked in the outline.",
        })
        return
      }
      failed("Not published")(error)
    },
  })

  const discard = useMutation({
    mutationFn: () => {
      const published = record.published
      if (!published) throw new Error("Nothing published to go back to.")
      // Pending edits are about to be thrown away: not sent first (M8).
      return autosave.exclusive(
        (version) => putBuilderDraft(id, published, version),
        { discardPending: true, replaces: true }
      )
    },
    onSuccess: (dto) => {
      setDiscardOpen(false)
      if (!replaceDoc(dto)) return
      toast.success("Changes discarded", {
        description: "The draft is the published page again.",
      })
    },
    onError: (error) => {
      setDiscardOpen(false)
      failed("Not discarded")(error)
    },
  })

  const conflict = autosave.conflict
  const selectedIndex = doc.blocks.findIndex((b) => b.id === selectedId)
  const selected = selectedIndex >= 0 ? doc.blocks[selectedIndex] : null
  const selectedErrors = selected ? blockErrors[selected.id] : undefined
  const outlineErrors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(blockErrors).map(([key, e]) => [key, e.summary])
      ),
    [blockErrors]
  )
  // While the draft is unreadable only the server's flag counts.
  const dirty = record.dirty || (broken === null && autosave.state !== "saved")
  const published = record.published !== null
  const preview = previewHref("builder-page", id)
  const SelectedIcon = selected
    ? BLOCK_ICONS[BLOCK_BY_TYPE[selected.type].icon]
    : null

  const onAdd = (type: BlockType) => {
    const before = new Set(docRef.current.blocks.map((b) => b.id))
    const at =
      selectedIndex >= 0 ? selectedIndex + 1 : docRef.current.blocks.length
    const next = apply({ type: "add", blockType: type, at })
    const added = next.blocks.find((b) => !before.has(b.id))
    if (added) setSelectedId(added.id)
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* An unreadable draft: nothing can be saved, so nothing is "unsaved". */}
      <UnsavedGuard
        when={canEdit && broken === null && autosave.state !== "saved"}
      />
      <PageHeader
        breadcrumbs={[
          { label: "Pages", href: "/admin/pages" },
          { label: record.title },
        ]}
        title={record.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-card px-2 py-1 font-mono text-xs text-foreground">
              {record.path}
            </code>
            <ContentStatusPills
              record={{ published: published ? true : null, dirty }}
            />
          </span>
        }
        actions={
          <>
            {canEdit && broken === null ? (
              <SaveStateIndicator
                state={autosave.state}
                onRetry={() => void autosave.flush()}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              onClick={() => setHistoryOpen(true)}
            >
              <History aria-hidden />
              <span className="max-sm:sr-only">History</span>
            </Button>
            <a
              href={preview}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonClassName({ variant: "outline" }),
                FORM_ACTION
              )}
            >
              <Eye aria-hidden />
              <span className="max-sm:sr-only">Preview</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            {canEdit && published && broken === null ? (
              <Button
                type="button"
                variant="outline"
                className={FORM_ACTION}
                disabled={!dirty || discard.isPending}
                onClick={() => setDiscardOpen(true)}
              >
                <RotateCcw aria-hidden />
                Discard
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                type="button"
                className={FORM_ACTION}
                // Resolve an open conflict first (its dialog says how).
                disabled={
                  conflict !== null || broken !== null || publish.isPending
                }
                onClick={() => setPublishOpen(true)}
              >
                <Send aria-hidden />
                Publish
              </Button>
            ) : null}
          </>
        }
      />
      {readOnly ? (
        <p
          role="note"
          className="rounded-card flex items-start gap-3 border border-dashed bg-card p-4 text-sm"
        >
          <Lock
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <span>
            <span className="font-semibold">View only.</span>{" "}
            <span className="text-muted-foreground">
              Your role can read this page but not change or publish it.
            </span>
          </span>
        </p>
      ) : null}
      {broken !== null ? (
        <section
          role="alert"
          aria-labelledby="builder-unreadable"
          className="rounded-card flex flex-col gap-3 border border-destructive/40 bg-card p-5 text-sm"
        >
          <h2
            id="builder-unreadable"
            className="flex items-center gap-2 font-semibold text-destructive"
          >
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            This draft cannot be opened in the builder
          </h2>
          <p>
            The saved draft breaks rules the builder now enforces. Autosave is
            off, so nothing here changes it. Restore a version from History to
            carry on editing.
          </p>
          <ul aria-label="Problems" className="list-disc pl-5">
            {broken.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </section>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          className="gap-5"
        >
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="content" className={COARSE_HEIGHT}>
              Content
            </TabsTrigger>
            <TabsTrigger value="seo" className={COARSE_HEIGHT}>
              SEO
            </TabsTrigger>
          </TabsList>
          <TabsContent value="content">
            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[288px_minmax(0,1fr)_minmax(0,1fr)]">
              <nav
                aria-label="Page outline"
                className="rounded-card flex min-w-0 flex-col gap-4 bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-card-title">Blocks</h2>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                    <span className="sr-only">Blocks on the page: </span>
                    {doc.blocks.length}
                  </span>
                </div>
                <BlockOutline
                  doc={doc}
                  selectedId={selectedId}
                  errors={outlineErrors}
                  readOnly={readOnly}
                  onSelect={setSelectedId}
                  dispatch={apply}
                />
                {canEdit ? (
                  <BlockLibrary
                    available={addableTypes(doc)}
                    doc={doc}
                    onAdd={onAdd}
                  />
                ) : null}
              </nav>
              <section
                aria-label="Block settings"
                className="flex min-w-0 flex-col gap-5"
              >
                {selected ? (
                  <>
                    <div className="rounded-card flex items-center gap-3 bg-card p-4">
                      <span
                        aria-hidden
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
                      >
                        {SelectedIcon ? (
                          <SelectedIcon className="size-5" />
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-card-title truncate">
                          {BLOCK_BY_TYPE[selected.type].label}
                        </h2>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          #{selected.anchor}
                        </p>
                      </div>
                    </div>
                    {selectedErrors?.summary.length ? (
                      // A static region: an alert would re-announce on every
                      // selection of the block (the publish toast announces).
                      <section
                        aria-labelledby="builder-block-problems"
                        className="rounded-card border border-destructive/40 bg-destructive/5 p-4 text-sm"
                      >
                        <h3
                          id="builder-block-problems"
                          className="font-semibold text-destructive"
                        >
                          Fix this block before publishing:
                        </h3>
                        <ul className="mt-1 list-disc pl-5">
                          {selectedErrors.summary.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    <BlockForm
                      key={selected.id}
                      block={selected}
                      resetKey={resetKey}
                      errors={selectedErrors?.data ?? {}}
                      readOnly={readOnly}
                      onChange={(data) =>
                        apply({ type: "data", id: selected.id, data })
                      }
                    />
                    <BlockMeta
                      block={selected}
                      doc={doc}
                      errors={selectedErrors?.anchor}
                      readOnly={readOnly}
                      onChange={(patch) =>
                        apply({ type: "meta", id: selected.id, patch })
                      }
                    />
                  </>
                ) : (
                  <div className="rounded-card flex flex-col items-center gap-3 bg-card px-4 py-16 text-center">
                    <span
                      aria-hidden
                      className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
                    >
                      <Layers className="size-6" />
                    </span>
                    <p className="font-semibold">
                      {doc.blocks.length === 0
                        ? "Start with a block"
                        : "Choose a block to edit it"}
                    </p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      {doc.blocks.length === 0
                        ? "Pages are built from the site's sections: a hero, stats, cards, text and more."
                        : "Pick one in the outline to change its content."}
                    </p>
                  </div>
                )}
              </section>
              {wide ? (
                <PreviewPane
                  src={preview}
                  refreshKey={autosave.savedCount}
                  className="h-[calc(100svh-12rem)] xl:sticky xl:top-4"
                />
              ) : (
                <div className="flex min-w-0 flex-col gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(FORM_ACTION, "self-start")}
                    aria-expanded={showPreview}
                    aria-controls="builder-preview"
                    onClick={() => setShowPreview((v) => !v)}
                  >
                    {showPreview ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    {showPreview ? "Hide preview" : "Show preview"}
                  </Button>
                  <div id="builder-preview">
                    {showPreview ? (
                      <PreviewPane
                        src={preview}
                        refreshKey={autosave.savedCount}
                        className="h-[75svh]"
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="seo" className="flex flex-col gap-6">
            <AddressCard
              // A reload / restore that changed them starts the form afresh.
              key={`${record.title}\u0000${record.slug}`}
              record={record}
              readOnly={readOnly}
              exclusive={autosave.exclusive}
              onChanged={(dto) => {
                autosave.accept(dto)
                syncRecord(dto)
              }}
            />
            <SeoCard record={record} doc={doc} onSaved={syncRecord} />
          </TabsContent>
        </Tabs>
      )}
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        meta={PUBLISH_META}
        published={record.published}
        draft={doc}
        pending={publish.isPending}
        onConfirm={() => publish.mutate()}
      />
      <RevisionDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entity="builder-page"
        entityId={id}
        canRestore={canEdit}
        onRestore={async (revision) => {
          try {
            const dto = await autosave.exclusive(
              (version) =>
                unwrap(
                  api["builder-pages"][":id"].restore.$post({
                    param: { id },
                    json: { revisionId: revision.id, version },
                  })
                ),
              { replaces: true }
            )
            if (replaceDoc(dto))
              toast.success(
                `Version ${revision.version} restored into the draft`
              )
          } catch (error) {
            if (error instanceof ApiError && error.isConflict) {
              setHistoryOpen(false)
              return
            }
            failed("Not restored")(error)
            throw error
          }
        }}
      />
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unpublished changes?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft goes back to the published page. Earlier versions stay
              in History.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep changes</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={discard.isPending}
              onClick={() => discard.mutate()}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConflictDialog
        open={conflict !== null || autosave.state === "conflict"}
        updatedBy={conflict?.updatedBy?.name ?? null}
        updatedAt={conflict?.updatedAt ?? null}
        onReload={() => {
          if (conflict) replaceDoc(conflict)
          else window.location.reload()
        }}
        onOverwrite={() => {
          if (!conflict) {
            toast.error("Their version could not be loaded", {
              description: "Copy yours, then reload the page.",
            })
            return
          }
          // No editable document of mine (an unreadable draft): nothing to
          // put over theirs, so take theirs.
          if (broken !== null) {
            replaceDoc(conflict)
            return
          }
          // Their version and draft become the saved copy; mine stays on
          // screen, so the flush sends it on their version (D5.5 I1).
          autosave.accept(conflict, { keepMine: true })
          syncRecord(conflict)
          const theirs = readDraft(conflict.draft)
          if (theirs.ok && isDeepEqual(theirs.doc, docRef.current)) {
            toast.success("Their version is the same as yours", {
              description: "Nothing needed replacing.",
            })
            return
          }
          void autosave.flush().then((ok) => {
            if (ok)
              toast.success("Your version replaced theirs", {
                description: published
                  ? "Publish to put it on the site."
                  : undefined,
              })
            else
              toast.error("Your version was not saved", {
                description: "Try again, or reload their version.",
              })
          })
        }}
        onCopyMine={async () => {
          try {
            await navigator.clipboard.writeText(
              JSON.stringify(docRef.current, null, 2)
            )
            toast.success("Your version is on the clipboard")
          } catch {
            toast.error("Could not copy to the clipboard")
          }
          if (conflict) replaceDoc(conflict)
        }}
      />
    </div>
  )
}

/** Title and address: columns, live at once; a published page's move adds a 301. */
function AddressCard({
  record,
  readOnly,
  exclusive,
  onChanged,
}: {
  record: BuilderPageDto
  readOnly: boolean
  exclusive: ReturnType<typeof useBuilderAutosave>["exclusive"]
  onChanged(dto: BuilderPageDto): void
}) {
  const [value, setValue] = useState({
    title: record.title,
    slug: record.slug,
  })
  const [serverErrors, setServerErrors] = useState<{
    title?: string
    slug?: string
  }>({})
  const changed = value.title !== record.title || value.slug !== record.slug
  const local = {
    title: value.title.trim() ? undefined : "Enter a title",
    slug: slugProblem(value.slug) ?? undefined,
  }
  const errors = {
    title: serverErrors.title ?? local.title,
    slug: serverErrors.slug ?? local.slug,
  }
  const save = useMutation({
    mutationFn: () =>
      exclusive((version) =>
        unwrap(
          api["builder-pages"][":id"].meta.$patch({
            param: { id: record.id },
            json: {
              version,
              ...(value.title.trim() !== record.title
                ? { title: value.title.trim() }
                : {}),
              ...(value.slug !== record.slug ? { slug: value.slug } : {}),
            },
          })
        )
      ),
    onSuccess: (dto) => {
      onChanged(dto)
      setValue({ title: dto.title, slug: dto.slug })
      toast.success("Saved", {
        description:
          dto.slug !== record.slug && record.published
            ? `${builderPath(record.slug)} now redirects to ${dto.path}.`
            : undefined,
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && !error.isConflict) {
        setServerErrors({
          title: error.fieldErrors.title?.[0],
          slug: error.fieldErrors.slug?.[0],
        })
      }
      if (error instanceof ApiError && error.isConflict) return
      toast.error("Not saved", { description: errorMessage(error) })
    },
  })
  return (
    <FormCard id="builder-address" title="Page">
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!changed || local.title || local.slug) return
          save.mutate()
        }}
      >
        <TitleSlugFields
          value={value}
          errors={changed ? errors : serverErrors}
          disabled={readOnly || save.isPending}
          slugHelp={`The page's address: /p/${value.slug || "…"}. Changing the address adds a redirect from the old one.`}
          onChange={(next) => {
            setServerErrors({})
            setValue((v) => ({ ...v, ...next }))
          }}
        />
        {readOnly ? null : (
          <Button
            type="submit"
            className={cn(FORM_ACTION, "self-start")}
            disabled={!changed || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save title and address"}
          </Button>
        )}
      </form>
    </FormCard>
  )
}

/** The page's SEO fields (kind "builder"), saved live like SEO › Overview. */
function SeoCard({
  record,
  doc,
  onSaved,
}: {
  record: BuilderPageDto
  doc: DraftDocumentValue
  onSaved(dto: BuilderPageDto): void
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const [value, setValue] = useState<Seo>(record.seo)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  // Rendered only in the browser (after the page's query), never on the server.
  const host = typeof window === "undefined" ? "" : window.location.host
  const [first] = doc.blocks
  const heroDescription =
    first?.type === "hero.page" && typeof first.data.description === "string"
      ? first.data.description
      : ""
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.seo.entries[":kind"][":id"].$put({
          param: { kind: "builder", id: record.id },
          json: { seo: value },
        })
      ),
    onSuccess: () => {
      onSaved({ ...record, seo: value })
      setErrors({})
      toast.success("SEO saved", { description: "The live page uses it now." })
    },
    onError: (error) => {
      setErrors(error instanceof ApiError ? error.fieldErrors : {})
      toast.error("Not saved", { description: errorMessage(error) })
    },
  })
  return (
    <FormCard id="builder-seo" title="Search and sharing">
      <div className="flex flex-col gap-6">
        <SerpPreview
          title={filled(value.title) ?? record.title}
          host={host}
          path={record.path}
          description={filled(value.description) ?? heroDescription}
        />
        <SchemaForm
          schema={seoSchema}
          meta={SEO_FIELDS_META}
          value={value}
          onChange={(next) => setValue(next as Seo)}
          errors={errors}
          disabled={!canEdit || save.isPending}
          idPrefix={`seo-builder-${record.id.slice(0, 8)}`}
        />
        {canEdit ? (
          <Button
            type="button"
            className={cn(FORM_ACTION, "self-start")}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save SEO"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            You can view these settings but not change them.
          </p>
        )}
      </div>
    </FormCard>
  )
}
