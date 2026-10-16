import type { ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** The admin's button pair: filled primary, outlined primary; 48 px, rounded-xl. */
export const PRIMARY_ACTION =
  "h-12 gap-2 rounded-xl px-5 text-[15px] font-semibold"
export const SECONDARY_ACTION =
  "h-12 gap-2 rounded-xl border-primary bg-card px-5 text-[15px] font-semibold text-primary hover:bg-accent hover:text-accent-foreground"
/** A form's own submit button, and anything beside one. */
export const FORM_ACTION = "h-11 rounded-xl px-5 font-semibold"

// Navigation styled as a button stays a real link (role "link").
export const LINK_PRIMARY = cn(buttonVariants(), PRIMARY_ACTION)
export const LINK_SECONDARY = cn(
  buttonVariants({ variant: "outline" }),
  SECONDARY_ACTION
)
export const LINK_FORM = cn(buttonVariants(), FORM_ACTION)

/** Title row of an admin screen: optional breadcrumbs, h1, description, actions. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  titleTestId,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: ReactNode
  titleTestId?: string
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {breadcrumbs}
        <h1 className="text-title text-balance" data-testid={titleTestId}>
          {title}
        </h1>
        {description ? (
          <div className="max-w-2xl text-[15px] text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  )
}
