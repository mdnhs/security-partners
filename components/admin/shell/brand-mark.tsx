import Image from "next/image"

import { cn } from "@/lib/utils"

/** The Security Partners logo on a white tile, the name and an "Admin" pill. */
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
        className={cn(
          "flex h-10 w-14 shrink-0 items-center justify-center rounded-xl bg-white px-1.5",
          !inverse && "ring-1 ring-border"
        )}
      >
        <Image
          src="/images/logo.png"
          alt=""
          width={44}
          height={27}
          className="h-auto w-full"
        />
      </span>
      <span data-slot="brand-name" className="flex min-w-0 items-center gap-2">
        <span className="truncate text-base font-semibold">
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
