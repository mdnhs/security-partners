"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

const config = {
  count: { label: "Enquiries", color: "var(--chart-2)" },
} satisfies ChartConfig

const dayMonth = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const label = (date: string) => dayMonth.format(new Date(`${date}T12:00:00Z`))

/**
 * Leads per day, last 90 days (spec §8.1). The summary is the accessible
 * name. Interim: Phase 4b Task 11 replaces this with 13 weekly pill bars.
 */
export function LeadsChart({
  data,
}: {
  data: { date: string; count: number }[]
}) {
  const reduced = useReducedMotion()
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const busiest = data.reduce(
    (best, d) => (d.count > best.count ? d : best),
    data[0] ?? { date: "", count: 0 }
  )
  const summary =
    total === 0
      ? "No enquiries in the last 90 days."
      : `${total} enquir${total === 1 ? "y" : "ies"} in the last 90 days. Busiest day: ${label(busiest.date)} with ${busiest.count}.`
  return (
    <figure className="rounded-card flex min-w-0 flex-col gap-4 bg-card p-5 text-card-foreground sm:p-6">
      <figcaption className="flex flex-col gap-1">
        <span className="text-card-title">Enquiries, last 90 days</span>
        <span className="text-sm text-muted-foreground">{summary}</span>
      </figcaption>
      <ChartContainer
        config={config}
        className="aspect-auto h-56 w-full"
        role="img"
        aria-label={summary}
      >
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={label}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => label(String(value))}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={!reduced}
          />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
