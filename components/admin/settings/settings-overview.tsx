"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { statusLabel } from "@/components/admin/editor/editor-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SETTINGS_GROUPS } from "@/lib/admin/settings-keys"
import { api, errorMessage, unwrap } from "@/lib/api-client"

/** Settings cards grouped as in spec §8.1 (Integrations arrive in Phase 7). */
export function SettingsOverview() {
  const list = useQuery({
    queryKey: ["settings"],
    queryFn: () => unwrap(api.settings.$get()),
  })
  if (list.isPending)
    return (
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy="true"
        aria-label="Loading settings"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  if (list.isError)
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border p-6"
      >
        <p className="text-sm">{errorMessage(list.error)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => list.refetch()}
        >
          Try again
        </Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-8">
      {SETTINGS_GROUPS.map((group) => {
        const items = list.data.items.filter((item) => item.group === group)
        if (items.length === 0) return null
        return (
          <section
            key={group}
            aria-labelledby={`settings-${group}`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`settings-${group}`}
              className="text-sm font-bold tracking-wide text-muted-foreground uppercase"
            >
              {group}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const status = statusLabel({
                  published: item.status === "published" ? true : null,
                  dirty: item.dirty,
                })
                return (
                  <li key={item.key}>
                    <Link
                      href={`/admin/settings/${item.key}`}
                      className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{item.label}</span>
                        <ChevronRight
                          aria-hidden
                          className="size-4 text-muted-foreground"
                        />
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.description}
                      </span>
                      <span className="mt-auto flex gap-2 pt-1">
                        <Badge variant={status.variant}>{status.text}</Badge>
                        {!item.canEdit ? (
                          <Badge variant="outline">Read only</Badge>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
