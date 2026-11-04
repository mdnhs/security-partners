"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"

import { LEGAL_PAGES_KEY } from "@/components/admin/legal/legal-page-editor"
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
import { LEGAL_SLUG_MAX } from "@/lib/legal-slug"
import { legalSlug } from "@/lib/schemas/api/legal-pages"
import { cn } from "@/lib/utils"

/** "Cookie Policy" → "cookie-policy", at most 60 characters. */
export function legalSlugFrom(title: string): string {
  return slugify(title).slice(0, LEGAL_SLUG_MAX).replace(/-+$/, "")
}

/** Why `slug` cannot be an address, or null (lib/schemas/api/legal-pages). */
export function legalSlugProblem(slug: string): string | null {
  if (!slug) return "Enter an address"
  const result = legalSlug.safeParse(slug)
  return result.success ? null : result.error.issues[0].message
}

type Errors = { title?: string; slug?: string }

/** Creates a legal page (draft) at /<slug>, last in the footer, and opens it. */
export function NewLegalPageDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange(o: boolean): void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remounted per open: a fresh form every time. */}
        {open ? <NewForm onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function NewForm({ onCancel }: { onCancel(): void }) {
  const id = useId()
  const titleId = `${id}-title`
  const slugId = `${id}-slug`
  const router = useRouter()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [shown, setShown] = useState(false)
  const [serverErrors, setServerErrors] = useState<Errors>({})
  const effectiveSlug = slugTouched ? slug : legalSlugFrom(title)
  const local: Errors = {
    title: title.trim() ? undefined : "Enter a title",
    slug: legalSlugProblem(effectiveSlug) ?? undefined,
  }
  const errors: Errors = {
    title: serverErrors.title ?? (shown ? local.title : undefined),
    // The address is checked as typed once there is one.
    slug:
      serverErrors.slug ??
      (shown || (slugTouched && effectiveSlug) ? local.slug : undefined),
  }
  const help = `The page's address: /${effectiveSlug || "…"}`

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api["legal-pages"].$post({
          json: { title: title.trim(), slug: effectiveSlug },
        })
      ),
    onSuccess: (page) => {
      void queryClient.invalidateQueries({ queryKey: LEGAL_PAGES_KEY })
      toast.success("Legal page created", {
        description: "It stays a draft until you publish it.",
      })
      router.push(`/admin/pages/legal/${page.id}`)
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
        <DialogTitle>New legal page</DialogTitle>
        <DialogDescription>
          A draft page, such as a Cookie Policy. Nobody sees it, and it is not
          linked from the footer, until you publish it.
        </DialogDescription>
      </DialogHeader>
      <FieldShell id={titleId} label="Title" error={errors.title}>
        <Input
          id={titleId}
          className={cn(ADMIN_CONTROL, "pointer-coarse:h-11")}
          value={title}
          maxLength={80}
          autoComplete="off"
          disabled={create.isPending}
          aria-required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy(titleId, { error: errors.title })}
          onChange={(event) => {
            setServerErrors({})
            setTitle(event.target.value)
          }}
        />
      </FieldShell>
      <FieldShell id={slugId} label="Address" help={help} error={errors.slug}>
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="font-mono text-sm text-muted-foreground">
            /
          </span>
          <Input
            id={slugId}
            className={cn(ADMIN_CONTROL, "font-mono pointer-coarse:h-11")}
            value={effectiveSlug}
            maxLength={LEGAL_SLUG_MAX}
            autoComplete="off"
            spellCheck={false}
            disabled={create.isPending}
            aria-required
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={describedBy(slugId, { help, error: errors.slug })}
            onChange={(event) => {
              setServerErrors({})
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
          />
        </div>
      </FieldShell>
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
          Create page
        </Button>
      </DialogFooter>
    </form>
  )
}
