import Link from "next/link"
import { Fragment, isValidElement, type ReactNode } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** The admin's button pair: filled primary, outlined primary; 48 px, rounded-xl. */
export const PRIMARY_ACTION =
  "h-12 gap-2 rounded-xl px-5 text-[15px] font-semibold"
export const SECONDARY_ACTION =
  "h-12 gap-2 rounded-xl border-primary bg-card px-5 text-[15px] font-semibold text-primary hover:bg-accent hover:text-accent-foreground"
/** A form's own submit button, and anything beside one. */
export const FORM_ACTION = "h-11 rounded-xl px-5 font-semibold"
/**
 * Compact controls on touch screens (WCAG 2.5.8, project rule: 44 px on a
 * coarse pointer): icon buttons grow to 44 × 44, text controls to 44 px tall.
 */
export const COARSE_ICON = "pointer-coarse:size-11"
export const COARSE_HEIGHT = "pointer-coarse:h-11"

// Navigation styled as a button stays a real link (role "link").
export const LINK_PRIMARY = cn(buttonVariants(), PRIMARY_ACTION)
export const LINK_SECONDARY = cn(
  buttonVariants({ variant: "outline" }),
  SECONDARY_ACTION
)
export const LINK_FORM = cn(buttonVariants(), FORM_ACTION)

/** One breadcrumb; the one without an `href` (normally the last) is the current page. */
export type Crumb = { label: string; href?: string }

function isCrumbs(value: unknown): value is readonly Crumb[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        !isValidElement(item) &&
        typeof (item as Crumb).label === "string"
    )
  )
}

/**
 * Breadcrumb trail on the shadcn breadcrumb primitives (nav > ol > li; the
 * current page a non-link with aria-current="page").
 */
function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <Breadcrumb aria-label="Breadcrumb">
      <BreadcrumbList>
        {items.map((item, index) => {
          const current = !item.href || index === items.length - 1
          return (
            <Fragment key={`${index}-${item.label}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="gap-1.5">
                {current || item.href === undefined ? (
                  <BreadcrumbPage className="font-medium">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="inline-flex items-center rounded-md pointer-coarse:min-h-11"
                    render={<Link href={item.href} />}
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** Title row of an admin screen: optional breadcrumbs, h1, description, actions. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  titleTestId,
  stacked = false,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** A trail of crumbs (rendered as a breadcrumb nav), or a custom node such as a back link. */
  breadcrumbs?: readonly Crumb[] | ReactNode
  titleTestId?: string
  /**
   * Actions in one row under the title, never beside it: for a header on a
   * section tab's card, too narrow for title and actions side by side.
   */
  stacked?: boolean
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4",
        !stacked && "lg:flex-row lg:items-end lg:justify-between"
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        {isCrumbs(breadcrumbs) ? (
          <Breadcrumbs items={breadcrumbs} />
        ) : (
          (breadcrumbs as ReactNode)
        )}
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
