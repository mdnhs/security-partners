"use client"

import { useId } from "react"
import {
  Bar,
  BarChart,
  type BarShapeProps,
  Rectangle,
  XAxis,
  YAxis,
} from "recharts"

import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { formatNumber, peakIndex } from "./format"

// At least 1, so an all-zero period keeps a real scale instead of [0, 0].
const maxDomain = (dataMax: number) => Math.max(1, dataMax)

export type PillBarDatum = {
  key: string
  label: string
  current: number
  /** Comparison period (hatched); omit for a single series. */
  previous?: number
}

/**
 * Capsule bars (hatched for a comparison period) with a value tag on the
 * busiest bar. The SVG is hidden from assistive tech; the sr-only table
 * carries the numbers.
 */
export function PillBarChart({
  title,
  data,
  currentLabel,
  previousLabel,
  rowHeader = "Day",
}: {
  title: string
  data: readonly PillBarDatum[]
  currentLabel: string
  previousLabel?: string
  rowHeader?: string
}) {
  const hatchId = `hatch-${useId().replace(/:/g, "")}`
  const reduced = useReducedMotion()
  const compare =
    previousLabel !== undefined && data.some((d) => d.previous !== undefined)
  const currents = data.map((datum) => datum.current)
  const busiest = peakIndex(currents)
  const peak = (currents[busiest] ?? 0) > 0 ? busiest : -1
  const config = {
    current: { label: currentLabel, color: "var(--chart-2)" },
    previous: { label: previousLabel ?? "", color: "var(--hatch)" },
  } satisfies ChartConfig

  return (
    <figure className="flex flex-col gap-4">
      <ChartContainer
        config={config}
        className="aspect-auto h-72 w-full"
        aria-hidden
      >
        <BarChart
          data={[...data]}
          barGap={4}
          barCategoryGap="14%"
          margin={{ top: 44, right: 4, bottom: 0, left: 4 }}
          accessibilityLayer={false}
        >
          <defs>
            <pattern
              id={hatchId}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect
                width="8"
                height="8"
                fill="var(--color-previous)"
                fillOpacity={0.25}
              />
              <rect width="3.5" height="8" fill="var(--color-previous)" />
            </pattern>
          </defs>
          <YAxis hide domain={[0, maxDomain]} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          {compare ? (
            <Bar
              dataKey="previous"
              fill={`url(#${hatchId})`}
              radius={999}
              isAnimationActive={!reduced}
            />
          ) : null}
          <Bar
            dataKey="current"
            fill="var(--color-current)"
            radius={999}
            isAnimationActive={!reduced}
            shape={(props: BarShapeProps) => (
              <PillWithTag {...props} showTag={props.index === peak} />
            )}
          />
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            <th scope="col">{currentLabel}</th>
            {compare ? <th scope="col">{previousLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.key}>
              <th scope="row">{datum.label}</th>
              <td>{datum.current}</td>
              {compare ? <td>{datum.previous ?? 0}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-chart-2" />
          {currentLabel}
        </span>
        {compare ? (
          <span className="flex items-center gap-2">
            <span aria-hidden className="bg-hatch size-3 rounded-full" />
            {previousLabel}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

function PillWithTag({
  showTag,
  ...props
}: BarShapeProps & { showTag: boolean }) {
  const { x, y, width, height, fill } = props
  const value = formatNumber((props.payload as PillBarDatum).current)
  const tagWidth = Math.max(36, value.length * 8 + 18)
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        radius={999}
      />
      {showTag ? (
        <g transform={`translate(${x + width / 2}, ${y - 10})`}>
          <rect
            x={-tagWidth / 2}
            y={-26}
            width={tagWidth}
            height={22}
            rx={8}
            fill="var(--accent)"
            stroke="var(--chart-3)"
          />
          <text
            y={-11}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--accent-foreground)"
          >
            {value}
          </text>
          <circle
            r={4}
            fill="var(--card)"
            stroke="var(--color-current)"
            strokeWidth={2}
          />
        </g>
      ) : null}
    </g>
  )
}
