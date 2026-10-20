import type { GaugePart } from "@/components/admin/kit/gauge-math"

/** Passing vs failing SEO checks for the gauge (headline: "passed"). */
export function healthParts(checks: {
  passed: number
  total: number
}): GaugePart[] {
  return [
    {
      key: "passed",
      label: "Passing checks",
      value: checks.passed,
      tone: "solid",
    },
    {
      key: "failed",
      label: "Needs work",
      value: checks.total - checks.passed,
      tone: "hatched",
    },
  ]
}
