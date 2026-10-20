import { CircleCheck, CircleX } from "lucide-react"

import type { CheckResult } from "@/lib/seo/checks"
import { cn } from "@/lib/utils"

/**
 * The checks an editor can see change while typing (MK live checklist). The
 * state is an icon plus words ("Passes" / "Needs work"), never colour only.
 */
export function SeoChecklist({ results }: { results: CheckResult[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Checklist
      </h3>
      <ul aria-label="SEO checklist" className="flex flex-col gap-2">
        {results.map((result) => {
          const Icon = result.ok ? CircleCheck : CircleX
          return (
            <li
              key={result.id}
              data-ok={result.ok}
              className="flex items-start gap-2 text-sm"
            >
              <Icon
                aria-hidden
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  result.ok ? "text-success" : "text-destructive"
                )}
              />
              <span>
                <span className="sr-only">
                  {result.ok ? "Passes: " : "Needs work: "}
                </span>
                {result.message}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
