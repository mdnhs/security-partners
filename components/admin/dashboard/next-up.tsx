import { CheckCircle2, ChevronRight, Circle } from "lucide-react"
import Link from "next/link"

import type { NextUpItem } from "@/lib/schemas/api/dashboard"
import { cn } from "@/lib/utils"

/** Checklist computed from the platform's state (spec §8.1 "Next up"). */
export function NextUp({ items }: { items: NextUpItem[] }) {
  if (items.length === 0) return null
  const open = items.filter((i) => !i.done).length
  return (
    <section
      aria-labelledby="next-up"
      className="rounded-card flex min-w-0 flex-col gap-3 bg-card p-5 text-card-foreground sm:p-6"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 id="next-up" className="text-card-title">
          Next up
        </h2>
        <span className="text-sm text-muted-foreground">
          {open === 0 ? "All done" : `${open} to do`}
        </span>
      </header>
      <ul className="flex flex-col divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-start gap-3 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {item.done ? (
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-success"
                />
              ) : (
                <Circle
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-sm font-medium",
                    item.done && "text-muted-foreground line-through"
                  )}
                >
                  {item.title}
                  <span className="sr-only">
                    {item.done ? " (done)" : " (to do)"}
                  </span>
                </span>
                {!item.done ? (
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                aria-hidden
                className="mt-0.5 size-4 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
