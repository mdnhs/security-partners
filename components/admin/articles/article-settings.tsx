"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Info, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"

import type { EditorActionContext } from "@/components/admin/editor/versioned-editor"
import { ADMIN_CONTROL, FormCard } from "@/components/admin/form/form-ui"
import { NativeSelect } from "@/components/admin/schema-form/widgets/basic"
import {
  ErrorText,
  HelpText,
  LABEL_CLASS,
} from "@/components/admin/schema-form/widgets/field-shell"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { ArticleDto, ArticleOptions } from "@/lib/schemas/api/articles"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { cn } from "@/lib/utils"

type Ctx = EditorActionContext<ArticleDto>

/** The note that says why the featured article stays (described-by target). */
export const FEATURED_NOTE_ID = "article-featured-note"

/** Toast after a 409: the editor now shows the other person's record. */
export const CONFLICT_MESSAGE =
  "Someone else changed this article — it now shows their version."

/**
 * A stale version (409 with the current record): the editor takes their
 * record (header, form, version), so a retry sends the new version. False
 * for any other error (e.g. a 409 without a record: featured, slug taken).
 */
export function takeTheirsOnConflict(ctx: Ctx, err: unknown): boolean {
  if (!(err instanceof ApiError && err.isConflict && err.current)) return false
  ctx.takeTheirs(err.current as ArticleDto)
  // One toast however many requests hit the same stale version.
  toast.error("Not done", {
    id: "article-conflict",
    description: CONFLICT_MESSAGE,
  })
  return true
}

/** Card buttons: 40 px, 44 px on touch (WCAG 2.5.8 with margin). */
const CARD_ACTION = "h-10 rounded-xl px-4 font-semibold pointer-coarse:h-11"

/** Categories, bylines and the blog's featured slugs (shared query). */
export function useArticleOptions() {
  return useQuery({
    queryKey: ["articles", "options"],
    queryFn: () =>
      unwrap(api.articles.options.$get()) as Promise<ArticleOptions>,
  })
}

/**
 * Side panel of the article editor: why it is locked (if it is), address,
 * category and byline (columns, live at once), details, delete.
 */
export function ArticleSettings({
  ctx,
  onDeleted,
}: {
  ctx: Ctx
  onDeleted?: () => void
}) {
  const article = ctx.record
  const options = useArticleOptions()
  const featured = options.data?.featured?.includes(article.slug) ?? false
  const locked = lockedReason(article)
  return (
    <>
      {locked ? <Note>{locked}</Note> : null}
      {featured ? (
        <Note id={FEATURED_NOTE_ID}>
          The blog page features this article. To unpublish, delete or move it,
          choose another featured article on the Blog page first.
        </Note>
      ) : null}
      <PlacementCard
        // Remount after a saved change so the inputs start from the new values.
        key={`${article.slug}|${article.category.id}|${article.author?.id ?? ""}`}
        ctx={ctx}
        options={options.data}
        featured={featured}
      />
      <DetailsCard article={article} />
      {article.permissions.delete ? (
        <DeleteCard ctx={ctx} featured={featured} onDeleted={onDeleted} />
      ) : null}
    </>
  )
}

/** Why the user may not change this article (mirrors the API's rules). */
function lockedReason(article: ArticleDto): string | null {
  if (article.permissions.update) return null
  if (article.live)
    return "It is on the site: only an editor can change it now."
  if (article.status === "scheduled")
    return "It is scheduled: only an editor can change it now."
  return "Only its author or an editor can change it."
}

function Note({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="flex items-start gap-2 rounded-2xl border bg-muted/40 p-4 text-sm leading-relaxed"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  )
}

