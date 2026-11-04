"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { LINK_PRIMARY } from "@/components/admin/page-header"
import {
  ErrorText,
  HelpText,
  LABEL_CLASS,
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
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { SLUG_PATTERN } from "@/lib/schemas/common"

/** "New job": a title and an address; the editor opens on the starter draft. */
export function NewJobDialog() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const effectiveSlug = slugTouched ? slug : slugify(title)
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.jobs.$post({ json: { title: title.trim(), slug: effectiveSlug } })
      ),
    onSuccess: async (dto) => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] })
      router.push(`/admin/careers/jobs/${dto.id}`)
    },
    onError: (err) =>
      setError(
        err instanceof ApiError && err.fieldErrors.slug
          ? err.fieldErrors.slug[0]
          : errorMessage(err)
      ),
  })
  const slugValid = SLUG_PATTERN.test(effectiveSlug)
  return (
    <>
      <Button
        type="button"
        className={LINK_PRIMARY}
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        New job
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (title.trim() && slugValid) create.mutate()
            }}
          >
            <DialogHeader>
              <DialogTitle>New job</DialogTitle>
              <DialogDescription>
                Starts as a draft with the usual sections filled in. Publish it
                to list it on /careers.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <label htmlFor="new-job-title" className={LABEL_CLASS}>
                Job title
              </label>
              <Input
                id="new-job-title"
                value={title}
                autoFocus
                onChange={(e) => {
                  setTitle(e.target.value)
                  setError(null)
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="new-job-slug" className={LABEL_CLASS}>
                Address
              </label>
              <HelpText id="new-job-slug-help">
                The page will be /careers/{effectiveSlug || "…"}
              </HelpText>
              <Input
                id="new-job-slug"
                value={effectiveSlug}
                aria-invalid={(!!effectiveSlug && !slugValid) || !!error}
                aria-describedby="new-job-slug-help"
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugTouched(true)
                  setError(null)
                }}
              />
              {error ? <ErrorText id="new-job-error">{error}</ErrorText> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!title.trim() || !slugValid || create.isPending}
              >
                Create draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
