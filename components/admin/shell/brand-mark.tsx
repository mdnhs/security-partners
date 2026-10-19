import { cn } from "@/lib/utils"

import { SpMark } from "./sp-mark"

/** The SP shield in a round accent chip, the name and an "Admin" pill (MK). */
export function BrandMark({
  tone = "default",
  className,
}: {
  tone?: "default" | "inverse"
  className?: string
}) {
  const inverse = tone === "inverse"
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        data-slot="brand-chip"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          inverse
            ? "bg-white/90 text-accent-foreground"
            : "bg-accent text-accent-foreground"
        )}
      >
        <SpMark className="size-5.5" />
      </span>
      <span data-slot="brand-name" className="flex min-w-0 items-center gap-2">
        <span className="truncate text-base font-semibold tracking-tight">
          Security Partners
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
            inverse
              ? "bg-white/15 text-white"
              : "bg-accent text-accent-foreground"
          )}
        >
          Admin
        </span>
      </span>
    </span>
  )
}
