"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Bot,
  ChevronRight,
  CircleAlert,
  HardDrive,
  type LucideIcon,
  Mail,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/admin/kit/empty-state"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { IntegrationDto } from "@/lib/schemas/api/integrations"

const ICONS: Record<string, LucideIcon> = {
  smtp: Mail,
  r2: HardDrive,
  turnstile: ShieldCheck,
  ai: Bot,
}

/** The four integrations of spec §5.4, each with its state. */
export function IntegrationsOverview() {
  const list = useQuery({
    queryKey: ["integrations", "list"],
    queryFn: () =>
      unwrap(api.integrations.$get()) as Promise<{ items: IntegrationDto[] }>,
  })
  if (list.isPending)
    return (
      <div role="status" className="grid gap-4 md:grid-cols-2">
        <p className="sr-only">Loading integrations…</p>
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} className="h-40" />
        ))}
      </div>
    )
  if (list.isError)
    return (
      <EmptyState
        role="alert"
        icon={CircleAlert}
        title="Integrations could not be loaded"
        description={errorMessage(list.error)}
        action={
          <Button
            type="button"
            variant="outline"
            className={FORM_ACTION}
            onClick={() => list.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  return (
    <ul className="grid gap-4 md:grid-cols-2" aria-label="Integrations">
      {list.data.items.map((item) => {
        const Icon = ICONS[item.slug] ?? Mail
        return (
          <li key={item.key} className="flex">
            <Link
              href={`/admin/settings/integrations/${item.slug}`}
              className="group flex w-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
            >
              <span className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[15px] leading-snug font-semibold">
                    {item.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </span>
              <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <StatusPill tone={item.configured ? "success" : "neutral"}>
                  {item.configured ? "Connected" : "Not set up"}
                </StatusPill>
                {item.updatedAt ? (
                  <span>
                    Changed{" "}
                    <RelativeTime
                      iso={item.updatedAt}
                      now={list.dataUpdatedAt}
                    />
                    {item.updatedBy ? ` by ${item.updatedBy.name}` : ""}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
