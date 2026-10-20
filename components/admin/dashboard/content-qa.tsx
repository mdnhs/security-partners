"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import type { QaFinding, QaRuleId } from "@/lib/content/qa"

const RULE_LABELS: Record<QaRuleId, string> = {
  "placeholder-contact": "Placeholder contact",
  "placeholder-copy": "Placeholder text",
  "legal-unpublished": "Legal page",
}

/**
 * Content QA (D3.5): placeholder copy and unfinished legal pages, each
 * linking to its editor. Drawn only when there is something to fix; the
 * API sends null to roles that can read neither settings nor pages.
 * Every value is rendered as text (React escapes it).
 */
export function ContentQaCard({
  findings,
}: {
  findings: readonly QaFinding[] | null
}) {
  if (!findings?.length) return null
  const count = findings.length
  return (
    <DashboardCard
      title="Content QA"
      action={<p className="text-sm text-muted-foreground">{count} to fix</p>}
    >
      <ul aria-label="Content QA findings" className="flex flex-col gap-1">
        {findings.map((finding) => (
          <li key={`${finding.rule}:${finding.href}`}>
            <Link
              href={finding.href}
              className="group -mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold break-words">
                    {finding.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {RULE_LABELS[finding.rule]}
                  </span>
                </span>
                <span className="break-words text-muted-foreground">
                  {finding.message}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  )
}