function PlacementCard({
  ctx,
  options,
  featured,
}: {
  ctx: Ctx
  options: ArticleOptions | undefined
  featured: boolean
}) {
  const article = ctx.record
  const editable = article.permissions.update
  const canChangeAuthor = editable && article.permissions.changeAuthor
  const [slug, setSlug] = useState(article.slug)
  const [categoryId, setCategoryId] = useState(article.category.id)
  const [authorId, setAuthorId] = useState(article.author?.id ?? "")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const categories = options?.categories ?? [article.category]
  const authors = options?.authors ?? []
  const bylines =
    article.author && !authors.some((a) => a.id === article.author?.id)
      ? [article.author, ...authors]
      : authors
  const changes = {
    ...(slug !== article.slug ? { slug } : {}),
    ...(categoryId !== article.category.id ? { categoryId } : {}),
    ...(canChangeAuthor && authorId !== (article.author?.id ?? "")
      ? { authorId: authorId || null }
      : {}),
  }
  const slugValid = SLUG_PATTERN.test(slug)
  const save = useMutation({
    mutationFn: async () => {
      // Pending text first (the meta call needs the version it returns).
      if (!(await ctx.flush()))
        throw new Error(
          "The text has unsaved changes that could not be saved. Fix or save them first."
        )
      return (await unwrap(
        api.articles[":id"].meta.$patch({
          param: { id: article.id },
          json: { version: ctx.version(), ...changes },
        })
      )) as ArticleDto
    },
    onSuccess: (dto) => {
      ctx.accept(dto)
      toast.success("Settings saved", {
        description: dto.live ? "The site uses them now." : undefined,
      })
    },
    onError: (err) => {
      if (takeTheirsOnConflict(ctx, err)) return
      if (err instanceof ApiError) setErrors(err.fieldErrors)
      toast.error("Not saved", {
        description:
          err instanceof ApiError || !(err instanceof Error)
            ? errorMessage(err)
            : err.message,
      })
    },
  })
  const slugError =
    errors.slug?.[0] ??
    (slugValid ? undefined : "Lowercase letters, numbers and single hyphens.")
  const slugHelp = featured
    ? "Featured on the blog page: the address stays."
    : article.live
      ? "Changing it moves the live page immediately."
      : "Where the article will be published."
  return (
    <FormCard
      id="article-placement"
      title="Address and category"
      headingLevel={2}
      className="gap-4 sm:p-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="article-slug" className={LABEL_CLASS}>
          Address
        </label>
        <HelpText id="article-slug-help">{slugHelp}</HelpText>
        <div className="relative min-w-0">
          {/* Muted text on the dark input tint falls under 4.5:1 (axe): lifted. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground dark:text-foreground/80"
          >
            /blog/
          </span>
          <Input
            id="article-slug"
            value={slug}
            className={cn(ADMIN_CONTROL, "pl-[3.25rem]")}
            disabled={!editable || featured}
            aria-invalid={slugError ? true : undefined}
            aria-describedby={
              slugError
                ? "article-slug-help article-slug-error"
                : "article-slug-help"
            }
            onChange={(event) => {
              setSlug(event.target.value)
              setErrors({})
            }}
          />
        </div>
        {slugError ? (
          <ErrorText id="article-slug-error">{slugError}</ErrorText>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="article-category" className={LABEL_CLASS}>
          Category
        </label>
        <NativeSelect
          id="article-category"
          value={categoryId}
          disabled={!editable}
          invalid={!!errors.categoryId}
          describedBy={errors.categoryId ? "article-category-error" : undefined}
          onChange={(value) => {
            setCategoryId(value)
            setErrors({})
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        {errors.categoryId ? (
          <ErrorText id="article-category-error">
            {errors.categoryId[0]}
          </ErrorText>
        ) : null}
      </div>
      {canChangeAuthor ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="article-author" className={LABEL_CLASS}>
            Byline
          </label>
          <NativeSelect
            id="article-author"
            value={authorId}
            invalid={!!errors.authorId}
            describedBy={errors.authorId ? "article-author-error" : undefined}
            onChange={(value) => {
              setAuthorId(value)
              setErrors({})
            }}
          >
            <option value="">No byline</option>
            {bylines.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
          {errors.authorId ? (
            <ErrorText id="article-author-error">
              {errors.authorId[0]}
            </ErrorText>
          ) : null}
        </div>
      ) : (
        <p className="text-sm">
          <span className="text-muted-foreground">Byline: </span>
          {article.author?.name ?? "None"}
        </p>
      )}
      {editable ? (
        <Button
          type="button"
          variant="outline"
          className={cn(CARD_ACTION, "self-start")}
          disabled={
            Object.keys(changes).length === 0 || !slugValid || save.isPending
          }
          onClick={() => save.mutate()}
        >
          Save settings
        </Button>
      ) : null}
    </FormCard>
  )
}

/** A date in Irish time, machine-readable too. */
function When({ at }: { at: string }) {
  return <time dateTime={at}>{formatDateTime(at)}</time>
}

function DetailsCard({ article }: { article: ArticleDto }) {
  const rows: [string, ReactNode][] = [
    [
      "On the site",
      article.live && article.publishedAt ? (
        <>
          Since <When at={article.publishedAt} />
        </>
      ) : (
        "Not published"
      ),
    ],
    ...(article.scheduledAt
      ? ([["Scheduled for", <When key="s" at={article.scheduledAt} />]] as [
          string,
          ReactNode,
        ][])
      : []),
    ...(article.live && article.readTimeMinutes !== null
      ? ([["Read time", `${article.readTimeMinutes} min`]] as [
          string,
          ReactNode,
        ][])
      : []),
    ["Created", <When key="c" at={article.createdAt} />],
    [
      "Last change",
      <>
        <When at={article.updatedAt} />
        {article.updatedBy ? ` · ${article.updatedBy.name}` : ""}
      </>,
    ],
  ]
  return (
    <FormCard
      id="article-details"
      title="Details"
      headingLevel={2}
      className="gap-4 sm:p-5"
    >
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </FormCard>
  )
}

function DeleteCard({
  ctx,
  featured,
  onDeleted,
}: {
  ctx: Ctx
  featured: boolean
  onDeleted?: () => void
}) {
  const article = ctx.record
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        api.articles[":id"].$delete({
          param: { id: article.id },
          query: { version: String(ctx.version()) },
        })
      ),
    onSuccess: async () => {
      toast.success(`${article.title} deleted`)
      onDeleted?.()
      // Drop the deleted record first so nothing refetches it (404).
      queryClient.removeQueries({ queryKey: ["articles", article.id] })
      await queryClient.invalidateQueries({ queryKey: ["articles"] })
      router.push("/admin/articles")
    },
    onError: (err) => {
      setOpen(false)
      if (takeTheirsOnConflict(ctx, err)) return
      toast.error("Not deleted", { description: errorMessage(err) })
    },
  })
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-2 shadow-xs">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          CARD_ACTION,
          "justify-start gap-2 text-destructive hover:text-destructive"
        )}
        disabled={featured}
        aria-describedby={featured ? FEATURED_NOTE_ID : undefined}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete article
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {article.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              {article.live
                ? `It disappears from /blog and /blog/${article.slug} shows “not found”. `
                : ""}
              Its history is kept in the audit log only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete article
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
