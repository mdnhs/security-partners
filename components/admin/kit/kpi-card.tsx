import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

import type { Delta } from "./format"
import { NOISE } from "./noise"

/** Hero KPI (navy gradient, white chip) and default KPI (outlined chip). */
export function KpiCard({
  label,
  value,
  caption,
  delta,
  href,
  variant = "default",
  headingLevel = 3,
}: {
  label: string
  value: string
  caption: string
  delta?: Delta | null
  href?: string
  variant?: "hero" | "default"
  /** 3 under a page h1 + section h2 (default); 2 when the row sits directly under the h1. */
  headingLevel?: 2 | 3
}) {
  const hero = variant === "hero"
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return (
    <article
      data-variant={variant}
      className={cn(
        "rounded-card relative isolate flex min-h-[164px] flex-col justify-between gap-6 overflow-hidden p-5 sm:p-6",
        hero ? "bg-hero" : "bg-card text-card-foreground"
      )}
    >
      {hero ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14] mix-blend-overlay"
          style={{ backgroundImage: NOISE }}
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <Heading className="text-[15px] leading-snug font-semibold">
          {label}
        </Heading>
        {href ? (
          <Link
            href={href}
            aria-label={`Open ${label}`}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3",
              hero
                ? "bg-hero-chip text-hero-chip-foreground hover:bg-hero-chip/85 focus-visible:ring-white/60"
                : "ring-1 ring-foreground/70 hover:bg-muted focus-visible:ring-ring/50"
            )}
          >
            <ArrowUpRight aria-hidden className="size-5" />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-kpi tabular-nums">{value}</p>
        <p
          className={cn(
            "text-xs font-medium",
            hero ? "text-white/85" : "text-muted-foreground"
          )}
        >
          {delta ? (
            <span
              className={cn(
                "font-semibold",
                hero && delta.direction === "up" && "text-hero-delta",
                !hero && delta.direction === "up" && "text-success",
                !hero && delta.direction === "down" && "text-danger"
              )}
            >
              {delta.label}
            </span>
          ) : null}
          {delta ? " " : null}
          {caption}
        </p>
      </div>
    </article>
  )
}
