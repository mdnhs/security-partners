"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { issuesToFieldErrors } from "@/components/admin/editor/versioned-editor"
import { PageHeader } from "@/components/admin/page-header"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { serviceContent } from "@/lib/schemas/content/service"

import { serviceEditorMeta } from "./service-meta"

/** Address from a title: "Event Security" → "event-security". */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** New service: full form, saved as an unpublished draft, then the editor opens. */
export function NewServiceForm() {
  const router = useRouter()
  const [draft, setDraft] = useState<unknown>(() => emptyValue(serviceContent))
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>()
  const title = (draft as { title?: string }).title ?? ""
  const effectiveSlug = slugTouched ? slug : slugify(title)
  const create = useMutation({
    mutationFn: () => {
      const parsed = serviceContent.safeParse(draft)
      if (!parsed.success) {
        setErrors(issuesToFieldErrors(parsed.error))
        throw new Error("Fill in the marked fields first.")
      }
      return unwrap(
        api.services.$post({
          json: { slug: effectiveSlug, draft: parsed.data },
        })
      )
    },
    onSuccess: (dto) => {
      toast.success("Service created", {
        description: "It is a draft until you publish it.",
      })
      router.push(`/admin/services/${dto.id}`)
    },
    onError: (err) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors)
      toast.error("Not created", {
        description: err instanceof ApiError ? errorMessage(err) : err.message,
      })
    },
  })
  const slugValid = SLUG_PATTERN.test(effectiveSlug)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New service"
        description="Fill in the card and page. It stays a draft until you publish it from the editor."
        actions={
          <Button
            type="button"
            disabled={create.isPending || !slugValid}
            onClick={() => create.mutate()}
          >
            Create draft
          </Button>
        }
      />
      <section
        aria-labelledby="new-slug"
        className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:p-6"
      >
        <h2 id="new-slug" className="text-base font-bold">
          Page address
        </h2>
        <label
          htmlFor="new-service-slug"
          className="text-sm text-muted-foreground"
        >
          /services/…
        </label>
        <Input
          id="new-service-slug"
          className="max-w-md"
          value={effectiveSlug}
          aria-invalid={!slugValid || !!errors?.slug}
          onChange={(event) => {
            setSlugTouched(true)
            setSlug(event.target.value)
          }}
        />
        {errors?.slug ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.slug[0]}
          </p>
        ) : null}
      </section>
      <SchemaForm
        schema={serviceContent}
        meta={serviceEditorMeta}
        value={draft as never}
        onChange={setDraft}
        errors={errors}
      />
    </div>
  )
}
