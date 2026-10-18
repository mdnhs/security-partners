"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleAlert } from "lucide-react"

import { FormCard } from "@/components/admin/form/form-ui"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { MediaMigrationStatus } from "@/lib/schemas/api/media"

/** Query key of the panel (the R2 form invalidates it after a save). */
export const MIGRATE_MEDIA_QUERY_KEY = [
  "integrations",
  "r2",
  "migrate-media",
] as const

const STATE_TEXT = {
  idle: null,
  queued: "Queued — starts within a minute.",
  running: "Moving files…",
} as const

const POLL_MS = 5_000

const migrate = () => api.integrations["integrations.r2"]["migrate-media"]

/** R2 page: move files still on the server disk into the bucket (master 6.4). */
export function MigrateMediaPanel() {
  const queryClient = useQueryClient()
  const canStart = usePermission({ integration: ["update"] })
  const status = useQuery({
    queryKey: MIGRATE_MEDIA_QUERY_KEY,
    queryFn: () => unwrap(migrate().$get()) as Promise<MediaMigrationStatus>,
    // Poll while a move is queued or running.
    refetchInterval: (query) =>
      query.state.data && query.state.data.state !== "idle" ? POLL_MS : false,
  })
  const start = useMutation({
    mutationFn: () =>
      unwrap(migrate().$post()) as Promise<MediaMigrationStatus>,
    onSuccess: (next) =>
      queryClient.setQueryData(MIGRATE_MEDIA_QUERY_KEY, next),
  })
  const data = status.data
  const stateText = data ? STATE_TEXT[data.state] : null

  return (
    <FormCard
      id="migrate-media"
      title="Move existing uploads to R2"
      description="Changing storage does not move old files. Moving keeps every link working; built-in site images stay where they are."
      className="max-w-3xl"
    >
      {status.isError ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {errorMessage(status.error)}
        </p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {data.onDisk} file{data.onDisk === 1 ? "" : "s"} on the server disk
            · {data.inR2} in R2
          </p>
          {!data.r2Configured ? (
            <p className="text-sm text-muted-foreground">
              Save the R2 settings above first.
            </p>
          ) : null}
          {stateText ? (
            <p role="status" className="text-sm">
              {stateText}
            </p>
          ) : null}
          {data.lastError ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {data.lastError}
            </p>
          ) : null}
          {data.lastRunAt ? (
            <p className="text-xs text-muted-foreground">
              Last run {formatDateTime(data.lastRunAt)}
            </p>
          ) : null}
          {canStart ? (
            <Button
              type="button"
              className={`${FORM_ACTION} self-start`}
              disabled={
                !data.r2Configured ||
                data.onDisk === 0 ||
                data.state !== "idle" ||
                start.isPending
              }
              onClick={() => start.mutate()}
            >
              Move uploads to R2
            </Button>
          ) : null}
          {start.isError ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {errorMessage(start.error)}
            </p>
          ) : null}
        </div>
      )}
    </FormCard>
  )
}
