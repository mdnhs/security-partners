"use client"

import { StatusPill } from "@/components/admin/kit/status-pill"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { describeActivity } from "@/lib/admin/activity"
import { describeUserAgent, formatDateTime } from "@/lib/format"

import { ImpersonatorName } from "./impersonator-name"
import type { AuditItem } from "./types"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const actorLabel = (row: AuditItem) =>
  row.actor ? (row.actor.name ?? row.actor.email ?? "Deleted user") : "System"

function Json({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: unknown
  tone?: "neutral" | "after"
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </h3>
      <pre
        aria-label={label}
        tabIndex={0}
        className={
          tone === "after"
            ? "max-h-80 overflow-auto rounded-xl bg-primary/10 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            : "max-h-80 overflow-auto rounded-xl bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        }
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

/** Diff viewer: "from"/"to" side by side when the entry has them, else raw JSON. */
export function AuditDiff({ diff }: { diff: unknown }) {
  if (diff === null || diff === undefined)
    return <p className="text-sm text-muted-foreground">No details recorded.</p>
  if (isRecord(diff) && "from" in diff && "to" in diff) {
    const { from, to, ...rest } = diff
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Json label="Before" value={from} />
          <Json label="After" value={to} tone="after" />
        </div>
        {Object.keys(rest).length ? <Json label="Also" value={rest} /> : null}
      </div>
    )
  }
  return <Json label="Details" value={diff} />
}

/** Drawer with one audit entry: who, when, where from, and what changed. */
export function AuditDetailSheet({
  entry,
  onOpenChange,
}: {
  entry: AuditItem | null
  onOpenChange: (open: boolean) => void
}) {
  const summary = entry ? describeActivity(entry) : null
  return (
    <Sheet open={entry !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 bg-card sm:max-w-2xl">
        {entry && summary ? (
          <>
            <SheetHeader className="border-b pr-12">
              <SheetTitle className="text-lg font-semibold">
                Audit entry
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  {actorLabel(entry)} {summary.text}
                </span>
                {summary.status ? (
                  <StatusPill tone={summary.status.tone} className="h-6">
                    {summary.status.label}
                  </StatusPill>
                ) : null}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
              <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Action</dt>
                <dd>
                  <code className="font-mono text-xs">{entry.action}</code>
                </dd>
                <dt className="text-muted-foreground">When</dt>
                <dd>
                  <time dateTime={entry.createdAt}>
                    {formatDateTime(entry.createdAt)}
                  </time>{" "}
                  (Irish time)
                </dd>
                <dt className="text-muted-foreground">Who</dt>
                <dd>
                  {entry.actor
                    ? `${entry.actor.name ?? "Deleted user"}${entry.actor.email ? ` (${entry.actor.email})` : ""}`
                    : "System"}
                </dd>
                {entry.impersonatorId ? (
                  <>
                    <dt className="text-muted-foreground">Viewed as by</dt>
                    <dd>
                      <ImpersonatorName id={entry.impersonatorId} />
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Record</dt>
                <dd className="break-all">
                  {entry.entityType ?? "—"}
                  {entry.entityId ? (
                    <>
                      {" · "}
                      <code className="font-mono text-xs text-muted-foreground">
                        {entry.entityId}
                      </code>
                    </>
                  ) : null}
                </dd>
                <dt className="text-muted-foreground">IP address</dt>
                <dd>{entry.ip ?? "Unknown"}</dd>
                <dt className="text-muted-foreground">Device</dt>
                <dd>{describeUserAgent(entry.userAgent)}</dd>
              </dl>
              <section aria-label="Changes" className="flex flex-col gap-3">
                <h2 className="text-card-title">Changes</h2>
                <AuditDiff diff={entry.diff} />
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
