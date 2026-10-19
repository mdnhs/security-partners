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
  /** Comparison period (hatched); null when there is none (one series). */
  previous: number | null
}

const DEFAULT_LEGEND = { current: "Current", previous: "Previous" }

/**
 * Two-series capsule bars: `current` in chart-2, `previous` hatched, a value
 * tag on the busiest current bar. The SVG is hidden from assistive tech: the
 * figure is labelled and an sr-only table carries every number; the legend
 * pairs each swatch (solid vs hatched, not colour alone) with its text.
 */
export function PillBarChart({
  data,
  ariaLabel,
  legend,
  emptyText,
  rowHeader = "Day",
}: {
  data: readonly PillBarDatum[]
  ariaLabel: string
  legend?: { current: string; previous: string }
  /** Overlay shown when every current and previous value is 0. */
  emptyText?: string
  /** The sr table's first column header. */
  rowHeader?: string
}) {
  const hatchId = `hatch-${useId().replace(/:/g, "")}`
  const reduced = useReducedMotion()
  const labels = legend ?? DEFAULT_LEGEND
  const compare = data.some((d) => d.previous !== null)
  const empty = data.every((d) => d.current === 0 && (d.previous ?? 0) === 0)
  const currents = data.map((datum) => datum.current)
  const busiest = peakIndex(currents)
  const peak = (currents[busiest] ?? 0) > 0 ? busiest : -1
  const config = {
    current: { label: labels.current, color: "var(--chart-2)" },
    previous: { label: labels.previous, color: "var(--hatch)" },
  } satisfies ChartConfig

  return (
    <figure aria-label={ariaLabel} className="flex flex-col gap-4">
      <div className="relative">
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
            {/* Tallest bar meets the top margin, which the value tag uses. */}
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
                stroke="var(--color-previous)"
                strokeWidth={1.5}
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
        {empty && emptyText ? (
          // Real text (the figure's status), over the hidden SVG.
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-64 items-center justify-center text-center">
            <p className="text-base font-semibold">{emptyText}</p>
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            <th scope="col">{labels.current}</th>
            {compare ? <th scope="col">{labels.previous}</th> : null}
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.key}>
              <th scope="row">{datum.label}</th>
              <td>{formatNumber(datum.current)}</td>
              {compare ? <td>{formatNumber(datum.previous ?? 0)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {legend ? (
        // Last child of the figure: a figcaption must be first or last.
        <figcaption className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              data-series="current"
              className="size-3 rounded-full bg-chart-2"
            />
            {legend.current}
          </span>
          {compare ? (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                data-series="previous"
                className="bg-hatch size-3 rounded-full border-[1.5px] border-(--hatch)"
              />
              {legend.previous}
            </span>
          ) : null}
        </figcaption>
      ) : null}
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
