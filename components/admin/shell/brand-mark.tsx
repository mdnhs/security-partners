import { LogoAnimation } from "@/components/home/logo-animation"
import { cn } from "@/lib/utils"

import type { AdminBrand } from "./constants"
import { SpMark } from "./sp-mark"

/**
 * The sidebar brand: the site's published logo (its Lottie animation looped
 * over it when one is set) beside an "Admin" pill; without a logo, the SP
 * shield in a round accent chip, the name and the pill (MK).
 */
export function BrandMark({
  tone = "default",
  brand = null,
  className,
}: {
  tone?: "default" | "inverse"
  /** The published logo (panel layout); null = the SP chip. */
  brand?: AdminBrand | null
  className?: string
}) {
  const inverse = tone === "inverse"
  const pill = (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        inverse ? "bg-white/15 text-white" : "bg-accent text-accent-foreground"
      )}
    >
      Admin
    </span>
  )
  if (brand) {
    return (
      <span className={cn("flex min-w-0 items-center gap-3", className)}>
        <BrandLogo brand={brand} />
        <span data-slot="brand-name" className="flex shrink-0 items-center">
          {pill}
        </span>
      </span>
    )
  }
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
        {pill}
      </span>
    </span>
  )
}

/**
 * The logo in the chip's 40 px row: width follows the image up to the room
 * left, object-contain. Dark mode swaps in logoOnDark when there is one (and
 * no animation drawn for the light logo); otherwise a small light plate
 * keeps a dark logo visible. The icon rail fits it into a 40 px square.
 */
function BrandLogo({ brand }: { brand: AdminBrand }) {
  const { logo, logoOnDark, animation } = brand
  const darkSwap = Boolean(logoOnDark) && !animation
  const img = "block h-full w-auto max-w-full object-contain"
  return (
    <span
      data-slot="brand-logo"
      className={cn(
        "relative flex h-10 max-w-full min-w-0 shrink items-center",
        "group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center",
        !darkSwap && "dark:rounded-lg dark:bg-white dark:px-1.5 dark:py-1"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- admin chrome: a same-origin media URL at its own size */}
      <img
        src={logo.src}
        alt={logo.alt}
        width={logo.width ?? undefined}
        height={logo.height ?? undefined}
        decoding="async"
        className={cn(img, darkSwap && "dark:hidden")}
      />
      {darkSwap ? (
        // eslint-disable-next-line @next/next/no-img-element -- as above
        <img
          src={logoOnDark!}
          alt={logo.alt}
          width={logo.width ?? undefined}
          height={logo.height ?? undefined}
          decoding="async"
          className={cn(img, "hidden dark:block")}
        />
      ) : null}
      {animation ? <LogoAnimation src={animation} /> : null}
    </span>
  )
}
