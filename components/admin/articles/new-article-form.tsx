"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { issuesToFieldErrors } from "@/components/admin/editor/versioned-editor"
import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { PageHeader } from "@/components/admin/page-header"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { NativeSelect } from "@/components/admin/schema-form/widgets/basic"
import {
  describedBy,
  FieldShell,
} from "@/components/admin/schema-form/widgets/field-shell"
import { useAdminSession } from "@/components/admin/session-provider"
import { slugify } from "@/components/admin/services/new-service-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { articleContent } from "@/lib/schemas/content/article"

import { articleEditorMeta } from "./article-meta"

/** What a new article needs before its editor opens (the rest is written there). */
const basics = articleContent.pick({ title: true, excerpt: true, cover: true })

const SLUG_HELP =
  "Lowercase letters, numbers and single hyphens. Follows the title until you change it."
const BYLINE_HELP = "Who signs the article on the site."

/** New article: address, category, byline and the card fields → draft → editor. */
export function NewArticleForm() {
  const router = useRouter()
  const { user } = useAdminSession()
  const options = useQuery({
    queryKey: ["articles", "options"],
    queryFn: () => unwrap(api.articles.options.$get()),
  })
  const [draft, setDraft] = useState<unknown>(() => emptyValue(basics))
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [categoryId, setCategoryId] = useState("")
  const [authorId, setAuthorId] = useState(user.id)
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>()
  const title = (draft as { title?: string }).title ?? ""
  const effectiveSlug = slugTouched ? slug : slugify(title)
  const slugValid = SLUG_PATTERN.test(effectiveSlug)
  // Only users who may pick a byline get candidates (Task 1 options).
  const authors = options.data?.authors ?? []

  const create = useMutation({
    mutationFn: async () => {
      const parsed = basics.safeParse(draft)
      const fieldErrors = parsed.success
        ? {}
        : issuesToFieldErrors(parsed.error)
      if (!categoryId) fieldErrors.categoryId = ["Choose a category"]
      if (!parsed.success || !categoryId) {
        setErrors(fieldErrors)
        throw new Error("Fill in the marked fields first.")
      }
      return unwrap(
        api.articles.$post({
          json: {
            slug: effectiveSlug,
            categoryId,
            ...(authors.length > 0 ? { authorId: authorId || null } : {}),
            draft: { ...parsed.data, lead: null, tags: [], body: null },
          },
        })
      )
    },
    onSuccess: (dto) => {
      toast.success("Draft created", {
        description:
          "Write the article, then submit it for review or publish it.",
      })
      router.push(`/admin/articles/${dto.id}`)
    },
    onError: (err) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors)
      toast.error("Not created", {
        description: err instanceof ApiError ? errorMessage(err) : err.message,
      })
    },
  })

  const slugError =
    errors?.slug?.[0] ??
    (effectiveSlug && !slugValid
      ? "Use lowercase letters, numbers and single hyphens."
      : undefined)
  const categoryError = errors?.categoryId?.[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New article"
        description="Start with the blog card. The draft stays private until it is published."
        actions={
          <Button
            type="button"
            disabled={create.isPending || !slugValid}
            aria-describedby={slugValid ? undefined : "new-article-slug-help"}
            onClick={() => create.mutate()}
          >
            Create draft
          </Button>
        }
      />
      <section
        aria-labelledby="new-article-place"
        className="flex flex-col gap-5 rounded-xl border bg-card p-4 sm:p-6"
      >
        <h2 id="new-article-place" className="text-base font-bold">
          Address and category
        </h2>
        <FieldShell
          id="new-article-slug"
          label="Address"
          help={SLUG_HELP}
          error={slugError}
        >
          <div className="flex max-w-md items-center gap-2">
            <span className="text-sm whitespace-nowrap text-muted-foreground">
              /blog/
            </span>
            <Input
              id="new-article-slug"
              className={ADMIN_CONTROL}
              value={effectiveSlug}
              aria-invalid={slugError ? true : undefined}
              aria-describedby={describedBy("new-article-slug", {
                help: SLUG_HELP,
                error: slugError,
              })}
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value)
              }}
            />
          </div>
        </FieldShell>
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell
            id="new-article-category"
            label="Category"
            error={categoryError}
          >
            <NativeSelect
              id="new-article-category"
              value={categoryId}
              invalid={!!categoryError}
              describedBy={describedBy("new-article-category", {
                error: categoryError,
              })}
              onChange={(value) => {
                setCategoryId(value)
                setErrors((e) => (e ? { ...e, categoryId: [] } : e))
              }}
            >
              <option value="">Choose…</option>
              {(options.data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </FieldShell>
          {authors.length > 0 ? (
            <FieldShell
              id="new-article-author"
              label="Byline"
              help={BYLINE_HELP}
            >
              <NativeSelect
                id="new-article-author"
                value={authorId}
                describedBy={describedBy("new-article-author", {
                  help: BYLINE_HELP,
                })}
                onChange={setAuthorId}
              >
                <option value="">No byline</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </FieldShell>
          ) : null}
        </div>
      </section>
      <SchemaForm
        schema={basics}
        meta={articleEditorMeta}
        value={draft as never}
        onChange={setDraft}
        errors={errors}
      />
    </div>
  )
}
