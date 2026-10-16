import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { EmptyState } from "./empty-state"
import { initials, relativeTime } from "./format"
import { StatusPill, type StatusTone } from "./status-pill"

export type ActivityEntry = {
  id: string
  name: string
  description: string
  at: string
  status?: { label: string; tone: StatusTone }
}

/** Team activity: avatar, who, what · when, and a status pill. */
export function ActivityFeed({
  entries,
  now,
  emptyTitle,
  emptyDescription,
  label = "Recent activity",
}: {
  entries: readonly ActivityEntry[]
  now: number
  emptyTitle: string
  emptyDescription: string
  /** Names the scrollable region (focusable so it scrolls by keyboard). */
  label?: string
}) {
  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="max-h-130 overflow-y-auto rounded-xl pr-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-h-90"
    >
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 py-2">
            <Avatar aria-hidden className="size-10">
              <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
                {initials(entry.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">
                {entry.name}
              </span>
              <span className="text-sm text-muted-foreground">
                {entry.description} ·{" "}
                <time dateTime={entry.at}>{relativeTime(entry.at, now)}</time>
              </span>
            </div>
            {entry.status ? (
              <StatusPill tone={entry.status.tone}>
                {entry.status.label}
              </StatusPill>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
