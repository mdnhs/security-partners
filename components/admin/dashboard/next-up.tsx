import { Circle, CircleCheck } from "lucide-react"
import Link from "next/link"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { LINK_PRIMARY } from "@/components/admin/page-header"
import type { NextUpItem } from "@/lib/schemas/api/dashboard"
import { cn } from "@/lib/utils"

/**
 * JW "Next up": the first open step as a headline, the checklist, one CTA.
 * Checklist rows at MK's 28 px pitch: 24 px links (WCAG 2.2 AA target)
 * 4 px apart, 44 px on coarse pointers. The focus ring is inset so it
 * stays inside its row instead of overlapping the next one.
 */
export function NextUp({
  items,
  headingLevel = 2,
}: {
  items: NextUpItem[]
  /** 3 under a page section's h2 (the /admin/design gallery). */
  headingLevel?: 2 | 3
}) {
  const next = items.find((item) => !item.done)
  return (
    <DashboardCard title="Next up" headingLevel={headingLevel}>
      <div className="flex flex-1 flex-col justify-between gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-2xl leading-tight font-semibold break-words text-primary">
            {next ? next.title : "You're all set"}
          </p>
          <p className="text-sm text-muted-foreground">
            {next
              ? next.description
              : "Every setup step is done. New suggestions appear here as the site grows."}
          </p>
        </div>
        {items.length > 1 ? (
          // Setup steps and day-to-day work (e.g. "Reply to …") alike.
          <ul aria-label="Next steps" className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex min-h-6 items-center gap-2 rounded-md text-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset pointer-coarse:min-h-11"
                >
                  {item.done ? (
                    <CircleCheck aria-hidden className="text-success size-4" />
                  ) : (
                    <Circle
                      aria-hidden
                      className="size-4 text-muted-foreground"
                    />
                  )}
                  <span className={cn(item.done && "text-muted-foreground")}>
                    {item.title}
                  </span>
                  <span className="sr-only">
                    {item.done ? " (done)" : " (to do)"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {next ? (
          <Link href={next.href} className={LINK_PRIMARY}>
            {next.id === "reply" ? "Open enquiry" : "Get started"}
          </Link>
        ) : null}
      </div>
    </DashboardCard>
  )
}
