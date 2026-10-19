"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

  return (
    <section
      aria-labelledby={`contrast-${scope}`}
      className="flex flex-col gap-3 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`contrast-${scope}`} className="text-base font-semibold">
          Contrast
        </h2>
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
            }}
          >
            Fix all
          </Button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Pair</th>
            <th scope="col">Ratio</th>
            <th scope="col">Rating</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const failed = row.rating === "fail"
            const key = rowKey(row)
            return (
              <tr key={key} className="align-top">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  {MODE[row.scope]}
                  {tokenLabel(row.scope, row.text)} on{" "}
                  {tokenLabel(row.scope, row.surface)}
                  {failed ? (
                    <div className="text-danger mt-1 flex flex-wrap items-center gap-2">
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
                          }}
                        >
                          Fix automatically
                        </Button>
                      )}
                    </div>
                  ) : null}
                </th>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                  {formatRatio(row.ratio)}
                </td>
                <td className="py-2 text-right">
                  <Badge
                    variant={failed ? "destructive" : "secondary"}
                    className={cn(!failed && "bg-success-soft text-success")}
                  >
                    {BADGE[row.rating]}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
