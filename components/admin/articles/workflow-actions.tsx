"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, CalendarX, EyeOff, Inbox } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EDITOR_ACTION } from "@/components/admin/editor/editor-layout"
import type { EditorActionContext } from "@/components/admin/editor/versioned-editor"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { ArticleDto } from "@/lib/schemas/api/articles"
import { cn } from "@/lib/utils"

import {
  FEATURED_NOTE_ID,
  takeTheirsOnConflict,
  useArticleOptions,
} from "./article-settings"
import { ScheduleDialog } from "./schedule-dialog"

/** The draft has errors (now marked in the form). */
class InvalidDraft extends Error {
  constructor() {
    super("Fix the marked fields first.")
  }
}

type Step =
  | { kind: "submit" }
  | { kind: "schedule"; at: string }
  | { kind: "unschedule" }
  | { kind: "unpublish" }

const DONE: Record<Step["kind"], { title: string; description: string }> = {
  submit: {
    title: "Submitted for review",
    description: "An editor will publish it or get back to you.",
  },
  schedule: {
    title: "Scheduled",
    description: "It goes live on its own at the chosen time.",
  },
  unschedule: {
    title: "Schedule cancelled",
    description: "Nothing changes on the site until someone publishes.",
  },
  unpublish: {
    title: "Unpublished",
    description: "The article is no longer on the site.",
  },
}

/**
 * Review/publish workflow buttons in the editor header (spec §5.1, §6.1).
 * Mirrors the API: authors submit their own drafts (never publish or
 * schedule); publishers schedule, cancel a schedule and unpublish — except
 * the blog's featured article, which stays live (the side panel says why).
 */
export function WorkflowActions({
  ctx,
}: {
  ctx: EditorActionContext<ArticleDto>
}) {
  const { record } = ctx
  const { permissions } = record
  const queryClient = useQueryClient()
  const options = useArticleOptions()
  const featured = options.data?.featured?.includes(record.slug) ?? false
  const [scheduling, setScheduling] = useState(false)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  // The server's 422 on the schedule time, shown in the dialog.
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const run = useMutation({
    mutationFn: async (step: Step): Promise<ArticleDto> => {
      const needsValidDraft = step.kind === "submit" || step.kind === "schedule"
      if (needsValidDraft && ctx.showAllErrors()) throw new InvalidDraft()
      // Save pending edits so the request carries the latest version.
      const saved = !ctx.canEdit || (await ctx.flush())
      if (needsValidDraft && !saved) throw new Error("Save your changes first.")
      const param = { id: record.id }
      const version = ctx.version()
      switch (step.kind) {
        case "submit":
          return (await unwrap(
            api.articles[":id"].submit.$post({ param, json: { version } })
          )) as ArticleDto
        case "schedule":
          return (await unwrap(
            api.articles[":id"].schedule.$post({
              param,
              json: { version, scheduledAt: step.at },
            })
          )) as ArticleDto
        case "unschedule":
          return (await unwrap(
            api.articles[":id"].unschedule.$post({ param, json: { version } })
          )) as ArticleDto
        case "unpublish":
          return (await unwrap(
            api.articles[":id"].unpublish.$post({ param, json: { version } })
          )) as ArticleDto
      }
    },
    onSuccess: (dto, step) => {
      ctx.accept(dto)
      setScheduling(false)
      setScheduleError(null)
      setConfirmUnpublish(false)
      void queryClient.invalidateQueries({
        queryKey: ["revisions", "article", record.id],
      })
      // Lists refresh when shown again; the open editor keeps its state.
      void queryClient.invalidateQueries({
        queryKey: ["articles"],
        refetchType: "inactive",
      })
      toast.success(DONE[step.kind].title, {
        description: DONE[step.kind].description,
      })
    },
    onError: (err, step) => {
      setConfirmUnpublish(false)
      // The marked fields must not stay hidden under the dialog.
      if (err instanceof InvalidDraft) {
        setScheduling(false)
        return
      }
      if (takeTheirsOnConflict(ctx, err)) {
        setScheduling(false)
        return
      }
      const timeError =
        err instanceof ApiError ? err.fieldErrors.scheduledAt?.[0] : undefined
      if (step.kind === "schedule" && timeError) {
        setScheduleError(timeError)
        return
      }
      toast.error("Not done", {
        description:
          err instanceof ApiError ? errorMessage(err) : (err as Error).message,
      })
    },
  })

  return (
    <>
      {permissions.submit && !permissions.publish ? (
        <Button
          type="button"
          className={EDITOR_ACTION}
          disabled={run.isPending}
          onClick={() => run.mutate({ kind: "submit" })}
        >
          <Inbox aria-hidden />
          Submit for review
        </Button>
      ) : null}
      {permissions.publish && record.status === "scheduled" ? (
        <Button
          type="button"
          variant="outline"
          className={EDITOR_ACTION}
          disabled={run.isPending}
          onClick={() => run.mutate({ kind: "unschedule" })}
        >
          <CalendarX aria-hidden />
          Cancel schedule
        </Button>
      ) : null}
      {permissions.publish ? (
        <Button
          type="button"
          variant="outline"
          className={EDITOR_ACTION}
          disabled={run.isPending}
          onClick={() => {
            // Invalid draft: the fields are marked, the dialog stays shut.
            if (ctx.showAllErrors()) return
            setScheduleError(null)
            setScheduling(true)
          }}
        >
          <CalendarClock aria-hidden />
          {record.status === "scheduled" ? "Reschedule" : "Schedule"}
        </Button>
      ) : null}
      {permissions.publish && record.live ? (
        <Button
          type="button"
          variant="outline"
          className={cn(
            EDITOR_ACTION,
            "text-destructive hover:text-destructive"
          )}
          disabled={run.isPending || featured}
          aria-describedby={featured ? FEATURED_NOTE_ID : undefined}
          onClick={() => setConfirmUnpublish(true)}
        >
          <EyeOff aria-hidden />
          Unpublish
        </Button>
      ) : null}
      <ScheduleDialog
        open={scheduling}
        onOpenChange={setScheduling}
        initial={record.scheduledAt}
        pending={run.isPending}
        serverError={scheduleError}
        onEdit={() => setScheduleError(null)}
        onConfirm={(at) => run.mutate({ kind: "schedule", at })}
      />
      <AlertDialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish {record.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from /blog and its page shows “not found”. The text
              stays here as a draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it live</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={run.isPending}
              onClick={() => run.mutate({ kind: "unpublish" })}
            >
              Unpublish
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
