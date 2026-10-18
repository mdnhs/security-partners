"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { Gauge } from "@/components/admin/kit/gauge"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { healthParts } from "@/components/admin/seo/health"
import { SEO_OVERVIEW_KEY } from "@/components/admin/seo/keys"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"

/** JW dashboard gauge (closes 04b deviation D7): share of passing SEO checks. */
export function ContentHealthCard() {
  const canRead = usePermission({ seo: ["read"] })
  const query = useQuery({
    queryKey: SEO_OVERVIEW_KEY,
    queryFn: () => unwrap(api.seo.overview.$get()),
    enabled: canRead,
    staleTime: 60_000,
  })
  if (!canRead) return null
  return (
    <DashboardCard
      title="Content health"
      action={
        <Link
          href="/admin/seo"
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Open SEO
        </Link>
      }
    >
      {query.isPending ? (
        <CardSkeleton />
      ) : query.isError ? (
        <EmptyState
          role="alert"
          title="Content health didn't load"
          description={errorMessage(query.error)}
        />
      ) : (
        <Gauge
          title="Content health"
          centerLabel="SEO checks passing"
          headlineKey="passed"
          parts={healthParts(query.data.checks)}
        />
      )}
    </DashboardCard>
  )
}
