"use client"

import Link from "next/link"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { Gauge } from "@/components/admin/kit/gauge"
import type { GaugePart } from "@/components/admin/kit/gauge-math"
import type { DashboardDto } from "@/lib/schemas/api/dashboard"

type Health = NonNullable<DashboardDto["contentHealth"]>

/** Complete (solid), needs work (dark), missing description or alt text (hatched). */
export function contentHealthParts(health: Health): GaugePart[] {
  return [
    {
      key: "complete",
      label: "Complete",
      value: health.complete,
      tone: "solid",
    },
    {
      key: "needsWork",
      label: "Needs work",
      value: health.needsWork,
      tone: "dark",
    },
    {
      key: "missing",
      label: "Missing description or alt text",
      value: health.missing,
      tone: "hatched",
    },
  ]
}

/**
 * JW dashboard gauge (D3.5): published pages, services and articles by
 * their SEO checks, from the dashboard's own data (seo:read; the API sends
 * null otherwise and the card is not drawn).
 */
export function ContentHealthCard({ health }: { health: Health | null }) {
  if (!health) return null
  return (
    <DashboardCard
      title="Content health"
      action={
        <Link
          href="/admin/seo"
          className="inline-flex min-h-6 items-center rounded-sm text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
        >
          Open SEO
        </Link>
      }
    >
      <Gauge
        title="Content health"
        centerLabel="Complete"
        headlineKey="complete"
        parts={contentHealthParts(health)}
      />
    </DashboardCard>
  )
}
