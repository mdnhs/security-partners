"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"

import type { BuilderDocument } from "@/blocks/document"
import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { FORM_ACTION } from "@/components/admin/page-header"
import {
  describedBy,
  FieldShell,
} from "@/components/admin/schema-form/widgets/field-shell"
import { slugify } from "@/components/admin/services/new-service-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { BUILDER_SLUG_MAX } from "@/lib/builder-slug"
import { builderSlug } from "@/lib/schemas/api/builder-pages"
import { cn } from "@/lib/utils"

/** Query key of the custom pages list (Pages › Custom pages). */
export const BUILDER_PAGES_KEY = ["builder-pages"] as const

/** "Spring campaign" → "spring-campaign", at most 60 characters. */
export function builderSlugFrom(title: string): string {
  return slugify(title).slice(0, BUILDER_SLUG_MAX).replace(/-+$/, "")
}

/** Why `slug` cannot be an address, or null (lib/schemas/api/builder-pages). */
export function slugProblem(slug: string): string | null {
  if (!slug) return "Enter an address"
  const result = builderSlug.safeParse(slug)
  return result.success ? null : result.error.issues[0].message
}

type Fields = { title: string; slug: string }
type Errors = Partial<Record<keyof Fields, string>>

/**
 * Title and address inputs (new page dialog, builder SEO tab): the address
 * reads /p/<slug>, validated as typed; server errors win.
 */
export function TitleSlugFields({
  value,
  onChange,
  errors,
  disabled,
  slugHelp,
}: {
  value: Fields
  onChange(next: Partial<Fields>): void
  errors: Errors
  disabled?: boolean
  slugHelp?: string
}) {
  const id = useId()
  const titleId = `${id}-title`
  const slugId = `${id}-slug`
  const help = slugHelp ?? `The page's address: /p/${value.slug || "…"}`
  return (
    <>
      <FieldShell id={titleId} label="Title" error={errors.title}>
        <Input
          id={titleId}
          className={cn(ADMIN_CONTROL, "pointer-coarse:h-11")}
          value={value.title}
          maxLength={80}
          autoComplete="off"
          disabled={disabled}
          aria-required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy(titleId, { error: errors.title })}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </FieldShell>
      <FieldShell id={slugId} label="Address" help={help} error={errors.slug}>
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="font-mono text-sm text-muted-foreground">
            /p/
          </span>
          <Input
            id={slugId}
            className={cn(ADMIN_CONTROL, "font-mono pointer-coarse:h-11")}
            value={value.slug}
            maxLength={BUILDER_SLUG_MAX}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            aria-required
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={describedBy(slugId, {
              help,
              error: errors.slug,
            })}
            onChange={(event) => onChange({ slug: event.target.value })}
          />
        </div>
      </FieldShell>
    </>
  )
}

/**
 * Creates a builder page (draft) at /p/<slug> and opens it. With `seed`
 * (Copy to new page) the copy's blocks start the draft; the fixed page it
 * came from is never touched.
 */
export function NewPageDialog({
  open,
  onOpenChange,
  seed,
}: {
  open: boolean
  onOpenChange(o: boolean): void
  seed?: { title: string; doc: BuilderDocument; slug?: string }
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remounted per open: a fresh form every time. */}
        {open ? (
          <NewPageForm seed={seed} onCancel={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function NewPageForm({
  seed,
  onCancel,
}: {
  seed?: { title: string; doc: BuilderDocument; slug?: string }
  onCancel(): void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(seed?.title ?? "")
  const [slug, setSlug] = useState(seed?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(seed?.slug !== undefined)
  const [shown, setShown] = useState(false)
  const [serverErrors, setServerErrors] = useState<Errors>({})
  const effectiveSlug = slugTouched ? slug : builderSlugFrom(title)
  const local: Errors = {
    title: title.trim() ? undefined : "Enter a title",
    slug: slugProblem(effectiveSlug) ?? undefined,
  }
  const errors: Errors = {
    title: serverErrors.title ?? (shown ? local.title : undefined),
    // The address is checked as typed once there is one.
    slug:
      serverErrors.slug ??
      (shown || (slugTouched && effectiveSlug) ? local.slug : undefined),
  }

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api["builder-pages"].$post({
          json: {
            title: title.trim(),
            slug: effectiveSlug,
            ...(seed ? { seed: seed.doc } : {}),
          },
        })
      ),
    onSuccess: (page) => {
      void queryClient.invalidateQueries({ queryKey: BUILDER_PAGES_KEY })
      toast.success("Page created", {
        description: "It stays a draft until you publish it.",
      })
      router.push(`/admin/pages/custom/${page.id}`)
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setServerErrors({
          title: error.fieldErrors.title?.[0],
          slug: error.fieldErrors.slug?.[0],
        })
        if (error.fieldErrors.title || error.fieldErrors.slug) return
      }
      toast.error("The page was not created", {
        description: errorMessage(error),
      })
    },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        setShown(true)
        if (local.title || local.slug) return
        create.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>{seed ? "Copy to a new page" : "New page"}</DialogTitle>
        <DialogDescription>
          {seed
            ? "A new draft page with this page's sections and copy. The original page stays as it is."
            : "A draft page built from blocks. Nobody sees it until you publish it."}
        </DialogDescription>
      </DialogHeader>
      <TitleSlugFields
        value={{ title, slug: effectiveSlug }}
        errors={errors}
        disabled={create.isPending}
        onChange={(next) => {
          setServerErrors({})
          if (next.title !== undefined) setTitle(next.title)
          if (next.slug !== undefined) {
            setSlugTouched(true)
            setSlug(next.slug)
          }
        }}
      />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className={FORM_ACTION}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className={FORM_ACTION}
          disabled={create.isPending}
        >
          {create.isPending ? <Spinner aria-hidden /> : null}
          {seed ? "Create copy" : "Create page"}
        </Button>
      </DialogFooter>
    </form>
  )
}
