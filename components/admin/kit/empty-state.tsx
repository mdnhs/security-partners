import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/** Says what will appear here and, when there is one, offers the next step. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  role,
}: {
  title: string
  description: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  /** "alert" for a failed load, "status" for a quiet result (e.g. no search hits). */
  role?: "alert" | "status"
}) {
  return (
    <Empty role={role} className="rounded-card border border-dashed bg-card/40">
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia variant="icon">
            <Icon aria-hidden />
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="text-base font-semibold">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
