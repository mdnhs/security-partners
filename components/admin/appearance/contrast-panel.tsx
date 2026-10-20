"use client"

import { Fragment, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  describeIssue,
  fixAll,
  fixIssue,
  pairRatings,
  tokenLabel,
  type PairRating,
} from "@/lib/theme/checks"
import type { ThemeConfigValue } from "@/lib/theme/schema"
import { cn } from "@/lib/utils"

const BADGE = { AAA: "AAA", AA: "AA", fail: "Fails" } as const
const MODE: Record<PairRating["scope"], string> = {
  site: "",
  "admin-light": "Light · ",
  "admin-dark": "Dark · ",
}

// Floored, so a pair that fails never reads as "4.50:1".
const formatRatio = (ratio: number) =>
  `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`

const rowKey = (r: PairRating) => `${r.scope}:${r.text}:${r.surface}`

export function ContrastPanel({
  config,
  scope,
  onFix,
  disabled,
}: {
  config: ThemeConfigValue
  scope: "site" | "admin"
  onFix(next: ThemeConfigValue): void
  disabled?: boolean
}) {
  // "Stuck" marks belong to the config they were found against.
  const [stuckState, setStuck] = useState<{ at: string; keys: string[] }>({
    at: "",
    keys: [],
  })
  const snapshot = JSON.stringify(config)
  const stuck = stuckState.at === snapshot ? stuckState.keys : []
  const rows = pairRatings(config).filter((r) =>
    scope === "site" ? r.scope === "site" : r.scope !== "site"
  )
  const failing = rows.filter((r) => r.rating === "fail").length
  const heading = useRef<HTMLHeadingElement>(null)
  // The button just used unmounts (the row passes) or turns disabled
  // (nothing fails): focus moves to the heading, never to <body>.
  const settle = () => heading.current?.focus()

  return (
    <section
      aria-labelledby={`contrast-${scope}`}
      className="flex flex-col gap-3 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2
            ref={heading}
            id={`contrast-${scope}`}
            tabIndex={-1}
            className="rounded-sm text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Contrast
          </h2>
          {/* Polite and always present: a fix announces the new count. */}
          <p role="status" className="text-sm text-muted-foreground">
            {failing
              ? `${failing} of ${rows.length} pairs fail`
              : "All pairs pass"}
          </p>
        </div>
        {disabled ? null : (
          <Button
            type="button"
            variant="outline"
            className="pointer-coarse:h-11"
            disabled={failing === 0}
            onClick={() => {
              // Repair only this tab's scope; the other keeps its colours.
              const fixed = fixAll(config).config
              onFix(
                scope === "site"
                  ? { ...config, site: fixed.site }
                  : { ...config, admin: fixed.admin }
              )
              settle()
            }}
          >
            Fix all
          </Button>
        )}
      </div>
      <Table>
        <TableHeader className="sr-only">
          <TableRow>
            <TableHead scope="col">Pair</TableHead>
            <TableHead scope="col">Ratio</TableHead>
            <TableHead scope="col">Rating</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const failed = row.rating === "fail"
            const key = rowKey(row)
            return (
              <Fragment key={key}>
                <TableRow
                  className={cn(
                    "align-top hover:bg-transparent",
                    failed && "border-b-0"
                  )}
                >
                  {/* Only the pair: a row header is repeated for every cell. */}
                  <th
                    scope="row"
                    className="py-2 pr-3 text-left font-normal whitespace-normal"
                  >
                    {MODE[row.scope]}
                    {tokenLabel(row.scope, row.text)} on{" "}
                    {tokenLabel(row.scope, row.surface)}
                  </th>
                  <TableCell className="px-0 py-2 pr-3 text-right tabular-nums">
                    {formatRatio(row.ratio)}
                  </TableCell>
                  <TableCell className="px-0 py-2 text-right">
                    <Badge
                      variant={failed ? "destructive" : "secondary"}
                      className={cn(!failed && "bg-success-soft text-success")}
                    >
                      {BADGE[row.rating]}
                    </Badge>
                  </TableCell>
                </TableRow>
                {failed ? (
                  <TableRow data-issue={key} className="hover:bg-transparent">
                    <TableCell
                      colSpan={3}
                      className="px-0 pt-0 pb-2 whitespace-normal"
                    >
                      <div className="text-danger flex flex-wrap items-center gap-2">
                        <p>{describeIssue(row)}</p>
                        {disabled ? null : stuck.includes(key) ? (
                          <span className="text-muted-foreground">
                            Pick a different colour
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="pointer-coarse:h-11"
                            onClick={() => {
                              const next = fixIssue(config, row)
                              if (next) onFix(next)
                              else
                                setStuck({
                                  at: snapshot,
                                  keys: [...stuck, key],
                                })
                              settle()
                            }}
                          >
                            Fix automatically
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
